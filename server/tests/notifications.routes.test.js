import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/testApp.js";

const mocks = vi.hoisted(() => {
  const mockClient = { query: vi.fn(), release: vi.fn() };

  return {
    mockClient,
    mockQueryQueue: [],
    currentUser: null,
    mockPool: {
      query: vi.fn(),
      connect: vi.fn(() => mockClient),
    },
    mockVerify: vi.fn(),
    mockEnsureNotificationSettings: vi.fn(),
  };
});

vi.mock("../db.js", () => ({ pool: mocks.mockPool }));
vi.mock("jsonwebtoken", () => ({ default: { verify: mocks.mockVerify } }));
vi.mock("../utils/notifications.js", () => ({
  ensureNotificationSettings: mocks.mockEnsureNotificationSettings,
}));

const notificationsRoutes = (await import("../routes/notifications.routes.js")).default;
const app = createTestApp("/api/notifications", notificationsRoutes);

function auth(role = "volunteer", id = 1) {
  mocks.currentUser = { id, role, email: `${role}@mail.ru`, is_active: true };
  mocks.mockVerify.mockReturnValue({ id, role, email: `${role}@mail.ru` });

  return { Authorization: "Bearer token" };
}

function enqueueQueryResult(result) {
  mocks.mockQueryQueue.push(result);
}

function resetMocks() {
  mocks.currentUser = null;
  mocks.mockQueryQueue.length = 0;

  mocks.mockPool.query.mockReset();
  mocks.mockPool.query.mockImplementation((sql) => {
    const queryText = String(sql);

    if (queryText.includes("FROM users") && queryText.includes("WHERE id = $1")) {
      return Promise.resolve({
        rows: mocks.currentUser ? [mocks.currentUser] : [],
      });
    }

    const result = mocks.mockQueryQueue.shift();

    if (result instanceof Error) {
      return Promise.reject(result);
    }

    return Promise.resolve(result || { rows: [] });
  });

  mocks.mockPool.connect.mockClear();
  mocks.mockClient.query.mockReset();
  mocks.mockClient.release.mockReset();
  mocks.mockVerify.mockReset();
  mocks.mockEnsureNotificationSettings.mockReset();
}

