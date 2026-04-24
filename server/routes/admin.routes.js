import { Router } from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { writeAuditLog } from "../utils/audit.js";

const router = Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Доступ только для администратора" });
  }

  next();
}

function normalizeBoolean(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

router.use(authMiddleware, requireAdmin);

router.get("/users", async (req, res) => {
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
        p.avatar_url
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      ORDER BY u.created_at DESC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Admin get users error:", error);
    res.status(500).json({ message: "Не удалось получить пользователей" });
  }
});

router.patch("/users/:id/role", async (req, res) => {
  const { role } = req.body;
  const allowedRoles = ["volunteer", "coordinator", "admin"];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Некорректная роль пользователя" });
  }

  try {
    const result = await pool.query(
      `
      UPDATE users
      SET role = $1
      WHERE id = $2
      RETURNING id, email, role, is_active, created_at
      `,
      [role, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    await writeAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "admin_user_role_update",
      entityType: "user",
      entityId: req.params.id,
      req,
      details: { role },
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Admin update user role error:", error);
    res.status(500).json({ message: "Не удалось изменить роль пользователя" });
  }
});

router.patch("/users/:id/active", async (req, res) => {
  const isActive = normalizeBoolean(req.body.is_active);

  if (isActive === null) {
    return res.status(400).json({ message: "Некорректный статус активности" });
  }

  try {
    const result = await pool.query(
      `
      UPDATE users
      SET is_active = $1
      WHERE id = $2
      RETURNING id, email, role, is_active, created_at
      `,
      [isActive, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    await writeAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: isActive ? "admin_user_activate" : "admin_user_deactivate",
      entityType: "user",
      entityId: req.params.id,
      req,
      details: { is_active: isActive },
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Admin update user active error:", error);
    res.status(500).json({ message: "Не удалось изменить статус пользователя" });
  }
});

router.get("/events", async (req, res) => {
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
        GREATEST(e.participant_limit - COALESCE(active_applications.count, 0), 0) AS available_slots,
        e.category_id,
        c.name AS category_name,
        e.created_by,
        u.email AS coordinator_email,
        p.first_name AS coordinator_first_name,
        p.last_name AS coordinator_last_name,
        e.created_at,
        e.updated_at
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
      ORDER BY e.start_at DESC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Admin get events error:", error);
    res.status(500).json({ message: "Не удалось получить мероприятия" });
  }
});

router.patch("/events/:id/coordinator", async (req, res) => {
  const { coordinator_id: coordinatorId } = req.body;

  if (!coordinatorId) {
    return res.status(400).json({ message: "Не указан координатор" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const coordinatorResult = await client.query(
      `
      SELECT id, role
      FROM users
      WHERE id = $1 AND is_active = true
      `,
      [coordinatorId]
    );

    if (coordinatorResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Координатор не найден" });
    }

    if (coordinatorResult.rows[0].role !== "coordinator") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Назначить можно только пользователя с ролью координатора" });
    }

    const eventResult = await client.query(
      `
      UPDATE events
      SET created_by = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [coordinatorId, req.params.id]
    );

    if (eventResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Мероприятие не найдено" });
    }

    await writeAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "admin_event_coordinator_update",
      entityType: "event",
      entityId: req.params.id,
      req,
      details: { coordinator_id: coordinatorId },
      db: client,
    });

    await client.query("COMMIT");
    res.json(eventResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Admin update event coordinator error:", error);
    res.status(500).json({ message: "Не удалось назначить координатора" });
  } finally {
    client.release();
  }
});

router.get("/logs", async (req, res) => {
  const allowedFilters = [
    "user_id",
    "action",
    "entity_type",
    "entity_id",
    "method",
    "route",
    "status",
  ];

  const values = [];
  const conditions = [];

  allowedFilters.forEach((field) => {
    const value = req.query[field];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      values.push(String(value));
      conditions.push(`${field}::text = $${values.length}`);
    }
  });

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        user_id,
        user_role,
        action,
        entity_type,
        entity_id,
        method,
        route,
        ip_address,
        user_agent,
        status,
        details,
        created_at
      FROM audit_logs
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY created_at DESC, id DESC
      LIMIT 500
      `,
      values
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Admin get logs error:", error);
    res.status(500).json({ message: "Не удалось получить логи" });
  }
});

export default router;
