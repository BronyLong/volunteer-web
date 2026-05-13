import { Router } from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { ensureNotificationSettings } from "../utils/notifications.js";

const router = Router();

function normalizeBoolean(value, defaultValue = true) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return defaultValue;
}

router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        n.id,
        n.type,
        n.title,
        n.body,
        n.event_id,
        n.application_id,
        n.is_read,
        n.created_at,
        e.title AS event_title
      FROM notifications n
      LEFT JOIN events e ON e.id = n.event_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT 100
      `,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ message: "Не удалось получить уведомления" });
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM notifications
      WHERE user_id = $1 AND is_read = FALSE
      `,
      [req.user.id]
    );

    res.json({ count: result.rows[0]?.count || 0 });
  } catch (error) {
    console.error("Get unread notifications count error:", error);
    res.status(500).json({ message: "Не удалось получить количество уведомлений" });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE,
          read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
      `,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Уведомление не найдено" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Read notification error:", error);
    res.status(500).json({ message: "Не удалось отметить уведомление прочитанным" });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE,
          read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_read = FALSE
      `,
      [req.user.id]
    );

    res.json({ message: "Уведомления отмечены прочитанными" });
  } catch (error) {
    console.error("Read all notifications error:", error);
    res.status(500).json({ message: "Не удалось отметить уведомления прочитанными" });
  }
});

router.get("/settings", async (req, res) => {
  try {
    await ensureNotificationSettings(req.user.id, pool);

    const settingsResult = await pool.query(
      `
      SELECT
        ns.user_id,
        ns.receive_notifications,
        ns.notify_new_events,
        ns.notify_coordinator_messages,
        ns.notify_application_status,
        ns.notify_event_assignment,
        ns.notify_new_applications,
        u.role
      FROM notification_settings ns
      JOIN users u ON u.id = ns.user_id
      WHERE ns.user_id = $1
      `,
      [req.user.id]
    );

    const categoriesResult = await pool.query(
      `
      SELECT
        c.id,
        c.name,
        COALESCE(ncs.enabled, TRUE) AS enabled
      FROM categories c
      LEFT JOIN notification_category_settings ncs
        ON ncs.category_id = c.id AND ncs.user_id = $1
      ORDER BY c.id ASC
      `,
      [req.user.id]
    );

    res.json({
      settings: settingsResult.rows[0],
      categories: categoriesResult.rows,
    });
  } catch (error) {
    console.error("Get notification settings error:", error);
    res.status(500).json({ message: "Не удалось получить настройки уведомлений" });
  }
});

router.put("/settings", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureNotificationSettings(req.user.id, client);

    const userResult = await client.query(
      `SELECT role FROM users WHERE id = $1`,
      [req.user.id]
    );

    const role = userResult.rows[0]?.role;

    const receiveNotifications = normalizeBoolean(req.body.receive_notifications, true);
    const notifyNewEvents = normalizeBoolean(req.body.notify_new_events, true);
    const notifyCoordinatorMessages = normalizeBoolean(req.body.notify_coordinator_messages, true);
    const notifyApplicationStatus = normalizeBoolean(req.body.notify_application_status, true);
    const notifyEventAssignment = normalizeBoolean(req.body.notify_event_assignment, true);
    const notifyNewApplications = normalizeBoolean(req.body.notify_new_applications, true);

    const updatedSettings = await client.query(
      `
      UPDATE notification_settings
      SET
        receive_notifications = $1,
        notify_new_events = $2,
        notify_coordinator_messages = $3,
        notify_application_status = $4,
        notify_event_assignment = $5,
        notify_new_applications = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $7
      RETURNING *
      `,
      [
        receiveNotifications,
        notifyNewEvents,
        notifyCoordinatorMessages,
        notifyApplicationStatus,
        notifyEventAssignment,
        notifyNewApplications,
        req.user.id,
      ]
    );

    const categorySettings = Array.isArray(req.body.categories)
      ? req.body.categories
      : [];

    if (role === "volunteer") {
      for (const category of categorySettings) {
        await client.query(
          `
          INSERT INTO notification_category_settings (user_id, category_id, enabled)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, category_id)
          DO UPDATE SET
            enabled = EXCLUDED.enabled,
            updated_at = CURRENT_TIMESTAMP
          `,
          [
            req.user.id,
            category.id,
            normalizeBoolean(category.enabled, true),
          ]
        );
      }
    }

    const categoriesResult = await client.query(
      `
      SELECT
        c.id,
        c.name,
        COALESCE(ncs.enabled, TRUE) AS enabled
      FROM categories c
      LEFT JOIN notification_category_settings ncs
        ON ncs.category_id = c.id AND ncs.user_id = $1
      ORDER BY c.id ASC
      `,
      [req.user.id]
    );

    await client.query("COMMIT");

    res.json({
      message: "Настройки уведомлений сохранены",
      settings: updatedSettings.rows[0],
      categories: categoriesResult.rows,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update notification settings error:", error);
    res.status(500).json({ message: "Не удалось сохранить настройки уведомлений" });
  } finally {
    client.release();
  }
});

router.get("/coordinator-volunteers", async (req, res) => {
  if (req.user.role !== "coordinator" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Доступ только для координатора или администратора" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.email,
        p.first_name,
        p.last_name,
        p.middle_name,
        p.gender,
        p.avatar_url,
        BOOL_OR(a.status = 'approved' OR a.participation_confirmed = TRUE) AS can_receive_urgent
      FROM users u
      JOIN profiles p ON p.user_id = u.id
      JOIN applications a ON a.user_id = u.id
      JOIN events e ON e.id = a.event_id
      WHERE u.role = 'volunteer'
        AND u.is_active = TRUE
        AND e.created_by = $1
      GROUP BY
        u.id,
        u.email,
        p.first_name,
        p.last_name,
        p.middle_name,
        p.gender,
        p.avatar_url
      ORDER BY p.last_name ASC, p.first_name ASC, p.middle_name ASC, u.email ASC
      `,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get coordinator volunteers error:", error);
    res.status(500).json({ message: "Не удалось получить список волонтёров" });
  }
});

export default router;
