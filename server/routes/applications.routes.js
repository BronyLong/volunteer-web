import { Router } from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

function isPastEvent(startAt) {
  const eventDate = new Date(startAt);
  if (Number.isNaN(eventDate.getTime())) return false;
  return eventDate.getTime() < Date.now();
}

router.post("/", authMiddleware, async (req, res) => {
  const { event_id } = req.body;

  if (!event_id) {
    return res.status(400).json({ message: "event_id обязателен" });
  }

  if (req.user.role !== "volunteer") {
    return res.status(403).json({
      message: "Подавать заявки на мероприятия может только волонтёр",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const eventResult = await client.query(
      `
      SELECT id, created_by, participant_limit, start_at
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

    if (String(event.created_by) === String(req.user.id)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Нельзя подать заявку на собственное мероприятие",
      });
    }

    if (isPastEvent(event.start_at)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Нельзя подать заявку на завершённое мероприятие",
      });
    }

    const activeApplicationsResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM applications
      WHERE event_id = $1 AND status = 'active'
      `,
      [event_id]
    );

    const activeCount = activeApplicationsResult.rows[0]?.count || 0;
    const availableSlots = Number(event.participant_limit) - activeCount;

    if (availableSlots <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Свободных мест нет" });
    }

    const existing = await client.query(
      `
      SELECT id
      FROM applications
      WHERE user_id = $1 AND event_id = $2 AND status = 'active'
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
      SET available_slots = $2
      WHERE id = $1
      `,
      [event_id, availableSlots - 1]
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
        AND a.status = 'active'
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

    const isAdmin = req.user.role === "admin";
    const isOwner = eventCheck.rows[0].created_by === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        message: "Нет доступа к заявкам этого мероприятия",
      });
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

router.patch("/:id/reject", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const appResult = await client.query(
      `
      SELECT
        a.id,
        a.user_id,
        a.event_id,
        a.status,
        e.created_by,
        e.participant_limit,
        e.start_at
      FROM applications a
      JOIN events e ON e.id = a.event_id
      WHERE a.id = $1
      FOR UPDATE
      `,
      [req.params.id]
    );

    if (appResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    const application = appResult.rows[0];
    const isAdmin = req.user.role === "admin";
    const isOwner = application.created_by === req.user.id;

    if (!isAdmin && !isOwner) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Нет доступа к изменению этой заявки" });
    }

    if (isPastEvent(application.start_at)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Нельзя изменять заявки завершённого мероприятия",
      });
    }

    if (application.status !== "active") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Отклонить можно только активную заявку" });
    }

    await client.query(
      `
      UPDATE applications
      SET status = 'rejected'
      WHERE id = $1
      `,
      [req.params.id]
    );

    const activeApplicationsResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM applications
      WHERE event_id = $1 AND status = 'active'
      `,
      [application.event_id]
    );

    const activeCount = activeApplicationsResult.rows[0]?.count || 0;
    const newAvailableSlots = Number(application.participant_limit) - activeCount;

    await client.query(
      `
      UPDATE events
      SET available_slots = $2
      WHERE id = $1
      `,
      [application.event_id, newAvailableSlots]
    );

    await client.query("COMMIT");

    res.json({ message: "Заявка отклонена" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Reject application error:", error);
    res.status(500).json({ message: "Ошибка при отклонении заявки" });
  } finally {
    client.release();
  }
});

router.patch("/:id/restore", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const appResult = await client.query(
      `
      SELECT
        a.id,
        a.user_id,
        a.event_id,
        a.status,
        e.created_by,
        e.participant_limit,
        e.start_at
      FROM applications a
      JOIN events e ON e.id = a.event_id
      WHERE a.id = $1
      FOR UPDATE
      `,
      [req.params.id]
    );

    if (appResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    const application = appResult.rows[0];
    const isAdmin = req.user.role === "admin";
    const isOwner = application.created_by === req.user.id;

    if (!isAdmin && !isOwner) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Нет доступа к изменению этой заявки" });
    }

    if (isPastEvent(application.start_at)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Нельзя изменять заявки завершённого мероприятия",
      });
    }

    if (application.status !== "rejected") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Восстановить можно только отклонённую заявку",
      });
    }

    const activeApplicationsResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM applications
      WHERE event_id = $1 AND status = 'active'
      `,
      [application.event_id]
    );

    const activeCount = activeApplicationsResult.rows[0]?.count || 0;
    const availableSlots = Number(application.participant_limit) - activeCount;

    if (availableSlots <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Нет свободных мест для восстановления заявки",
      });
    }

    await client.query(
      `
      UPDATE applications
      SET status = 'active'
      WHERE id = $1
      `,
      [req.params.id]
    );

    await client.query(
      `
      UPDATE events
      SET available_slots = $2
      WHERE id = $1
      `,
      [application.event_id, availableSlots - 1]
    );

    await client.query("COMMIT");

    res.json({ message: "Заявка восстановлена" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Restore application error:", error);
    res.status(500).json({ message: "Ошибка при восстановлении заявки" });
  } finally {
    client.release();
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const appResult = await client.query(
      `
      SELECT
        a.id,
        a.user_id,
        a.event_id,
        a.status,
        e.participant_limit,
        e.start_at
      FROM applications a
      JOIN events e ON e.id = a.event_id
      WHERE a.id = $1
      FOR UPDATE
      `,
      [req.params.id]
    );

    if (appResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    const application = appResult.rows[0];

    if (application.user_id !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Нельзя отозвать чужую заявку" });
    }

    if (isPastEvent(application.start_at)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Нельзя отзывать заявку завершённого мероприятия",
      });
    }

    await client.query(
      `
      DELETE FROM applications
      WHERE id = $1
      `,
      [req.params.id]
    );

    const activeApplicationsResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM applications
      WHERE event_id = $1 AND status = 'active'
      `,
      [application.event_id]
    );

    const activeCount = activeApplicationsResult.rows[0]?.count || 0;
    const newAvailableSlots = Number(application.participant_limit) - activeCount;

    await client.query(
      `
      UPDATE events
      SET available_slots = $2
      WHERE id = $1
      `,
      [application.event_id, newAvailableSlots]
    );

    await client.query("COMMIT");

    res.json({ message: "Заявка отозвана" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete application error:", error);
    res.status(500).json({ message: "Ошибка при отзыве заявки" });
  } finally {
    client.release();
  }
});

export default router;