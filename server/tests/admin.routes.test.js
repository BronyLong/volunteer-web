import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/testApp.js";

const mocks = vi.hoisted(() => {
  const mockClient = { query: vi.fn(), release: vi.fn() };
  return {
    mockClient,
    mockPool: {
      query: vi.fn(),
      connect: vi.fn(() => mockClient),
    },
    mockVerify: vi.fn(),
    mockWriteAuditLog: vi.fn(),
  };
});

vi.mock("../db.js", () => ({ pool: mocks.mockPool }));
vi.mock("../utils/audit.js", () => ({ writeAuditLog: mocks.mockWriteAuditLog }));
vi.mock("jsonwebtoken", () => ({ default: { verify: mocks.mockVerify } }));

const adminRoutes = (await import("../routes/admin.routes.js")).default;
const app = createTestApp("/api/admin", adminRoutes);

function auth(role = "admin", id = 1) {
  mocks.mockVerify.mockReturnValue({ id, role, email: `${role}@mail.ru` });
  return { Authorization: "Bearer token" };
}

function resetMocks() {
  mocks.mockPool.query.mockReset();
  mocks.mockPool.connect.mockClear();
  mocks.mockClient.query.mockReset();
  mocks.mockClient.release.mockReset();
  mocks.mockVerify.mockReset();
  mocks.mockWriteAuditLog.mockReset();
}

