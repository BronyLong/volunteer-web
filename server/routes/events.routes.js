import { Router } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { writeAuditLog } from "../utils/audit.js";

dotenv.config();

const router = Router();

function canManageEvent(user, eventCreatorId) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "coordinator" && String(eventCreatorId) === String(user.id);
}

function getOptionalViewer(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

async function canViewCoordinatorContacts(viewer, eventId, creatorId) {
  if (!viewer) return false;

  if (viewer.role === "admin") return true;

  if (String(viewer.id) === String(creatorId)) {
    return true;
  }

  if (viewer.role !== "volunteer") {
    return false;
  }

  const applicationResult = await pool.query(
    `
    SELECT 1
    FROM applications
    WHERE user_id = $1
      AND event_id = $2
      AND status = 'approved'
    LIMIT 1
    `,
    [viewer.id, eventId]
  );

  return applicationResult.rows.length > 0;
}

async function getEventForAudit(eventId, db = pool) {
  const result = await db.query(
    `
    SELECT
      e.id,
      e.title,
      e.image_url,
      e.description,
      e.start_at,
      e.duration_minutes,
      e.location,
      e.tasks,
      e.participant_limit,
      e.available_slots,
      e.category_id,
      e.created_by,
      e.created_at,
      e.updated_at,
      c.name AS category_name
    FROM events e
    JOIN categories c ON c.id = e.category_id
    WHERE e.id = $1
    `,
    [eventId]
  );

  return result.rows[0] || null;
}

router.get("/", async (req, res) => {
  const { category } = req.query;

  try {
    const params = [];
    let sql = `
      SELECT
        e.id,
        e.title,
        e.image_url,
        e.description,
        e.start_at,
        e.duration_minutes,
        e.location,
        e.tasks,
        e.participant_limit,
        GREATEST(
          e.participant_limit - COALESCE(active_applications.count, 0),
          0
        ) AS available_slots,
        e.created_at,
        e.updated_at,
        c.id AS category_id,
        c.name AS category_name
      FROM events e
      JOIN categories c ON c.id = e.category_id
      LEFT JOIN (
        SELECT event_id, COUNT(*)::int AS count
        FROM applications
        WHERE status = 'approved'
        GROUP BY event_id
      ) AS active_applications ON active_applications.event_id = e.id
    `;

    if (category) {
      params.push(category);
      sql += ` WHERE c.name = $1 `;
    }

    sql += ` ORDER BY e.start_at ASC `;

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({ message: "Не удалось получить мероприятия" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const viewer = getOptionalViewer(req);

    const result = await pool.query(
      `
      SELECT
        e.id,
        e.title,
        e.image_url,
        e.description,
        e.start_at,
        e.duration_minutes,
        e.location,
        e.tasks,
        e.participant_limit,
        GREATEST(
          e.participant_limit - COALESCE(active_applications.count, 0),
          0
        ) AS available_slots,
        e.created_at,
        e.updated_at,
        c.id AS category_id,
        c.name AS category_name,
        u.id AS creator_id,
        u.email,
        p.first_name,
        p.last_name,
        p.phone,
        p.avatar_url
      FROM events e
      JOIN categories c ON c.id = e.category_id
      JOIN users u ON u.id = e.created_by
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN (
        SELECT event_id, COUNT(*)::int AS count
        FROM applications
        WHERE status = 'approved'
        GROUP BY event_id
      ) AS active_applications ON active_applications.event_id = e.id
      WHERE e.id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Мероприятие не найдено" });
    }

    const event = result.rows[0];

    const canViewContacts = await canViewCoordinatorContacts(
      viewer,
      event.id,
      event.creator_id
    );

    res.json({
      ...event,
      email: canViewContacts ? event.email : null,
      phone: canViewContacts ? event.phone : null,
    });
  } catch (error) {
    console.error("Get event by id error:", error);
    res.status(500).json({ message: "Ошибка при получении мероприятия" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  const {
    title,
    image_url,
    description,
    start_at,
    location,
    tasks = [],
    participant_limit,
    duration_minutes,
    category_id,
  } = req.body;

  if (req.user.role !== "coordinator" && req.user.role !== "admin") {
    return res.status(403).json({
      message: "Только координатор или администратор может создавать мероприятия",
    });
  }

  if (
    !title ||
    !description ||
    !start_at ||
    !location ||
    !participant_limit ||
    !duration_minutes ||
    !category_id
  ) {
    return res
      .status(400)
      .json({ message: "Не все обязательные поля заполнены" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO events (
        title,
        image_url,
        description,
        start_at,
        duration_minutes,
        location,
        tasks,
        participant_limit,
        available_slots,
        category_id,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10)
      RETURNING *
      `,
      [
        title,
        image_url || null,
        description,
        start_at,
        duration_minutes,
        location,
        tasks,
        Number(participant_limit),
        category_id,
        req.user.id,
      ]
    );

    await writeAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "event_create",
      entityType: "event",
      entityId: result.rows[0].id,
      req,
      details: {
        event: result.rows[0],
      },
      db: client,
    });

    await client.query("COMMIT");

    res.status(201).json({
      message: "Мероприятие создано",
      event: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create event error:", error);
    res.status(500).json({ message: "Ошибка при создании мероприятия" });
  } finally {
    client.release();
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  const {
    title,
    image_url,
    description,
    start_at,
    location,
    tasks = [],
    participant_limit,
    duration_minutes,
    category_id,
  } = req.body;

  if (req.user.role !== "coordinator" && req.user.role !== "admin") {
    return res.status(403).json({
      message: "Только координатор или администратор может редактировать мероприятия",
    });
  }

  if (
    !title ||
    !description ||
    !start_at ||
    !location ||
    !participant_limit ||
    !duration_minutes ||
    !category_id
  ) {
    return res
      .status(400)
      .json({ message: "Не все обязательные поля заполнены" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT id, created_by
      FROM events
      WHERE id = $1
      FOR UPDATE
      `,
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Мероприятие не найдено" });
    }

    if (!canManageEvent(req.user, existing.rows[0].created_by)) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Нет доступа к редактированию этого мероприятия",
      });
    }

    const oldEvent = await getEventForAudit(req.params.id, client);

    const activeApplications = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM applications
      WHERE event_id = $1 AND status = 'approved'
      `,
      [req.params.id]
    );

    const activeCount = activeApplications.rows[0]?.count || 0;
    const newLimit = Number(participant_limit);

    if (newLimit < activeCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Нельзя установить лимит меньше количества поданных заявок (${activeCount})`,
      });
    }

    const newAvailableSlots = newLimit - activeCount;

    const result = await client.query(
      `
      UPDATE events
      SET
        title = $1,
        image_url = $2,
        description = $3,
        start_at = $4,
        duration_minutes = $5,
        location = $6,
        tasks = $7,
        participant_limit = $8,
        available_slots = $9,
        category_id = $10
      WHERE id = $11
      RETURNING *
      `,
      [
        title,
        image_url || null,
        description,
        start_at,
        duration_minutes,
        location,
        tasks,
        newLimit,
        newAvailableSlots,
        category_id,
        req.params.id,
      ]
    );

    const updatedEvent = await getEventForAudit(req.params.id, client);

    await writeAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "event_update",
      entityType: "event",
      entityId: req.params.id,
      req,
      details: {
        before: oldEvent,
        after: updatedEvent,
      },
      db: client,
    });

    await client.query("COMMIT");

    res.json({
      message: "Мероприятие обновлено",
      event: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update event error:", error);
    res.status(500).json({ message: "Ошибка при обновлении мероприятия" });
  } finally {
    client.release();
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "coordinator" && req.user.role !== "admin") {
    return res.status(403).json({
      message: "Только координатор или администратор может удалять мероприятия",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT id, created_by
      FROM events
      WHERE id = $1
      FOR UPDATE
      `,
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Мероприятие не найдено" });
    }

    if (!canManageEvent(req.user, existing.rows[0].created_by)) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Нет доступа к удалению этого мероприятия",
      });
    }

    const deletedEvent = await getEventForAudit(req.params.id, client);

    await client.query(
      `
      DELETE FROM events
      WHERE id = $1
      `,
      [req.params.id]
    );

    await writeAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "event_delete",
      entityType: "event",
      entityId: req.params.id,
      req,
      details: {
        deleted_event: deletedEvent,
      },
      db: client,
    });

    await client.query("COMMIT");

    res.json({ message: "Мероприятие удалено" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete event error:", error);
    res.status(500).json({ message: "Ошибка при удалении мероприятия" });
  } finally {
    client.release();
  }
});

export default router;