import { Router } from "express";
import { pool } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { writeAuditLog } from "../utils/audit.js";
import { notifyApplicationStatus, notifyNewApplication } from "../utils/notifications.js";
import { decryptPersonalData, decryptUserProfileRows } from "../utils/personalData.js";

const router = Router();

function decryptApplicationRows(rows) {
  return decryptUserProfileRows(rows).map((row) => ({
    ...row,
    confirmed_by_first_name: decryptPersonalData(row.confirmed_by_first_name),
    confirmed_by_last_name: decryptPersonalData(row.confirmed_by_last_name),
    confirmed_by_middle_name: decryptPersonalData(row.confirmed_by_middle_name),
  }));
}


function isPastEvent(startAt) {
  const eventDate = new Date(startAt);
  if (Number.isNaN(eventDate.getTime())) return false;
  return eventDate.getTime() < Date.now();
}

async function updateEventAvailableSlots(client, eventId, participantLimit) {
  const approvedApplicationsResult = await client.query(
    `
    SELECT COUNT(*)::int AS count
    FROM applications
    WHERE event_id = $1 AND status = 'approved'
    `,
    [eventId]
  );

  const approvedCount = approvedApplicationsResult.rows[0]?.count || 0;
  const availableSlots = Math.max(Number(participantLimit) - approvedCount, 0);

  await client.query(
    `
    UPDATE events
    SET available_slots = $2
    WHERE id = $1
    `,
    [eventId, availableSlots]
  );

  return availableSlots;
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

    const activeApplicationResult = await client.query(
      `
      SELECT id, status
      FROM applications
      WHERE user_id = $1
        AND event_id = $2
        AND status IN ('pending', 'approved')
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [req.user.id, event_id]
    );

    if (activeApplicationResult.rows.length > 0) {
      await client.query("ROLLBACK");

      const existingApplication = activeApplicationResult.rows[0];
      const message =
        existingApplication.status === "approved"
          ? "Вы уже участвуете в этом мероприятии"
          : "Заявка уже подана и ожидает решения координатора";

      return res.status(409).json({ message });
    }

    const rejectedApplicationsResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM applications
      WHERE user_id = $1
        AND event_id = $2
        AND status = 'rejected'
      `,
      [req.user.id, event_id]
    );

    const isRepeatedApplication = rejectedApplicationsResult.rows[0]?.count > 0;

    const applicationResult = await client.query(
      `
      INSERT INTO applications (user_id, event_id, status)
      VALUES ($1, $2, 'pending')
      RETURNING *
      `,
      [req.user.id, event_id]
    );

    await updateEventAvailableSlots(client, event_id, event.participant_limit);

    await notifyNewApplication(client, applicationResult.rows[0].id);

    await writeAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: isRepeatedApplication ? "application_resubmit" : "application_create",
      entityType: "application",
      entityId: applicationResult.rows[0].id,
      req,
      details: {
        application: applicationResult.rows[0],
        repeated_after_rejection: isRepeatedApplication,
      },
      db: client,
    });

    await client.query("COMMIT");

    res.status(201).json({
      message: "Заявка отправлена и ожидает решения координатора",
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
        a.participation_confirmed,
        a.participation_confirmed_at,
        a.participation_confirmed_by,
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
        a.participation_confirmed,
        a.participation_confirmed_at,
        a.participation_confirmed_by,
        confirmed_by_profile.first_name AS confirmed_by_first_name,
        confirmed_by_profile.last_name AS confirmed_by_last_name,
        confirmed_by_profile.middle_name AS confirmed_by_middle_name,
        a.created_at,
        u.id AS user_id,
        u.email,
        p.first_name,
        p.last_name,
        p.middle_name,
        p.gender,
        p.phone,
        p.city,
        p.avatar_url
      FROM applications a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN profiles confirmed_by_profile
        ON confirmed_by_profile.user_id = a.participation_confirmed_by
      WHERE a.event_id = $1
      ORDER BY
        CASE a.status
          WHEN 'pending' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'rejected' THEN 3
          ELSE 4
        END,
        a.created_at DESC
      `,
      [req.params.eventId]
    );

    res.json(decryptApplicationRows(result.rows));
  } catch (error) {
    console.error("Get event applications error:", error);
    res.status(500).json({ message: "Ошибка при получении заявок мероприятия" });
  }
});

async function getApplicationForManager(client, applicationId) {
  const appResult = await client.query(
    `
    SELECT
      a.id,
      a.user_id,
      a.event_id,
      a.status,
      a.participation_confirmed,
      a.participation_confirmed_at,
      a.participation_confirmed_by,
      e.created_by,
      e.participant_limit,
      e.start_at
    FROM applications a
    JOIN events e ON e.id = a.event_id
    WHERE a.id = $1
    FOR UPDATE
    `,
    [applicationId]
  );

  return appResult.rows[0] || null;
}

function canManageApplication(user, application) {
  const isAdmin = user.role === "admin";
  const isOwner = application.created_by === user.id;
  return isAdmin || isOwner;
}

router.patch("/:id/accept", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const application = await getApplicationForManager(client, req.params.id);

    if (!application) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    if (!canManageApplication(req.user, application)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Нет доступа к изменению этой заявки" });
    }

    if (isPastEvent(application.start_at)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Нельзя изменять заявки завершённого мероприятия",
      });
    }

    if (application.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Принять можно только заявку, ожидающую решения" });
    }

    const approvedApplicationsResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM applications
      WHERE event_id = $1 AND status = 'approved'
      `,
      [application.event_id]
    );

    const approvedCount = approvedApplicationsResult.rows[0]?.count || 0;
    const availableSlots = Number(application.participant_limit) - approvedCount;

    if (availableSlots <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Свободных мест нет" });
    }

    await client.query(
      `
      UPDATE applications
      SET
        status = 'approved',
        participation_confirmed = FALSE,
        participation_confirmed_at = NULL,
        participation_confirmed_by = NULL
      WHERE id = $1
      `,
      [req.params.id]
    );

    await updateEventAvailableSlots(client, application.event_id, application.participant_limit);

    await notifyApplicationStatus(client, req.params.id, "approved");

    await writeAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "application_accept",
      entityType: "application",
      entityId: req.params.id,
      req,
      details: {
        event_id: application.event_id,
        target_user_id: application.user_id,
        previous_status: application.status,
        new_status: "approved",
      },
      db: client,
    });

    await client.query("COMMIT");

    res.json({ message: "Заявка принята" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Accept application error:", error);
    res.status(500).json({ message: "Ошибка при принятии заявки" });
  } finally {
    client.release();
  }
});

