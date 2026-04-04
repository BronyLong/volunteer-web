import { Router } from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.email,
        u.role,
        u.is_active,
        u.created_at,
        p.first_name,
        p.last_name,
        p.phone,
        p.city,
        p.avatar_url,
        p.bio,
        p.social_vk,
        p.social_ok,
        p.social_max
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Профиль не найден" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Ошибка при получении профиля" });
  }
});

router.put("/me", authMiddleware, async (req, res) => {
  const {
    first_name,
    last_name,
    phone,
    city,
    avatar_url,
    bio,
    social_vk,
    social_ok,
    social_max,
  } = req.body;

  try {
    const result = await pool.query(
      `
      UPDATE profiles
      SET
        first_name = $1,
        last_name = $2,
        phone = $3,
        city = $4,
        avatar_url = $5,
        bio = $6,
        social_vk = $7,
        social_ok = $8,
        social_max = $9
      WHERE user_id = $10
      RETURNING *
      `,
      [
        first_name,
        last_name,
        phone,
        city,
        avatar_url,
        bio,
        social_vk,
        social_ok,
        social_max,
        req.user.id,
      ]
    );

    res.json({
      message: "Профиль обновлён",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Ошибка при обновлении профиля" });
  }
});

export default router;