import { Router } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

dotenv.config();

const router = Router();

function getOptionalUserId(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.id;
  } catch {
    return null;
  }
}

async function getProfileByUserId(userId) {
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
      p.social_max,

      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', e.id,
            'title', e.title,
            'location', e.location,
            'start_at', e.start_at
          )
          ORDER BY e.start_at ASC
        )
        FROM applications a
        JOIN events e ON e.id = a.event_id
        WHERE a.user_id = u.id
          AND a.status = 'active'
      ), '[]'::json) AS volunteer_events,

      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', e.id,
            'title', e.title,
            'location', e.location,
            'start_at', e.start_at
          )
          ORDER BY e.start_at ASC
        )
        FROM events e
        WHERE e.created_by = u.id
      ), '[]'::json) AS coordinator_events
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const profile = await getProfileByUserId(req.user.id);

    if (!profile) {
      return res.status(404).json({ message: "Профиль не найден" });
    }

    res.json(profile);
  } catch (error) {
    console.error("Get my profile error:", error);
    res.status(500).json({ message: "Ошибка при получении профиля" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const viewerId = getOptionalUserId(req);
    const profile = await getProfileByUserId(req.params.id);

    if (!profile) {
      return res.status(404).json({ message: "Профиль не найден" });
    }

    res.json({
      ...profile,
      is_owner: viewerId === profile.id,
    });
  } catch (error) {
    console.error("Get profile by id error:", error);
    res.status(500).json({ message: "Ошибка при получении профиля" });
  }
});

router.put("/me", authMiddleware, async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    phone,
    city,
    avatar_url,
    bio,
    social_vk,
    social_ok,
    social_max,
  } = req.body;

  if (!first_name || !last_name || !email) {
    return res.status(400).json({ message: "Имя, фамилия и email обязательны" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const normalizedEmail = String(email).trim().toLowerCase();

    const emailExists = await client.query(
      `
      SELECT id
      FROM users
      WHERE email = $1 AND id <> $2
      `,
      [normalizedEmail, req.user.id]
    );

    if (emailExists.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Пользователь с таким email уже существует" });
    }

    await client.query(
      `
      UPDATE users
      SET email = $1
      WHERE id = $2
      `,
      [normalizedEmail, req.user.id]
    );

    await client.query(
      `
      INSERT INTO profiles (
        user_id,
        first_name,
        last_name,
        phone,
        city,
        avatar_url,
        bio,
        social_vk,
        social_ok,
        social_max
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id)
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        city = EXCLUDED.city,
        avatar_url = EXCLUDED.avatar_url,
        bio = EXCLUDED.bio,
        social_vk = EXCLUDED.social_vk,
        social_ok = EXCLUDED.social_ok,
        social_max = EXCLUDED.social_max
      `,
      [
        req.user.id,
        String(first_name).trim(),
        String(last_name).trim(),
        phone ? String(phone).trim() : "",
        city ? String(city).trim() : "",
        avatar_url ? String(avatar_url).trim() : "",
        bio ? String(bio).trim() : "",
        social_vk ? String(social_vk).trim() : "",
        social_ok ? String(social_ok).trim() : "",
        social_max ? String(social_max).trim() : "",
      ]
    );

    const updatedProfile = await getProfileByUserId(req.user.id);

    await client.query("COMMIT");

    res.json({
      message: "Профиль обновлён",
      profile: updatedProfile,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Ошибка при обновлении профиля" });
  } finally {
    client.release();
  }
});

export default router;