router.patch("/:id/reject", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const application = await getApplicationForManager(client, req.params.id);

    if (!application) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    if (!canManageApplication(req.user, application)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Нет доступа к изменению этой заявки" });
    }

    if (isPastEvent(application.start_at)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Нельзя изменять заявки завершённого мероприятия",
      });
    }

    if (application.status !== "pending" && application.status !== "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Отклонить можно только заявку, ожидающую решения или уже принятую заявку",
      });
    }

    await client.query(
      `
      UPDATE applications
      SET
        status = 'rejected',
        participation_confirmed = FALSE,
        participation_confirmed_at = NULL,
        participation_confirmed_by = NULL
      WHERE id = $1
      `,
      [req.params.id]
    );

    await updateEventAvailableSlots(client, application.event_id, application.participant_limit);

    await notifyApplicationStatus(client, req.params.id, "rejected");

    await writeAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "application_reject",
      entityType: "application",
      entityId: req.params.id,
      req,
      details: {
        event_id: application.event_id,
        target_user_id: application.user_id,
        previous_status: application.status,
        new_status: "rejected",
        previous_participation_confirmed: application.participation_confirmed,
        new_participation_confirmed: false,
      },
      db: client,
    });

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

router.patch("/:id/confirm-participation", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const application = await getApplicationForManager(client, req.params.id);

    if (!application) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    if (!canManageApplication(req.user, application)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Нет доступа к подтверждению участия" });
    }

    if (!isPastEvent(application.start_at)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Участие можно подтверждать только после завершения мероприятия",
      });
    }

    if (application.status !== "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Подтвердить участие можно только для принятой заявки",
      });
    }

    await client.query(
      `
      UPDATE applications
      SET
        participation_confirmed = TRUE,
        participation_confirmed_at = CURRENT_TIMESTAMP,
        participation_confirmed_by = $2
      WHERE id = $1
      `,
      [req.params.id, req.user.id]
    );

    await writeAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "application_participation_confirm",
      entityType: "application",
      entityId: req.params.id,
      req,
      details: {
        event_id: application.event_id,
        target_user_id: application.user_id,
        previous_participation_confirmed: application.participation_confirmed,
        new_participation_confirmed: true,
      },
      db: client,
    });

    await client.query("COMMIT");

    res.json({ message: "Участие подтверждено" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Confirm participation error:", error);
    res.status(500).json({ message: "Ошибка при подтверждении участия" });
  } finally {
    client.release();
  }
});

router.patch("/:id/cancel-participation", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const application = await getApplicationForManager(client, req.params.id);

    if (!application) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    if (!canManageApplication(req.user, application)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Нет доступа к изменению подтверждения участия" });
    }

    if (!isPastEvent(application.start_at)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Подтверждение участия можно менять только после завершения мероприятия",
      });
    }

    if (application.status !== "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Изменять подтверждение можно только для принятой заявки",
      });
    }

    await client.query(
      `
      UPDATE applications
      SET
        participation_confirmed = FALSE,
        participation_confirmed_at = NULL,
        participation_confirmed_by = NULL
      WHERE id = $1
      `,
      [req.params.id]
    );

    await writeAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "application_participation_cancel",
      entityType: "application",
      entityId: req.params.id,
      req,
      details: {
        event_id: application.event_id,
        target_user_id: application.user_id,
        previous_participation_confirmed: application.participation_confirmed,
        new_participation_confirmed: false,
      },
      db: client,
    });

    await client.query("COMMIT");

    res.json({ message: "Подтверждение участия отменено" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cancel participation error:", error);
    res.status(500).json({ message: "Ошибка при отмене подтверждения участия" });
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

    if (application.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Отозвать можно только заявку, ожидающую решения координатора",
      });
    }

    await client.query(
      `
      DELETE FROM applications
      WHERE id = $1
      `,
      [req.params.id]
    );

    await updateEventAvailableSlots(client, application.event_id, application.participant_limit);

    await writeAuditLog({
      userId: req.user.id,
      userRole: req.user.role,
      action: "application_delete",
      entityType: "application",
      entityId: req.params.id,
      req,
      details: {
        event_id: application.event_id,
        target_user_id: application.user_id,
        previous_status: application.status,
        deleted_by_owner: true,
      },
      db: client,
    });

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