describe("notifications.routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";

    resetMocks();

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects request without token", async () => {
    const response = await request(app)
      .get("/api/notifications")
      .expect(401);

    expect(response.body).toEqual({ message: "Требуется авторизация" });
  });

  it("returns user notifications", async () => {
    const rows = [{ id: 1, title: "Новое мероприятие", is_read: false }];

    enqueueQueryResult({ rows });

    const response = await request(app)
      .get("/api/notifications")
      .set(auth("volunteer", 7))
      .expect(200);

    expect(response.body).toEqual(rows);
    expect(mocks.mockPool.query.mock.calls[1][0]).toContain("FROM notifications n");
    expect(mocks.mockPool.query.mock.calls[1][1]).toEqual([7]);
  });

  it("returns fallback error when notifications loading fails", async () => {
    enqueueQueryResult(new Error("db failed"));

    const response = await request(app)
      .get("/api/notifications")
      .set(auth())
      .expect(500);

    expect(response.body).toEqual({ message: "Не удалось получить уведомления" });
    expect(console.error).toHaveBeenCalled();
  });

  it("returns unread notifications count", async () => {
    enqueueQueryResult({ rows: [{ count: 3 }] });

    const response = await request(app)
      .get("/api/notifications/unread-count")
      .set(auth("volunteer", 5))
      .expect(200);

    expect(response.body).toEqual({ count: 3 });
    expect(mocks.mockPool.query.mock.calls[1][0]).toContain("COUNT(*)::int AS count");
    expect(mocks.mockPool.query.mock.calls[1][1]).toEqual([5]);
  });

  it("returns zero unread count when query returns empty rows", async () => {
    enqueueQueryResult({ rows: [] });

    const response = await request(app)
      .get("/api/notifications/unread-count")
      .set(auth())
      .expect(200);

    expect(response.body).toEqual({ count: 0 });
  });

  it("returns fallback error when unread count loading fails", async () => {
    enqueueQueryResult(new Error("db failed"));

    const response = await request(app)
      .get("/api/notifications/unread-count")
      .set(auth())
      .expect(500);

    expect(response.body).toEqual({
      message: "Не удалось получить количество уведомлений",
    });
  });

  it("marks notification as read", async () => {
    const notification = { id: 11, is_read: true };

    enqueueQueryResult({ rows: [notification] });

    const response = await request(app)
      .patch("/api/notifications/11/read")
      .set(auth("volunteer", 4))
      .expect(200);

    expect(response.body).toEqual(notification);
    expect(mocks.mockPool.query.mock.calls[1][1]).toEqual(["11", 4]);
  });

  it("returns 404 when read notification was not found", async () => {
    enqueueQueryResult({ rows: [] });

    const response = await request(app)
      .patch("/api/notifications/404/read")
      .set(auth())
      .expect(404);

    expect(response.body).toEqual({ message: "Уведомление не найдено" });
  });

  it("returns fallback error when marking notification as read fails", async () => {
    enqueueQueryResult(new Error("db failed"));

    const response = await request(app)
      .patch("/api/notifications/11/read")
      .set(auth())
      .expect(500);

    expect(response.body).toEqual({
      message: "Не удалось отметить уведомление прочитанным",
    });
  });

  it("marks all notifications as read", async () => {
    enqueueQueryResult({ rows: [] });

    const response = await request(app)
      .patch("/api/notifications/read-all")
      .set(auth("volunteer", 9))
      .expect(200);

    expect(response.body).toEqual({
      message: "Уведомления отмечены прочитанными",
    });
    expect(mocks.mockPool.query.mock.calls[1][1]).toEqual([9]);
  });

  it("returns fallback error when marking all notifications as read fails", async () => {
    enqueueQueryResult(new Error("db failed"));

    const response = await request(app)
      .patch("/api/notifications/read-all")
      .set(auth())
      .expect(500);

    expect(response.body).toEqual({
      message: "Не удалось отметить уведомления прочитанными",
    });
  });

  it("returns notification settings and categories", async () => {
    const settings = {
      user_id: 3,
      receive_notifications: true,
      notify_new_events: true,
      notify_coordinator_messages: true,
      notify_application_status: true,
      notify_event_assignment: true,
      notify_new_applications: true,
    };
    const categories = [{ id: 1, name: "Экология", enabled: true }];

    mocks.mockEnsureNotificationSettings.mockResolvedValue();
    enqueueQueryResult({ rows: [settings] });
    enqueueQueryResult({ rows: categories });

    const response = await request(app)
      .get("/api/notifications/settings")
      .set(auth("volunteer", 3))
      .expect(200);

    expect(response.body).toEqual({ settings, categories });
    expect(mocks.mockEnsureNotificationSettings).toHaveBeenCalledWith(3, mocks.mockPool);
  });

  it("returns fallback error when settings loading fails", async () => {
    mocks.mockEnsureNotificationSettings.mockRejectedValue(new Error("db failed"));

    const response = await request(app)
      .get("/api/notifications/settings")
      .set(auth())
      .expect(500);

    expect(response.body).toEqual({
      message: "Не удалось получить настройки уведомлений",
    });
  });

  it("updates volunteer settings and category preferences", async () => {
    const updatedSettings = { user_id: 2, receive_notifications: false };
    const categories = [{ id: 1, name: "Экология", enabled: false }];

    mocks.mockEnsureNotificationSettings.mockResolvedValue();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ role: "volunteer" }] })
      .mockResolvedValueOnce({ rows: [updatedSettings] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: categories })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .put("/api/notifications/settings")
      .set(auth("volunteer", 2))
      .send({
        receive_notifications: "false",
        notify_new_events: true,
        notify_coordinator_messages: "false",
        notify_application_status: "true",
        notify_event_assignment: false,
        notify_new_applications: "false",
        categories: [{ id: 1, enabled: "false" }],
      })
      .expect(200);

    expect(response.body).toEqual({
      message: "Настройки уведомлений сохранены",
      settings: updatedSettings,
      categories,
    });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("BEGIN");
    expect(mocks.mockClient.query.mock.calls[2][1]).toEqual([
      false,
      true,
      false,
      true,
      false,
      false,
      2,
    ]);
    expect(mocks.mockClient.query.mock.calls[3][1]).toEqual([2, 1, false]);
    expect(mocks.mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("does not update categories for coordinator settings", async () => {
    const updatedSettings = { user_id: 2, receive_notifications: true };

    mocks.mockEnsureNotificationSettings.mockResolvedValue();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ role: "coordinator" }] })
      .mockResolvedValueOnce({ rows: [updatedSettings] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await request(app)
      .put("/api/notifications/settings")
      .set(auth("coordinator", 2))
      .send({ categories: [{ id: 1, enabled: false }] })
      .expect(200);

    const categoryUpsertCall = mocks.mockClient.query.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO notification_category_settings")
    );
    expect(categoryUpsertCall).toBeUndefined();
  });

  it("rolls back when settings update fails", async () => {
    mocks.mockEnsureNotificationSettings.mockRejectedValue(new Error("db failed"));
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .put("/api/notifications/settings")
      .set(auth())
      .send({})
      .expect(500);

    expect(response.body).toEqual({
      message: "Не удалось сохранить настройки уведомлений",
    });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("forbids coordinator volunteers list for volunteer", async () => {
    const response = await request(app)
      .get("/api/notifications/coordinator-volunteers")
      .set(auth("volunteer", 1))
      .expect(403);

    expect(response.body).toEqual({
      message: "Доступ только для координатора или администратора",
    });
  });

  it("returns coordinator volunteers", async () => {
    const rows = [
      {
        id: 10,
        email: "volunteer@mail.ru",
        first_name: "Анна",
        last_name: "Иванова",
        middle_name: "",
        gender: "female",
        avatar_url: null,
        can_receive_urgent: true,
      },
    ];

    enqueueQueryResult({ rows });

    const response = await request(app)
      .get("/api/notifications/coordinator-volunteers")
      .set(auth("coordinator", 8))
      .expect(200);

    expect(response.body).toEqual(rows);
    expect(mocks.mockPool.query.mock.calls[1][1]).toEqual([8]);
  });

  it("returns fallback error when coordinator volunteers loading fails", async () => {
    enqueueQueryResult(new Error("db failed"));

    const response = await request(app)
      .get("/api/notifications/coordinator-volunteers")
      .set(auth("admin", 1))
      .expect(500);

    expect(response.body).toEqual({
      message: "Не удалось получить список волонтёров",
    });
  });
});

describe("notifications.routes coverage branches", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    resetMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("updates settings with non-array categories", async () => {
    const updatedSettings = { user_id: 2, receive_notifications: true };
    const categories = [];

    mocks.mockEnsureNotificationSettings.mockResolvedValue();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ role: "volunteer" }] })
      .mockResolvedValueOnce({ rows: [updatedSettings] })
      .mockResolvedValueOnce({ rows: categories })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .put("/api/notifications/settings")
      .set(auth("volunteer", 2))
      .send({
        receive_notifications: true,
        notify_new_events: true,
        notify_coordinator_messages: true,
        notify_application_status: true,
        notify_event_assignment: true,
        notify_new_applications: false,
        categories: "not-array",
      })
      .expect(200);

    expect(response.body).toEqual({
      message: "Настройки уведомлений сохранены",
      settings: updatedSettings,
      categories,
    });
    const categoryInsertCalls = mocks.mockClient.query.mock.calls.filter((call) =>
      String(call[0]).includes("INSERT INTO notification_category_settings")
    );
    expect(categoryInsertCalls).toHaveLength(0);
  });
});