describe("admin.routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    resetMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects request without token", async () => {
    const response = await request(app).get("/api/admin/users").expect(401);

    expect(response.body).toEqual({ message: "Требуется авторизация" });
  });

  it("rejects non-admin user", async () => {
    const response = await request(app)
      .get("/api/admin/users")
      .set(auth("coordinator", 2))
      .expect(403);

    expect(response.body).toEqual({ message: "Доступ только для администратора" });
  });

  it("returns admin users", async () => {
    const rows = [{ id: 1, email: "admin@mail.ru", role: "admin" }];
    mocks.mockPool.query.mockResolvedValue({ rows });

    const response = await request(app)
      .get("/api/admin/users")
      .set(auth())
      .expect(200);

    expect(response.body).toEqual(rows);
    expect(mocks.mockPool.query.mock.calls[0][0]).toContain("FROM users u");
  });

  it("returns 500 when users loading fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db failed"));

    const response = await request(app)
      .get("/api/admin/users")
      .set(auth())
      .expect(500);

    expect(response.body).toEqual({ message: "Не удалось получить пользователей" });
  });

  it("updates user role and writes audit log", async () => {
    const user = { id: 7, email: "user@mail.ru", role: "coordinator" };
    mocks.mockPool.query.mockResolvedValue({ rows: [user] });

    const response = await request(app)
      .patch("/api/admin/users/7/role")
      .set(auth())
      .send({ role: "coordinator" })
      .expect(200);

    expect(response.body).toEqual(user);
    expect(mocks.mockPool.query.mock.calls[0][1]).toEqual(["coordinator", "7"]);
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin_user_role_update", entityType: "user", entityId: "7" })
    );
  });

  it("validates user role", async () => {
    const response = await request(app)
      .patch("/api/admin/users/7/role")
      .set(auth())
      .send({ role: "owner" })
      .expect(400);

    expect(response.body).toEqual({ message: "Некорректная роль пользователя" });
  });

  it("returns 404 when user role target does not exist", async () => {
    mocks.mockPool.query.mockResolvedValue({ rows: [] });

    const response = await request(app)
      .patch("/api/admin/users/404/role")
      .set(auth())
      .send({ role: "admin" })
      .expect(404);

    expect(response.body).toEqual({ message: "Пользователь не найден" });
  });

  it("returns 500 when role update fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db failed"));

    const response = await request(app)
      .patch("/api/admin/users/7/role")
      .set(auth())
      .send({ role: "admin" })
      .expect(500);

    expect(response.body).toEqual({ message: "Не удалось изменить роль пользователя" });
  });

  it("updates active status from string value", async () => {
    const user = { id: 7, email: "user@mail.ru", is_active: false };
    mocks.mockPool.query.mockResolvedValue({ rows: [user] });

    const response = await request(app)
      .patch("/api/admin/users/7/active")
      .set(auth())
      .send({ is_active: "false" })
      .expect(200);

    expect(response.body).toEqual(user);
    expect(mocks.mockPool.query.mock.calls[0][1]).toEqual([false, "7"]);
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin_user_deactivate" })
    );
  });

  it("validates active status", async () => {
    const response = await request(app)
      .patch("/api/admin/users/7/active")
      .set(auth())
      .send({ is_active: "maybe" })
      .expect(400);

    expect(response.body).toEqual({ message: "Некорректный статус активности" });
  });

  it("returns admin events", async () => {
    const rows = [{ id: 9, title: "Субботник" }];
    mocks.mockPool.query.mockResolvedValue({ rows });

    const response = await request(app)
      .get("/api/admin/events")
      .set(auth())
      .expect(200);

    expect(response.body).toEqual(rows);
  });

  it("assigns coordinator to event inside transaction", async () => {
    const event = { id: 9, created_by: 2, title: "Субботник" };
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 2, role: "coordinator" }] })
      .mockResolvedValueOnce({ rows: [event] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/admin/events/9/coordinator")
      .set(auth())
      .send({ coordinator_id: 2 })
      .expect(200);

    expect(response.body).toEqual(event);
    expect(mocks.mockClient.query).toHaveBeenCalledWith("BEGIN");
    expect(mocks.mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin_event_coordinator_update", db: mocks.mockClient })
    );
  });

  it("validates coordinator_id", async () => {
    const response = await request(app)
      .patch("/api/admin/events/9/coordinator")
      .set(auth())
      .send({})
      .expect(400);

    expect(response.body).toEqual({ message: "Не указан координатор" });
    expect(mocks.mockPool.connect).not.toHaveBeenCalled();
  });

  it("returns 404 when coordinator was not found", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/admin/events/9/coordinator")
      .set(auth())
      .send({ coordinator_id: 404 })
      .expect(404);

    expect(response.body).toEqual({ message: "Координатор не найден" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("rejects non-coordinator assignment", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 2, role: "volunteer" }] });

    const response = await request(app)
      .patch("/api/admin/events/9/coordinator")
      .set(auth())
      .send({ coordinator_id: 2 })
      .expect(400);

    expect(response.body.message).toMatch(/только пользователя с ролью координатора/i);
  });

  it("returns 404 when event for coordinator assignment was not found", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 2, role: "coordinator" }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/admin/events/9/coordinator")
      .set(auth())
      .send({ coordinator_id: 2 })
      .expect(404);

    expect(response.body).toEqual({ message: "Мероприятие не найдено" });
  });

  it("returns 500 when coordinator assignment fails", async () => {
    mocks.mockClient.query.mockRejectedValueOnce(new Error("db failed"));

    const response = await request(app)
      .patch("/api/admin/events/9/coordinator")
      .set(auth())
      .send({ coordinator_id: 2 })
      .expect(500);

    expect(response.body).toEqual({ message: "Не удалось назначить координатора" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("returns audit logs without filters", async () => {
    const rows = [{ id: 1, action: "login" }];
    mocks.mockPool.query.mockResolvedValue({ rows });

    const response = await request(app)
      .get("/api/admin/logs")
      .set(auth())
      .expect(200);

    expect(response.body).toEqual(rows);
    expect(mocks.mockPool.query.mock.calls[0][1]).toEqual([]);
  });

  it("returns audit logs with non-empty allowed filters", async () => {
    mocks.mockPool.query.mockResolvedValue({ rows: [] });

    await request(app)
      .get("/api/admin/logs?user_id=1&action=UPDATE&status=&unknown=x")
      .set(auth())
      .expect(200);

    expect(mocks.mockPool.query.mock.calls[0][0]).toContain("WHERE user_id::text = $1 AND action::text = $2");
    expect(mocks.mockPool.query.mock.calls[0][1]).toEqual(["1", "UPDATE"]);
  });

  it("returns 500 when logs loading fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db failed"));

    const response = await request(app)
      .get("/api/admin/logs")
      .set(auth())
      .expect(500);

    expect(response.body).toEqual({ message: "Не удалось получить логи" });
  });

  it("returns 404 when active status target user does not exist", async () => {
    mocks.mockPool.query.mockResolvedValue({ rows: [] });
  
    const response = await request(app)
      .patch("/api/admin/users/404/active")
      .set(auth())
      .send({ is_active: true })
      .expect(404);
  
    expect(response.body).toEqual({ message: "Пользователь не найден" });
  });
  
  it("updates active status to true and writes activate audit action", async () => {
    const user = {
      id: 7,
      email: "user@mail.ru",
      role: "volunteer",
      is_active: true,
      created_at: "2024-01-01T10:00:00.000Z",
    };
  
    mocks.mockPool.query.mockResolvedValue({ rows: [user] });
  
    const response = await request(app)
      .patch("/api/admin/users/7/active")
      .set(auth())
      .send({ is_active: true })
      .expect(200);
  
    expect(response.body).toEqual(user);
    expect(mocks.mockPool.query.mock.calls[0][1]).toEqual([true, "7"]);
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_user_activate",
        entityType: "user",
        entityId: "7",
        details: { is_active: true },
      })
    );
  });
  
  it("returns 500 when active status update fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db failed"));
  
    const response = await request(app)
      .patch("/api/admin/users/7/active")
      .set(auth())
      .send({ is_active: false })
      .expect(500);
  
    expect(response.body).toEqual({
      message: "Не удалось изменить статус пользователя",
    });
  });
  
  it("returns 500 when admin events loading fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db failed"));
  
    const response = await request(app)
      .get("/api/admin/events")
      .set(auth())
      .expect(500);
  
    expect(response.body).toEqual({
      message: "Не удалось получить мероприятия",
    });
  });
});
