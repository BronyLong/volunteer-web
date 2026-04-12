import { Router } from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

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
        WHERE status = 'active'
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
    const result = await pool.query(
      `
      SELECT
        e.id,
        e.title,
        e.image_url,
        e.description,
        e.start_at,
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
        WHERE status = 'active'
        GROUP BY event_id
      ) AS active_applications ON active_applications.event_id = e.id
      WHERE e.id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Мероприятие не найдено" });
    }

    res.json(result.rows[0]);
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
    category_id,
  } = req.body;

  if (!title || !description || !start_at || !location || !participant_limit || !category_id) {
    return res.status(400).json({ message: "Не все обязательные поля заполнены" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO events (
        title,
        image_url,
        description,
        start_at,
        location,
        tasks,
        participant_limit,
        available_slots,
        category_id,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9)
      RETURNING *
      `,
      [
        title,
        image_url || null,
        description,
        start_at,
        location,
        tasks,
        Number(participant_limit),
        category_id,
        req.user.id,
      ]
    );

    res.status(201).json({
      message: "Мероприятие создано",
      event: result.rows[0],
    });
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({ message: "Ошибка при создании мероприятия" });
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
    category_id,
  } = req.body;

  if (!title || !description || !start_at || !location || !participant_limit || !category_id) {
    return res.status(400).json({ message: "Не все обязательные поля заполнены" });
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

    if (existing.rows[0].created_by !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Нельзя редактировать чужое мероприятие" });
    }

    const activeApplications = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM applications
      WHERE event_id = $1 AND status = 'active'
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
        location = $5,
        tasks = $6,
        participant_limit = $7,
        available_slots = $8,
        category_id = $9
      WHERE id = $10
      RETURNING *
      `,
      [
        title,
        image_url || null,
        description,
        start_at,
        location,
        tasks,
        newLimit,
        newAvailableSlots,
        category_id,
        req.params.id,
      ]
    );

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
  try {
    const existing = await pool.query(
      `
      SELECT id, created_by
      FROM events
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Мероприятие не найдено" });
    }

    if (existing.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ message: "Нельзя удалить чужое мероприятие" });
    }

    await pool.query(
      `
      DELETE FROM events
      WHERE id = $1
      `,
      [req.params.id]
    );

    res.json({ message: "Мероприятие удалено" });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({ message: "Ошибка при удалении мероприятия" });
  }
});

export default router;