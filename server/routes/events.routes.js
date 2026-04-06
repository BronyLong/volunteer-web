
import { Router } from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

const dbInfo = await pool.query(`
  SELECT current_database(), current_user, inet_server_addr(), inet_server_port()
`);
const countResult = await pool.query(`SELECT COUNT(*) FROM events`);

router.get("/", async (req, res) => {
  const { category } = req.query;

  try {
    const params = [];
    let sql = `
      SELECT
        e.id,
        e.title,
        e.description,
        e.start_at,
        e.location,
        e.tasks,
        e.participant_limit,
        e.available_slots,
        e.created_at,
        e.updated_at,
        c.id AS category_id,
        c.name AS category_name
      FROM events e
      JOIN categories c ON c.id = e.category_id
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
        e.description,
        e.start_at,
        e.location,
        e.tasks,
        e.participant_limit,
        e.available_slots,
        e.created_at,
        e.updated_at,
        c.id AS category_id,
        c.name AS category_name,
        u.id AS creator_id,
        p.first_name,
        p.last_name
      FROM events e
      JOIN categories c ON c.id = e.category_id
      JOIN users u ON u.id = e.created_by
      LEFT JOIN profiles p ON p.user_id = u.id
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
        description,
        start_at,
        location,
        tasks,
        participant_limit,
        available_slots,
        category_id,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8)
      RETURNING *
      `,
      [
        title,
        description,
        start_at,
        location,
        tasks,
        participant_limit,
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

export default router;