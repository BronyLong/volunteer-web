import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSendMail: vi.fn(),
  mockDecryptEmail: vi.fn((value) => value),
  mockDecryptProfilePersonalFields: vi.fn((value) => value),
}));

vi.mock("../utils/email.js", () => ({ sendMail: mocks.mockSendMail }));
vi.mock("../utils/personalData.js", () => ({
  decryptEmail: mocks.mockDecryptEmail,
  decryptProfilePersonalFields: mocks.mockDecryptProfilePersonalFields,
}));

const notifications = await import("../utils/notifications.js");

function createDb() {
  return {
    query: vi.fn(),
  };
}

function mockEnsureAndInsert(db, notification = { id: 1, title: "Уведомление" }) {
  db.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [notification] });
}

describe("notifications util", () => {
  beforeEach(() => {
    process.env.CLIENT_URL = "http://client.test";
    mocks.mockSendMail.mockReset();
    mocks.mockDecryptEmail.mockClear();
    mocks.mockDecryptProfilePersonalFields.mockClear();
  });

  it("ensures notification settings and category settings", async () => {
    const db = createDb();
    db.query.mockResolvedValue({ rows: [] });

    await notifications.ensureNotificationSettings(7, db);

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][0]).toContain("INSERT INTO notification_settings");
    expect(db.query.mock.calls[0][1]).toEqual([7]);
    expect(db.query.mock.calls[1][0]).toContain("INSERT INTO notification_category_settings");
    expect(db.query.mock.calls[1][1]).toEqual([7]);
  });

  it("creates notification and sends email with event link", async () => {
    const db = createDb();
    const notification = { id: 10, user_id: 5, event_id: 9 };
    mockEnsureAndInsert(db, notification);
    db.query.mockResolvedValueOnce({ rows: [{ email: "user@mail.ru" }] });

    const result = await notifications.createNotification(db, {
      userId: 5,
      type: "new_event",
      title: "Новое мероприятие",
      body: "Появилось новое мероприятие",
      eventId: 9,
      applicationId: 2,
    });

    expect(result).toEqual(notification);
    expect(db.query.mock.calls[2][1]).toEqual([
      5,
      "new_event",
      "Новое мероприятие",
      "Появилось новое мероприятие",
      9,
      2,
    ]);
    expect(mocks.mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@mail.ru",
        subject: "Рука помощи: Новое мероприятие",
        text: expect.stringContaining("http://client.test/events/9"),
        html: expect.stringContaining("http://client.test/events/9"),
      })
    );
  });

  it("creates notification without sending email", async () => {
    const db = createDb();
    const notification = { id: 10 };
    mockEnsureAndInsert(db, notification);

    const result = await notifications.createNotification(db, {
      userId: 5,
      type: "system",
      title: "Заголовок",
      body: "Текст",
      sendEmail: false,
    });

    expect(result).toEqual(notification);
    expect(db.query).toHaveBeenCalledTimes(3);
    expect(mocks.mockSendMail).not.toHaveBeenCalled();
  });

  it("uses notification page link when event id is missing", async () => {
    const db = createDb();
    mockEnsureAndInsert(db, { id: 1 });
    db.query.mockResolvedValueOnce({ rows: [{ email: "user@mail.ru" }] });

    await notifications.createNotification(db, {
      userId: 5,
      type: "system",
      title: "Заголовок",
      body: "Текст",
    });

    expect(mocks.mockSendMail.mock.calls[0][0].text).toContain(
      "http://client.test/profiles/5/notifications"
    );
  });

  it("does not send email when user email is missing", async () => {
    const db = createDb();
    mockEnsureAndInsert(db, { id: 1 });
    db.query.mockResolvedValueOnce({ rows: [] });

    await notifications.createNotification(db, {
      userId: 5,
      type: "system",
      title: "Заголовок",
      body: "Текст",
    });

    expect(mocks.mockSendMail).not.toHaveBeenCalled();
  });

  it("notifies volunteers about new regular event", async () => {
    const db = createDb();
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 2 }, { id: 3 }] })
      .mockResolvedValue({ rows: [] });

    await notifications.notifyNewEvent(db, {
      id: 9,
      title: "Субботник",
      category_id: 1,
      created_by: 1,
    });

    expect(db.query.mock.calls[0][0]).toContain("JOIN notification_settings");
    expect(db.query.mock.calls[0][1]).toEqual([1, 1]);
    const insertCalls = db.query.mock.calls.filter((call) =>
      String(call[0]).includes("INSERT INTO notifications")
    );
    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0][1]).toEqual([
      2,
      "new_event",
      "Новое мероприятие",
      "Появилось новое мероприятие: «Субботник».",
      9,
      null,
    ]);
  });

  it("notifies volunteers about urgent event ignoring settings", async () => {
    const db = createDb();
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValue({ rows: [] });

    await notifications.notifyNewEvent(
      db,
      { id: 9, title: "Срочный выезд", category_id: 1, created_by: 1 },
      { force: true }
    );

    expect(db.query.mock.calls[0][0]).not.toContain("notification_settings");
    const insertCall = db.query.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO notifications")
    );
    expect(insertCall[1]).toEqual([
      2,
      "new_event",
      "Новое срочное мероприятие",
      "Появилось срочное мероприятие: «Срочный выезд».",
      9,
      null,
    ]);
  });

  it("does not notify selected volunteers when ids are empty", async () => {
    const db = createDb();

    await notifications.notifyCoordinatorSelectedVolunteers(db, {
      event: { id: 1, title: "Субботник" },
      coordinatorId: 2,
      volunteerIds: ["", null, "  "],
    });

    expect(db.query).not.toHaveBeenCalled();
  });

  it("normalizes selected volunteer ids and sends coordinator invite", async () => {
    const db = createDb();
    db.query.mockResolvedValueOnce({ rows: [{ id: "v1" }] }).mockResolvedValue({ rows: [] });

    await notifications.notifyCoordinatorSelectedVolunteers(db, {
      event: { id: 8, title: "Сбор вещей" },
      coordinatorId: "c1",
      volunteerIds: ["v1", " v1 ", "v2"],
    });

    expect(db.query.mock.calls[0][1]).toEqual([["v1", "v2"], "c1"]);
    const insertCall = db.query.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO notifications")
    );
    expect(insertCall[1]).toEqual([
      "v1",
      "coordinator_event_invite",
      "Уведомление от координатора",
      "Координатор приглашает вас обратить внимание на мероприятие: «Сбор вещей».",
      8,
      null,
    ]);
  });

  it("sends urgent selected volunteer notification", async () => {
    const db = createDb();
    db.query.mockResolvedValueOnce({ rows: [{ id: "v1" }] }).mockResolvedValue({ rows: [] });

    await notifications.notifyCoordinatorSelectedVolunteers(db, {
      event: { id: 8, title: "Срочно" },
      coordinatorId: "c1",
      volunteerIds: ["v1"],
      urgent: true,
    });

    expect(db.query.mock.calls[0][0]).not.toContain("notify_coordinator_messages");
    const insertCall = db.query.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO notifications")
    );
    expect(insertCall[1][1]).toBe("urgent_event");
    expect(insertCall[1][2]).toBe("Срочное мероприятие");
  });

  it("notifies urgent coordinator volunteers without selected filter", async () => {
    const db = createDb();
    db.query.mockResolvedValueOnce({ rows: [{ id: "v1" }] }).mockResolvedValue({ rows: [] });

    await notifications.notifyUrgentCoordinatorVolunteers(db, {
      event: { id: 8, title: "Срочно" },
      coordinatorId: "c1",
    });

    expect(db.query.mock.calls[0][1]).toEqual(["c1"]);
    expect(db.query.mock.calls[0][0]).not.toContain("ANY($2::uuid[])");
  });

  it("notifies urgent coordinator volunteers with selected filter", async () => {
    const db = createDb();
    db.query.mockResolvedValueOnce({ rows: [{ id: "v1" }] }).mockResolvedValue({ rows: [] });

    await notifications.notifyUrgentCoordinatorVolunteers(db, {
      event: { id: 8, title: "Срочно" },
      coordinatorId: "c1",
      volunteerIds: ["v1"],
    });

    expect(db.query.mock.calls[0][1]).toEqual(["c1", ["v1"]]);
    expect(db.query.mock.calls[0][0]).toContain("AND u.id = ANY($2::uuid[])");
  });

  it("notifies coordinator about new application", async () => {
    const db = createDb();
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 4,
            user_id: 7,
            event_id: 8,
            event_title: "Субботник",
            coordinator_id: 2,
            first_name: "Иван",
            last_name: "Петров",
          },
        ],
      })
      .mockResolvedValue({ rows: [] });

    await notifications.notifyNewApplication(db, 4);

    expect(mocks.mockDecryptProfilePersonalFields).toHaveBeenCalled();
    const insertCall = db.query.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO notifications")
    );
    expect(insertCall[1]).toEqual([
      2,
      "new_application",
      "Новая заявка",
      "Поступила новая заявка на мероприятие «Субботник».",
      8,
      4,
    ]);
  });

  it("does not notify coordinator when new application data is missing", async () => {
    const db = createDb();
    db.query.mockResolvedValueOnce({ rows: [] });

    await notifications.notifyNewApplication(db, 4);

    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it("notifies volunteer about approved application status", async () => {
    const db = createDb();
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 4, user_id: 7, event_id: 8, event_title: "Субботник" }],
      })
      .mockResolvedValue({ rows: [] });

    await notifications.notifyApplicationStatus(db, 4, "approved");

    const insertCall = db.query.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO notifications")
    );
    expect(insertCall[1]).toEqual([
      7,
      "application_status",
      "Заявка принята",
      "Ваша заявка на мероприятие «Субботник» принята.",
      8,
      4,
    ]);
  });

  it("notifies volunteer about rejected application status", async () => {
    const db = createDb();
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 4, user_id: 7, event_id: 8, event_title: "Субботник" }],
      })
      .mockResolvedValue({ rows: [] });

    await notifications.notifyApplicationStatus(db, 4, "rejected");

    const insertCall = db.query.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO notifications")
    );
    expect(insertCall[1][2]).toBe("Заявка отклонена");
    expect(insertCall[1][3]).toBe("Ваша заявка на мероприятие «Субботник» отклонена.");
  });

  it("does not notify application status when data is missing", async () => {
    const db = createDb();
    db.query.mockResolvedValueOnce({ rows: [] });

    await notifications.notifyApplicationStatus(db, 4, "approved");

    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it("notifies coordinator about assignment", async () => {
    const db = createDb();
    db.query.mockResolvedValueOnce({ rows: [{ id: 2 }] }).mockResolvedValue({ rows: [] });

    await notifications.notifyCoordinatorAssignment(db, {
      coordinatorId: 2,
      event: { id: 8, title: "Субботник" },
    });

    const insertCall = db.query.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO notifications")
    );
    expect(insertCall[1]).toEqual([
      2,
      "event_assignment",
      "Назначение координатором",
      "Вы назначены координатором мероприятия «Субботник».",
      8,
      null,
    ]);
  });

  it("does not notify coordinator assignment when settings reject it", async () => {
    const db = createDb();
    db.query.mockResolvedValueOnce({ rows: [] });

    await notifications.notifyCoordinatorAssignment(db, {
      coordinatorId: 2,
      event: { id: 8, title: "Субботник" },
    });

    expect(db.query).toHaveBeenCalledTimes(1);
  });
});

describe("notifications util coverage branches", () => {
  beforeEach(() => {
    delete process.env.CLIENT_URL;
    mocks.mockSendMail.mockReset();
    mocks.mockDecryptEmail.mockClear();
    mocks.mockDecryptProfilePersonalFields.mockClear();
  });

  it("uses default app url when client url is not configured", async () => {
    const db = createDb();
    mockEnsureAndInsert(db, { id: 1 });
    db.query.mockResolvedValueOnce({ rows: [{ email: "user@mail.ru" }] });

    await notifications.createNotification(db, {
      userId: 5,
      type: "system",
      title: "Заголовок",
      body: "Текст",
    });

    expect(mocks.mockSendMail.mock.calls[0][0].text).toContain(
      "http://localhost:5173/profiles/5/notifications"
    );
  });

  it("does not notify selected volunteers when ids are not an array", async () => {
    const db = createDb();

    await notifications.notifyCoordinatorSelectedVolunteers(db, {
      event: { id: 1, title: "Субботник" },
      coordinatorId: 2,
      volunteerIds: "not-array",
    });

    expect(db.query).not.toHaveBeenCalled();
  });
});
