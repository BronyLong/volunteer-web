import { Router } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { writeAuditLog } from "../utils/audit.js";
import { notifyCoordinatorSelectedVolunteers, notifyNewEvent, notifyUrgentCoordinatorVolunteers } from "../utils/notifications.js";
import { decryptUserProfileRow } from "../utils/personalData.js";

dotenv.config();

const router = Router();

function canManageEvent(user, eventCreatorId) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "coordinator" && String(eventCreatorId) === String(user.id);
}


function parsePositiveInt(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function buildPagination({ page, limit, total }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);

  return {
    page: safePage,
    limit,
    total,
    total_pages: totalPages,
    has_next_page: safePage < totalPages,
    has_prev_page: safePage > 1,
  };
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

function normalizeEventCoordinates(latitudeValue, longitudeValue) {
  const hasLatitude = latitudeValue !== null && latitudeValue !== undefined && latitudeValue !== "";
  const hasLongitude = longitudeValue !== null && longitudeValue !== undefined && longitudeValue !== "";

  if (!hasLatitude && !hasLongitude) {
    return {
      isValid: true,
      latitude: null,
      longitude: null,
    };
  }

  if (!hasLatitude || !hasLongitude) {
    return {
      isValid: false,
      message: "Укажите и широту, и долготу места проведения",
    };
  }

  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return {
      isValid: false,
      message: "Некорректная широта места проведения",
    };
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return {
      isValid: false,
      message: "Некорректная долгота места проведения",
    };
  }

  return {
    isValid: true,
    latitude,
    longitude,
  };
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
    FROM applications a
    JOIN events e ON e.id = a.event_id
    WHERE a.user_id = $1
      AND e.created_by = $2
      AND a.status = 'approved'
    LIMIT 1
    `,
    [viewer.id, creatorId]
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
      e.location_latitude,
      e.location_longitude,
      e.is_urgent,
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
  const { category, urgent } = req.query;
  const page = parsePositiveInt(req.query.page, 1, { min: 1, max: 100000 });
  const limit = parsePositiveInt(req.query.limit, 6, { min: 1, max: 50 });
  const offset = (page - 1) * limit;

  try {
    const params = [];
    const conditions = ["e.start_at >= NOW()"];

    if (category) {
      params.push(category);
      conditions.push(`c.name = $${params.length}`);
    }

    if (urgent === "true" || urgent === true) {
      conditions.push("e.is_urgent = true");
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM events e
      JOIN categories c ON c.id = e.category_id
      ${whereSql}
      `,
      params
    );

    const total = countResult.rows[0]?.total || 0;
    const pagination = buildPagination({ page, limit, total });
    const safeOffset = (pagination.page - 1) * limit;

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
        e.location_latitude,
        e.location_longitude,
        e.is_urgent,
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
      ${whereSql}
      ORDER BY e.start_at ASC, e.id ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      [...params, limit, safeOffset]
    );

    res.json({
      items: result.rows,
      pagination,
    });
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
        e.location_latitude,
        e.location_longitude,
        e.is_urgent,
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
        p.middle_name,
        p.gender,
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

    const event = decryptUserProfileRow(result.rows[0]);

    const canViewContacts = await canViewCoordinatorContacts(
      viewer,
      event.id,
      event.creator_id
    );

    res.json({
      ...event,
      can_view_coordinator_identity: canViewContacts,
      first_name: canViewContacts ? event.first_name : null,
      last_name: canViewContacts ? event.last_name : null,
      middle_name: canViewContacts ? event.middle_name : null,
      avatar_url: canViewContacts ? event.avatar_url : null,
      gender: event.gender,
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
    location_latitude,
    location_longitude,
    tasks = [],
    participant_limit,
    duration_minutes,
    category_id,
    notify_volunteer_ids = [],
    notify_specific_volunteers = false,
    is_urgent = false,
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

  const coordinates = normalizeEventCoordinates(
    location_latitude,
    location_longitude
  );

  if (!coordinates.isValid) {
    return res.status(400).json({ message: coordinates.message });
  }

  const selectedVolunteerIds = Array.isArray(notify_volunteer_ids) ? notify_volunteer_ids : [];
  const urgentEvent = is_urgent === true || is_urgent === "true";
  const shouldNotifySelected =
    !urgentEvent && (notify_specific_volunteers === true || notify_specific_volunteers === "true");

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
        location_latitude,
        location_longitude,
        is_urgent,
        tasks,
        participant_limit,
        available_slots,
        category_id,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13)
      RETURNING *
      `,
      [
        title,
        image_url || null,
        description,
        start_at,
        duration_minutes,
        location,
        coordinates.latitude,
        coordinates.longitude,
        urgentEvent,
        tasks,
        Number(participant_limit),
        category_id,
        req.user.id,
      ]
    );

    const createdEvent = result.rows[0];

    if (urgentEvent) {
      await notifyUrgentCoordinatorVolunteers(client, {
        event: createdEvent,
        coordinatorId: req.user.id,
        volunteerIds: selectedVolunteerIds,
      });
    } else if (shouldNotifySelected) {
      await notifyCoordinatorSelectedVolunteers(client, {
        event: createdEvent,
        coordinatorId: req.user.id,
        volunteerIds: selectedVolunteerIds,
      });
    } else {
      await notifyNewEvent(client, createdEvent);
    }

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
    location_latitude,
    location_longitude,
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

  const coordinates = normalizeEventCoordinates(
    location_latitude,
    location_longitude
  );

  if (!coordinates.isValid) {
    return res.status(400).json({ message: coordinates.message });
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
        location_latitude = $7,
        location_longitude = $8,
        tasks = $9,
        participant_limit = $10,
        available_slots = $11,
        category_id = $12
      WHERE id = $13
      RETURNING *
      `,
      [
        title,
        image_url || null,
        description,
        start_at,
        duration_minutes,
        location,
        coordinates.latitude,
        coordinates.longitude,
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
