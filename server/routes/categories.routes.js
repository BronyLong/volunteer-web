import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name
      FROM categories
      ORDER BY id ASC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ message: "Не удалось получить категории" });
  }
});

export default router;