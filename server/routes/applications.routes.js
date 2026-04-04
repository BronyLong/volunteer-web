import { Router } from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.post("/", authMiddleware, async (req, res) => {
  const { event_id } = req.body;

  if (!event_id) {
    return res.status(400).json({ message: "event_id обязателен" });
  }

  try {
    const eventResult = await pool.query(
      "SELECT id, available_slots FROM events WHERE id = $1",
      [event_id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ message: "Мероприятие не найдено" });
    }

    const event = eventResult.rows[0];

    if (event.available_slots <= 0) {
      return res.status(400).json({ message: "Свободных мест нет" });
    }

    const existing = await pool.query(
      "SELECT id FROM applications WHERE user_id = $1 AND event_id = $2",
      [req.user.id, event_id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Заявка уже подана" });
    }

    await pool.query("BEGIN");

    const applicationResult = await pool.query(
      `
      INSERT INTO applications (user_id, event_id, status)
      VALUES ($1, $2, 'active')
      RETURNING *
      `,
      [req.user.id, event_id]
    );

    await pool.query(
      `
      UPDATE events
      SET available_slots = available_slots - 1
      WHERE id = $1
      `,
      [event_id]
    );

    await pool.query("COMMIT");

    res.status(201).json({
      message: "Заявка подана",
      application: applicationResult.rows[0],
    });
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Create application error:", error);
    res.status(500).json({ message: "Ошибка при подаче заявки" });
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
        e.location
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

export default router;