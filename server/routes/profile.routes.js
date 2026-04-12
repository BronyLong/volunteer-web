import { Router } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

dotenv.config();

const router = Router();

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

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRussianPhone(phone) {
  if (!phone) return true;
  return /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(phone);
}

function validateVkLink(value) {
  if (!value) return true;
  return /^(https?:\/\/)?(www\.)?(vk\.com|vkontakte\.ru)\/[A-Za-z0-9_.-]+\/?$/i.test(
    value
  );
}

function validateOkLink(value) {
  if (!value) return true;
  return /^(https?:\/\/)?(www\.)?(ok\.ru|odnoklassniki\.ru)\/[A-Za-z0-9_.\/-]+\/?$/i.test(
    value
  );
}

function validateMaxLink(value) {
  if (!value) return true;
  return /^(https?:\/\/)?(www\.)?max\.ru\/[A-Za-z0-9_.\/-]+\/?$/i.test(value);
}

async function getProfileByUserId(userId, db = pool) {
  const result = await db.query(
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

async function getProfileAccessLevel(viewer, targetUserId) {
  if (!viewer) {
    return "public";
  }

  if (String(viewer.id) === String(targetUserId) || viewer.role === "admin") {
    return "private";
  }

  const relatedResult = await pool.query(
    `
    SELECT 1
    FROM applications a
    JOIN events e ON e.id = a.event_id
    WHERE a.status = 'active'
      AND (
        (a.user_id = $1 AND e.created_by = $2)
        OR
        (a.user_id = $2 AND e.created_by = $1)
      )
    LIMIT 1
    `,
    [viewer.id, targetUserId]
  );

  if (relatedResult.rows.length > 0) {
    return "contact";
  }

  return "public";
}

function sanitizeProfile(profile, accessLevel, viewer) {
  if (!profile) return null;

  const isOwner = Boolean(viewer && String(viewer.id) === String(profile.id));
  const isAdmin = Boolean(viewer && viewer.role === "admin");
  const canViewContacts = accessLevel === "contact" || accessLevel === "private";

  return {
    id: profile.id,
    role: profile.role,
    first_name: profile.first_name,
    last_name: profile.last_name,
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    volunteer_events: Array.isArray(profile.volunteer_events)
      ? profile.volunteer_events
      : [],
    coordinator_events: Array.isArray(profile.coordinator_events)
      ? profile.coordinator_events
      : [],

    access_level: accessLevel,
    can_view_contacts: canViewContacts,
    is_owner: isOwner,
    is_admin_view: Boolean(!isOwner && isAdmin),

    email: canViewContacts || isOwner || isAdmin ? profile.email : null,
    phone: canViewContacts || isOwner || isAdmin ? profile.phone : null,
    city: canViewContacts || isOwner || isAdmin ? profile.city : null,
    social_vk: canViewContacts || isOwner || isAdmin ? profile.social_vk : null,
    social_ok: canViewContacts || isOwner || isAdmin ? profile.social_ok : null,
    social_max: canViewContacts || isOwner || isAdmin ? profile.social_max : null,

    is_active: accessLevel === "private" ? profile.is_active : undefined,
    created_at: accessLevel === "private" ? profile.created_at : undefined,
  };
}

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const profile = await getProfileByUserId(req.user.id);

    if (!profile) {
      return res.status(404).json({ message: "Профиль не найден" });
    }

    res.json({
      ...profile,
      access_level: "private",
      can_view_contacts: true,
      is_owner: true,
      is_admin_view: false,
    });
  } catch (error) {
    console.error("Get my profile error:", error);
    res.status(500).json({ message: "Ошибка при получении профиля" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const viewer = getOptionalViewer(req);
    const profile = await getProfileByUserId(req.params.id);

    if (!profile) {
      return res.status(404).json({ message: "Профиль не найден" });
    }

    const accessLevel = await getProfileAccessLevel(viewer, req.params.id);
    const safeProfile = sanitizeProfile(profile, accessLevel, viewer);

    res.json(safeProfile);
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

  const normalizedFirstName = String(first_name || "").trim();
  const normalizedLastName = String(last_name || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPhone = phone ? String(phone).trim() : "";
  const normalizedCity = city ? String(city).trim() : "";
  const normalizedAvatarUrl = avatar_url ? String(avatar_url).trim() : "";
  const normalizedBio = bio ? String(bio).trim() : "";
  const normalizedVk = social_vk ? String(social_vk).trim() : "";
  const normalizedOk = social_ok ? String(social_ok).trim() : "";
  const normalizedMax = social_max ? String(social_max).trim() : "";

  if (!normalizedFirstName || !normalizedLastName || !normalizedEmail) {
    return res.status(400).json({ message: "Имя, фамилия и email обязательны" });
  }

  if (!validateEmail(normalizedEmail)) {
    return res.status(400).json({
      message: "Введите корректный email, например example@mail.com",
    });
  }

  if (!validateRussianPhone(normalizedPhone)) {
    return res.status(400).json({
      message: "Телефон должен быть в формате +7 (900) 000-00-00",
    });
  }

  if (!validateVkLink(normalizedVk)) {
    return res.status(400).json({
      message: "Укажите корректную ссылку VK",
    });
  }

  if (!validateOkLink(normalizedOk)) {
    return res.status(400).json({
      message: "Укажите корректную ссылку Одноклассников",
    });
  }

  if (!validateMaxLink(normalizedMax)) {
    return res.status(400).json({
      message: "Укажите корректную ссылку MAX",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const emailExists = await client.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER($1) AND id <> $2
      `,
      [normalizedEmail, req.user.id]
    );

    if (emailExists.rows.length > 0) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ message: "Пользователь с таким email уже существует" });
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
        normalizedFirstName,
        normalizedLastName,
        normalizedPhone,
        normalizedCity,
        normalizedAvatarUrl,
        normalizedBio,
        normalizedVk,
        normalizedOk,
        normalizedMax,
      ]
    );

    const updatedProfile = await getProfileByUserId(req.user.id, client);

    await client.query("COMMIT");

    res.json({
      message: "Профиль обновлён",
      profile: {
        ...updatedProfile,
        access_level: "private",
        can_view_contacts: true,
        is_owner: true,
        is_admin_view: false,
      },
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