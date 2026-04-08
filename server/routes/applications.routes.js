import { Router } from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.post("/", authMiddleware, async (req, res) => {
  const { event_id } = req.body;

  if (!event_id) {
    return res.status(400).json({ message: "event_id обязателен" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const eventResult = await client.query(
      `
      SELECT id, available_slots
      FROM events
      WHERE id = $1
      FOR UPDATE
      `,
      [event_id]
    );

    if (eventResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Мероприятие не найдено" });
    }

    const event = eventResult.rows[0];

    if (event.available_slots <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Свободных мест нет" });
    }

    const existing = await client.query(
      `
      SELECT id
      FROM applications
      WHERE user_id = $1 AND event_id = $2
      `,
      [req.user.id, event_id]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Заявка уже подана" });
    }

    const applicationResult = await client.query(
      `
      INSERT INTO applications (user_id, event_id, status)
      VALUES ($1, $2, 'active')
      RETURNING *
      `,
      [req.user.id, event_id]
    );

    await client.query(
      `
      UPDATE events
      SET available_slots = available_slots - 1
      WHERE id = $1
      `,
      [event_id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Заявка подана",
      application: applicationResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create application error:", error);
    res.status(500).json({ message: "Ошибка при подаче заявки" });
  } finally {
    client.release();
  }
});

router.get("/my", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        a.id,
        a.status,
        a.created_at,
        e.id AS event_id,
        e.title,
        e.start_at,
        e.location,
        e.image_url
      FROM applications a
      JOIN events e ON e.id = a.event_id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC
      `,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get my applications error:", error);
    res.status(500).json({ message: "Ошибка при получении заявок" });
  }
});

router.get("/event/:eventId", authMiddleware, async (req, res) => {
  try {
    const eventCheck = await pool.query(
      `
      SELECT id, created_by
      FROM events
      WHERE id = $1
      `,
      [req.params.eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ message: "Мероприятие не найдено" });
    }

    if (eventCheck.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ message: "Нет доступа к заявкам этого мероприятия" });
    }

    const result = await pool.query(
      `
      SELECT
        a.id,
        a.status,
        a.created_at,
        u.id AS user_id,
        u.email,
        p.first_name,
        p.last_name,
        p.phone,
        p.city,
        p.avatar_url
      FROM applications a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE a.event_id = $1
      ORDER BY a.created_at DESC
      `,
      [req.params.eventId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get event applications error:", error);
    res.status(500).json({ message: "Ошибка при получении заявок мероприятия" });
  }
});

router.patch("/:id/status", authMiddleware, async (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: "status обязателен" });
  }

  if (!["active", "approved", "rejected", "cancelled"].includes(status)) {
    return res.status(400).json({ message: "Некорректный статус" });
  }

  try {
    const appResult = await pool.query(
      `
      SELECT
        a.id,
        a.event_id,
        a.status AS current_status,
        e.created_by
      FROM applications a
      JOIN events e ON e.id = a.event_id
      WHERE a.id = $1
      `,
      [req.params.id]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    if (appResult.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ message: "Нет доступа к изменению этой заявки" });
    }

    const result = await pool.query(
      `
      UPDATE applications
      SET status = $1
      WHERE id = $2
      RETURNING *
      `,
      [status, req.params.id]
    );

    res.json({
      message: "Статус заявки обновлён",
      application: result.rows[0],
    });
  } catch (error) {
    console.error("Update application status error:", error);
    res.status(500).json({ message: "Ошибка при обновлении статуса заявки" });
  }
});

export default router;