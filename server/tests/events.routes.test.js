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

const eventsRoutes = (await import("../routes/events.routes.js")).default;
const app = createTestApp("/api/events", eventsRoutes);

const validEventBody = {
  title: "Субботник",
  image_url: "",
  description: "Описание",
  start_at: "2099-05-10T10:30:00.000Z",
  location: "Парк",
  tasks: ["Собрать мусор"],
  participant_limit: 20,
  duration_minutes: 120,
  category_id: 1,
};

function auth(role = "coordinator", id = 1) {
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

describe("events.routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    resetMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns events without category filter", async () => {
    const rows = [{ id: 1, title: "Субботник" }];
    mocks.mockPool.query.mockResolvedValue({ rows });

    const response = await request(app).get("/api/events").expect(200);

    expect(response.body).toEqual(rows);
    expect(mocks.mockPool.query.mock.calls[0][1]).toEqual([]);
  });

  it("returns events with category filter", async () => {
    mocks.mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/events?category=Экология").expect(200);

    expect(mocks.mockPool.query.mock.calls[0][0]).toContain("WHERE c.name = $1");
    expect(mocks.mockPool.query.mock.calls[0][1]).toEqual(["Экология"]);
  });

  it("returns 500 when events loading fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db failed"));

    const response = await request(app).get("/api/events").expect(500);

    expect(response.body).toEqual({ message: "Не удалось получить мероприятия" });
  });

  it("returns event by id and hides contacts for guest", async () => {
    const event = { id: 1, creator_id: 2, email: "c@mail.ru", phone: "+7" };
    mocks.mockPool.query.mockResolvedValueOnce({ rows: [event] });

    const response = await request(app).get("/api/events/1").expect(200);

    expect(response.body).toEqual({ ...event, email: null, phone: null });
  });

  it("returns event by id and shows contacts for admin", async () => {
    const event = { id: 1, creator_id: 2, email: "c@mail.ru", phone: "+7" };
    mocks.mockVerify.mockReturnValue({ id: 10, role: "admin" });
    mocks.mockPool.query.mockResolvedValueOnce({ rows: [event] });

    const response = await request(app)
      .get("/api/events/1")
      .set("Authorization", "Bearer token")
      .expect(200);

    expect(response.body).toEqual(event);
  });

  it("shows contacts for approved volunteer", async () => {
    const event = { id: 1, creator_id: 2, email: "c@mail.ru", phone: "+7" };
    mocks.mockVerify.mockReturnValue({ id: 3, role: "volunteer" });
    mocks.mockPool.query
      .mockResolvedValueOnce({ rows: [event] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const response = await request(app)
      .get("/api/events/1")
      .set("Authorization", "Bearer token")
      .expect(200);

    expect(response.body).toEqual(event);
  });

  it("returns 404 when event by id was not found", async () => {
    mocks.mockPool.query.mockResolvedValue({ rows: [] });

    const response = await request(app).get("/api/events/404").expect(404);

    expect(response.body).toEqual({ message: "Мероприятие не найдено" });
  });

  it("creates event for coordinator", async () => {
    const event = { id: 1, ...validEventBody, image_url: null, created_by: 1 };
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [event] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/events")
      .set(auth())
      .send(validEventBody)
      .expect(201);

    expect(response.body).toEqual({ message: "Мероприятие создано", event });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "event_create", entityType: "event", db: mocks.mockClient })
    );
    expect(mocks.mockClient.query).toHaveBeenCalledWith("COMMIT");
  });

  it("rejects event creation for volunteer", async () => {
    const response = await request(app)
      .post("/api/events")
      .set(auth("volunteer"))
      .send(validEventBody)
      .expect(403);

    expect(response.body.message).toMatch(/координатор или администратор/i);
    expect(mocks.mockPool.connect).not.toHaveBeenCalled();
  });

  it("validates required event create fields", async () => {
    const response = await request(app)
      .post("/api/events")
      .set(auth())
      .send({ ...validEventBody, title: "" })
      .expect(400);

    expect(response.body).toEqual({ message: "Не все обязательные поля заполнены" });
  });

  it("updates event when manager is owner", async () => {
    const updated = { id: 1, title: "Новое" };
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, created_by: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, title: "Старое" }] })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [updated] })
      .mockResolvedValueOnce({ rows: [updated] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .put("/api/events/1")
      .set(auth("coordinator", 1))
      .send({ ...validEventBody, title: "Новое" })
      .expect(200);

    expect(response.body).toEqual({ message: "Мероприятие обновлено", event: updated });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "event_update", entityType: "event" })
    );
  });

  it("forbids update for non-owner coordinator", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, created_by: 99 }] });

    const response = await request(app)
      .put("/api/events/1")
      .set(auth("coordinator", 1))
      .send(validEventBody)
      .expect(403);

    expect(response.body).toEqual({ message: "Нет доступа к редактированию этого мероприятия" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("rejects participant limit lower than approved count", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, created_by: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] });

    const response = await request(app)
      .put("/api/events/1")
      .set(auth("coordinator", 1))
      .send({ ...validEventBody, participant_limit: 2 })
      .expect(400);

    expect(response.body.message).toMatch(/нельзя установить лимит/i);
  });

  it("deletes event when admin manages it", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, created_by: 99 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, title: "Субботник" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .delete("/api/events/1")
      .set(auth("admin", 10))
      .expect(200);

    expect(response.body).toEqual({ message: "Мероприятие удалено" });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "event_delete" })
    );
  });

  it("treats invalid optional viewer token as guest on event details", async () => {
    const event = {
      id: 1,
      creator_id: 2,
      email: "coord@mail.ru",
      phone: "+7 (900) 000-00-00",
    };
  
    mocks.mockVerify.mockImplementation(() => {
      throw new Error("invalid token");
    });
  
    mocks.mockPool.query.mockResolvedValueOnce({ rows: [event] });
  
    const response = await request(app)
      .get("/api/events/1")
      .set("Authorization", "Bearer broken-token")
      .expect(200);
  
    expect(response.body).toEqual({
      ...event,
      email: null,
      phone: null,
    });
  });
  
  it("shows coordinator contacts to event creator", async () => {
    const event = {
      id: 1,
      creator_id: 2,
      email: "coord@mail.ru",
      phone: "+7 (900) 000-00-00",
    };
  
    mocks.mockVerify.mockReturnValue({ id: 2, role: "coordinator" });
    mocks.mockPool.query.mockResolvedValueOnce({ rows: [event] });
  
    const response = await request(app)
      .get("/api/events/1")
      .set("Authorization", "Bearer token")
      .expect(200);
  
    expect(response.body).toEqual(event);
  });
  
  it("hides coordinator contacts from unrelated coordinator", async () => {
    const event = {
      id: 1,
      creator_id: 99,
      email: "coord@mail.ru",
      phone: "+7 (900) 000-00-00",
    };
  
    mocks.mockVerify.mockReturnValue({ id: 2, role: "coordinator" });
    mocks.mockPool.query.mockResolvedValueOnce({ rows: [event] });
  
    const response = await request(app)
      .get("/api/events/1")
      .set("Authorization", "Bearer token")
      .expect(200);
  
    expect(response.body).toEqual({
      ...event,
      email: null,
      phone: null,
    });
  });
  
  it("returns 500 when event details loading fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db failed"));
  
    const response = await request(app).get("/api/events/1").expect(500);
  
    expect(response.body).toEqual({
      message: "Ошибка при получении мероприятия",
    });
  });
  
  it("rolls back when event creation fails", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("insert failed"));
  
    const response = await request(app)
      .post("/api/events")
      .set(auth("coordinator", 1))
      .send(validEventBody)
      .expect(500);
  
    expect(response.body).toEqual({
      message: "Ошибка при создании мероприятия",
    });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });
  
  it("rejects event update for volunteer before opening transaction", async () => {
    const response = await request(app)
      .put("/api/events/1")
      .set(auth("volunteer", 1))
      .send(validEventBody)
      .expect(403);
  
    expect(response.body).toEqual({
      message: "Только координатор или администратор может редактировать мероприятия",
    });
    expect(mocks.mockPool.connect).not.toHaveBeenCalled();
  });
  
  it("validates required event update fields before opening transaction", async () => {
    const response = await request(app)
      .put("/api/events/1")
      .set(auth("coordinator", 1))
      .send({ ...validEventBody, description: "" })
      .expect(400);
  
    expect(response.body).toEqual({
      message: "Не все обязательные поля заполнены",
    });
    expect(mocks.mockPool.connect).not.toHaveBeenCalled();
  });
  
  it("returns 404 when updated event does not exist", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
  
    const response = await request(app)
      .put("/api/events/404")
      .set(auth("coordinator", 1))
      .send(validEventBody)
      .expect(404);
  
    expect(response.body).toEqual({ message: "Мероприятие не найдено" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });
  
  it("updates event when active applications count query returns empty rows", async () => {
    const oldEvent = { id: 1, title: "Старое" };
    const updatedEvent = { id: 1, title: "Новое", available_slots: 20 };
  
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, created_by: 1 }] })
      .mockResolvedValueOnce({ rows: [oldEvent] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [updatedEvent] })
      .mockResolvedValueOnce({ rows: [updatedEvent] })
      .mockResolvedValueOnce({ rows: [] });
  
    const response = await request(app)
      .put("/api/events/1")
      .set(auth("coordinator", 1))
      .send({ ...validEventBody, title: "Новое" })
      .expect(200);
  
    expect(response.body).toEqual({
      message: "Мероприятие обновлено",
      event: updatedEvent,
    });
  
    const updateCall = mocks.mockClient.query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE events")
    );
  
    expect(updateCall[1][8]).toBe(20);
  });
  
  it("rolls back when event update fails", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, created_by: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, title: "Старое" }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockRejectedValueOnce(new Error("update failed"));
  
    const response = await request(app)
      .put("/api/events/1")
      .set(auth("coordinator", 1))
      .send(validEventBody)
      .expect(500);
  
    expect(response.body).toEqual({
      message: "Ошибка при обновлении мероприятия",
    });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });
  
  it("rejects event delete for volunteer before opening transaction", async () => {
    const response = await request(app)
      .delete("/api/events/1")
      .set(auth("volunteer", 1))
      .expect(403);
  
    expect(response.body).toEqual({
      message: "Только координатор или администратор может удалять мероприятия",
    });
    expect(mocks.mockPool.connect).not.toHaveBeenCalled();
  });
  
  it("returns 404 when deleted event does not exist", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
  
    const response = await request(app)
      .delete("/api/events/404")
      .set(auth("coordinator", 1))
      .expect(404);
  
    expect(response.body).toEqual({ message: "Мероприятие не найдено" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });
  
  it("forbids event delete for non-owner coordinator", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, created_by: 99 }] });
  
    const response = await request(app)
      .delete("/api/events/1")
      .set(auth("coordinator", 1))
      .expect(403);
  
    expect(response.body).toEqual({
      message: "Нет доступа к удалению этого мероприятия",
    });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });
  
  it("rolls back when event delete fails", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, created_by: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, title: "Субботник" }] })
      .mockRejectedValueOnce(new Error("delete failed"));
  
    const response = await request(app)
      .delete("/api/events/1")
      .set(auth("coordinator", 1))
      .expect(500);
  
    expect(response.body).toEqual({
      message: "Ошибка при удалении мероприятия",
    });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });
});
