import { sendMail } from "./email.js";

const APP_NAME = "Рука помощи";

function getAppUrl() {
  return process.env.CLIENT_URL || "http://localhost:5173";
}

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
}

export async function ensureNotificationSettings(userId, db) {
  await db.query(
    `
    INSERT INTO notification_settings (user_id)
    VALUES ($1)
    ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );

  await db.query(
    `
    INSERT INTO notification_category_settings (user_id, category_id, enabled)
    SELECT $1, c.id, TRUE
    FROM categories c
    ON CONFLICT (user_id, category_id) DO NOTHING
    `,
    [userId]
  );
}

export async function createNotification(db, {
  userId,
  type,
  title,
  body,
  eventId = null,
  applicationId = null,
  sendEmail = true,
  ignoreNotificationSettings = false,
}) {
  await ensureNotificationSettings(userId, db);

  const result = await db.query(
    `
    INSERT INTO notifications (user_id, type, title, body, event_id, application_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [userId, type, title, body, eventId, applicationId]
  );

  if (sendEmail) {
    const userResult = ignoreNotificationSettings
      ? await db.query(
          `
          SELECT email
          FROM users
          WHERE id = $1 AND is_active = TRUE
          `,
          [userId]
        )
      : await db.query(
          `
          SELECT u.email
          FROM users u
          JOIN notification_settings ns ON ns.user_id = u.id
          WHERE u.id = $1
            AND u.is_active = TRUE
            AND ns.receive_notifications = TRUE
          `,
          [userId]
        );

    const email = userResult.rows[0]?.email;

    if (email) {
      const link = eventId ? `${getAppUrl()}/events/${eventId}` : `${getAppUrl()}/profiles/${userId}/notifications`;
      const text = `${body}\n\nОткрыть: ${link}`;
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
          <h2 style="margin: 0 0 12px;">${title}</h2>
          <p style="margin: 0 0 16px;">${body}</p>
          <a href="${link}" style="color: #1f8f35; font-weight: 700;">Открыть в приложении</a>
        </div>
      `;

      await sendMail({
        to: email,
        subject: `${APP_NAME}: ${title}`,
        text,
        html,
      });
    }
  }

  return result.rows[0];
}

export async function notifyNewEvent(db, event, options = {}) {
  const { force = false } = options;

  const result = force
    ? await db.query(
        `
        SELECT u.id
        FROM users u
        WHERE u.role = 'volunteer'
          AND u.is_active = TRUE
          AND u.id <> $1
        `,
        [event.created_by]
      )
    : await db.query(
        `
        SELECT u.id
        FROM users u
        JOIN notification_settings ns ON ns.user_id = u.id
        LEFT JOIN notification_category_settings ncs
          ON ncs.user_id = u.id AND ncs.category_id = $1
        WHERE u.role = 'volunteer'
          AND u.is_active = TRUE
          AND u.id <> $2
          AND ns.receive_notifications = TRUE
          AND ns.notify_new_events = TRUE
          AND COALESCE(ncs.enabled, TRUE) = TRUE
        `,
        [event.category_id, event.created_by]
      );

  await Promise.all(
    result.rows.map((row) =>
      createNotification(db, {
        userId: row.id,
        type: "new_event",
        title: force ? "Новое срочное мероприятие" : "Новое мероприятие",
        body: force
          ? `Появилось срочное мероприятие: «${event.title}».`
          : `Появилось новое мероприятие: «${event.title}».`,
        eventId: event.id,
        ignoreNotificationSettings: force,
      })
    )
  );
}

export async function notifyCoordinatorSelectedVolunteers(db, {
  event,
  coordinatorId,
  volunteerIds,
  urgent = false,
}) {
  const ids = normalizeIds(volunteerIds);
  if (ids.length === 0) return;

  const result = urgent
    ? await db.query(
        `
        SELECT DISTINCT u.id
        FROM users u
        JOIN applications a ON a.user_id = u.id
        JOIN events previous_event ON previous_event.id = a.event_id
        WHERE u.id = ANY($1::uuid[])
          AND u.role = 'volunteer'
          AND u.is_active = TRUE
          AND previous_event.created_by = $2
        `,
        [ids, coordinatorId]
      )
    : await db.query(
        `
        SELECT DISTINCT u.id
        FROM users u
        JOIN notification_settings ns ON ns.user_id = u.id
        JOIN applications a ON a.user_id = u.id
        JOIN events previous_event ON previous_event.id = a.event_id
        WHERE u.id = ANY($1::uuid[])
          AND u.role = 'volunteer'
          AND u.is_active = TRUE
          AND previous_event.created_by = $2
          AND ns.receive_notifications = TRUE
          AND ns.notify_coordinator_messages = TRUE
        `,
        [ids, coordinatorId]
      );

  await Promise.all(
    result.rows.map((row) =>
      createNotification(db, {
        userId: row.id,
        type: urgent ? "urgent_event" : "coordinator_event_invite",
        title: urgent ? "Срочное мероприятие" : "Уведомление от координатора",
        body: urgent
          ? `Координатор отметил для вас срочное мероприятие: «${event.title}».`
          : `Координатор приглашает вас обратить внимание на мероприятие: «${event.title}».`,
        eventId: event.id,
        ignoreNotificationSettings: urgent,
      })
    )
  );
}


export async function notifyUrgentCoordinatorVolunteers(db, {
  event,
  coordinatorId,
  volunteerIds = [],
}) {
  const ids = normalizeIds(volunteerIds);

  const params = [coordinatorId];
  let selectedCondition = "";

  if (ids.length > 0) {
    params.push(ids);
    selectedCondition = "AND u.id = ANY($2::uuid[])";
  }

  const result = await db.query(
    `
    SELECT DISTINCT u.id
    FROM users u
    JOIN applications a ON a.user_id = u.id
    JOIN events previous_event ON previous_event.id = a.event_id
    WHERE u.role = 'volunteer'
      AND u.is_active = TRUE
      AND previous_event.created_by = $1
      AND (
        a.status = 'approved'
        OR a.participation_confirmed = TRUE
      )
      ${selectedCondition}
    `,
    params
  );

  await Promise.all(
    result.rows.map((row) =>
      createNotification(db, {
        userId: row.id,
        type: "urgent_event",
        title: "Срочное мероприятие",
        body: `Появилось срочное мероприятие координатора: «${event.title}».`,
        eventId: event.id,
        ignoreNotificationSettings: true,
      })
    )
  );
}

export async function notifyNewApplication(db, applicationId) {
  const result = await db.query(
    `
    SELECT
      a.id,
      a.user_id,
      e.id AS event_id,
      e.title AS event_title,
      e.created_by AS coordinator_id,
      p.first_name,
      p.last_name,
      p.middle_name
    FROM applications a
    JOIN events e ON e.id = a.event_id
    LEFT JOIN profiles p ON p.user_id = a.user_id
    JOIN users coordinator ON coordinator.id = e.created_by
    JOIN notification_settings ns ON ns.user_id = coordinator.id
    WHERE a.id = $1
      AND coordinator.is_active = TRUE
      AND ns.receive_notifications = TRUE
      AND ns.notify_new_applications = TRUE
    `,
    [applicationId]
  );

  const data = result.rows[0];
  if (!data) return;

  const volunteerName = [data.first_name, data.middle_name, data.last_name]
    .filter(Boolean)
    .join(" ") || "Волонтёр";

  await createNotification(db, {
    userId: data.coordinator_id,
    type: "new_application",
    title: "Новая заявка",
    body: `${volunteerName} подал заявку на мероприятие «${data.event_title}».`,
    eventId: data.event_id,
    applicationId: data.id,
  });
}

export async function notifyApplicationStatus(db, applicationId, status) {
  const result = await db.query(
    `
    SELECT
      a.id,
      a.user_id,
      e.id AS event_id,
      e.title AS event_title,
      ns.receive_notifications,
      ns.notify_application_status
    FROM applications a
    JOIN events e ON e.id = a.event_id
    JOIN users u ON u.id = a.user_id
    JOIN notification_settings ns ON ns.user_id = u.id
    WHERE a.id = $1
      AND u.is_active = TRUE
      AND ns.receive_notifications = TRUE
      AND ns.notify_application_status = TRUE
    `,
    [applicationId]
  );

  const data = result.rows[0];
  if (!data) return;

  const isApproved = status === "approved";

  await createNotification(db, {
    userId: data.user_id,
    type: "application_status",
    title: isApproved ? "Заявка принята" : "Заявка отклонена",
    body: isApproved
      ? `Ваша заявка на мероприятие «${data.event_title}» принята.`
      : `Ваша заявка на мероприятие «${data.event_title}» отклонена.`,
    eventId: data.event_id,
    applicationId: data.id,
  });
}

export async function notifyCoordinatorAssignment(db, { coordinatorId, event }) {
  const result = await db.query(
    `
    SELECT u.id
    FROM users u
    JOIN notification_settings ns ON ns.user_id = u.id
    WHERE u.id = $1
      AND u.role = 'coordinator'
      AND u.is_active = TRUE
      AND ns.receive_notifications = TRUE
      AND ns.notify_event_assignment = TRUE
    `,
    [coordinatorId]
  );

  if (result.rows.length === 0) return;

  await createNotification(db, {
    userId: coordinatorId,
    type: "event_assignment",
    title: "Назначение координатором",
    body: `Вы назначены координатором мероприятия «${event.title}».`,
    eventId: event.id,
  });
}
