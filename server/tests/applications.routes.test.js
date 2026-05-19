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
    mockNotifyNewApplication: vi.fn(),
    mockNotifyApplicationStatus: vi.fn(),
  };
});

vi.mock("../db.js", () => ({ pool: mocks.mockPool }));
vi.mock("../utils/audit.js", () => ({ writeAuditLog: mocks.mockWriteAuditLog }));

vi.mock("../utils/notifications.js", () => ({
  notifyNewApplication: mocks.mockNotifyNewApplication,
  notifyApplicationStatus: mocks.mockNotifyApplicationStatus,
}));
vi.mock("jsonwebtoken", () => ({ default: { verify: mocks.mockVerify } }));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Требуется авторизация" });
    }

    try {
      req.user = mocks.mockVerify(authHeader.split(" ")[1], process.env.JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ message: "Недействительный токен" });
    }
  },
}));

const applicationsRoutes = (await import("../routes/applications.routes.js")).default;
const app = createTestApp("/api/applications", applicationsRoutes);

function auth(role = "volunteer", id = 1) {
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
  mocks.mockNotifyNewApplication.mockReset();
  mocks.mockNotifyNewApplication.mockResolvedValue(undefined);
  mocks.mockNotifyApplicationStatus.mockReset();
  mocks.mockNotifyApplicationStatus.mockResolvedValue(undefined);
}

describe("applications.routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    resetMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("creates application for volunteer", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();
    const application = { id: 10, user_id: 1, event_id: 5, status: "pending" };

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 5, created_by: 2, participant_limit: 10, start_at: future }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [application] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/applications")
      .set(auth("volunteer", 1))
      .send({ event_id: 5 })
      .expect(201);

    expect(response.body).toEqual({
      message: "Заявка отправлена и ожидает решения координатора",
      application,
    });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "application_create", entityType: "application" })
    );
  });

  it("validates event_id", async () => {
    const response = await request(app)
      .post("/api/applications")
      .set(auth())
      .send({})
      .expect(400);

    expect(response.body).toEqual({ message: "event_id обязателен" });
  });

  it("forbids application creation for non-volunteer", async () => {
    const response = await request(app)
      .post("/api/applications")
      .set(auth("coordinator", 2))
      .send({ event_id: 5 })
      .expect(403);

    expect(response.body.message).toMatch(/только волонтёр/i);
  });

  it("returns 404 when event for application does not exist", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/applications")
      .set(auth())
      .send({ event_id: 404 })
      .expect(404);

    expect(response.body).toEqual({ message: "Мероприятие не найдено" });
  });

  it("rejects application to own event", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 5, created_by: 1, participant_limit: 10, start_at: future }] });

    const response = await request(app)
      .post("/api/applications")
      .set(auth("volunteer", 1))
      .send({ event_id: 5 })
      .expect(400);

    expect(response.body).toEqual({ message: "Нельзя подать заявку на собственное мероприятие" });
  });

  it("rejects application to past event", async () => {
    const past = new Date(Date.now() - 1000000).toISOString();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 5, created_by: 2, participant_limit: 10, start_at: past }] });

    const response = await request(app)
      .post("/api/applications")
      .set(auth())
      .send({ event_id: 5 })
      .expect(400);

    expect(response.body).toEqual({ message: "Нельзя подать заявку на завершённое мероприятие" });
  });

  it("rejects duplicate active application", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 5, created_by: 2, participant_limit: 10, start_at: future }] })
      .mockResolvedValueOnce({ rows: [{ id: 9, status: "approved" }] });

    const response = await request(app)
      .post("/api/applications")
      .set(auth())
      .send({ event_id: 5 })
      .expect(409);

    expect(response.body).toEqual({ message: "Вы уже участвуете в этом мероприятии" });
  });

  it("returns my applications", async () => {
    const rows = [{ id: 1, status: "pending", event_id: 5 }];
    mocks.mockPool.query.mockResolvedValue({ rows });

    const response = await request(app)
      .get("/api/applications/my")
      .set(auth())
      .expect(200);

    expect(response.body).toEqual(rows);
    expect(mocks.mockPool.query.mock.calls[0][1]).toEqual([1]);
  });

  it("returns event applications for event owner", async () => {
    const rows = [{ id: 1, status: "pending" }];
    mocks.mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 5, created_by: 2 }] })
      .mockResolvedValueOnce({ rows });

    const response = await request(app)
      .get("/api/applications/event/5")
      .set(auth("coordinator", 2))
      .expect(200);

    expect(response.body).toEqual(rows);
  });

  it("forbids event applications for non-owner coordinator", async () => {
    mocks.mockPool.query.mockResolvedValueOnce({ rows: [{ id: 5, created_by: 99 }] });

    const response = await request(app)
      .get("/api/applications/event/5")
      .set(auth("coordinator", 2))
      .expect(403);

    expect(response.body).toEqual({ message: "Нет доступа к заявкам этого мероприятия" });
  });

  it("accepts pending application", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 3, event_id: 5, status: "pending", created_by: 2, participant_limit: 10, start_at: future }] })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/1/accept")
      .set(auth("coordinator", 2))
      .expect(200);

    expect(response.body).toEqual({ message: "Заявка принята" });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "application_accept" })
    );
  });

  it("rejects non-pending application accept", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 3, event_id: 5, status: "approved", created_by: 2, participant_limit: 10, start_at: future }] });

    const response = await request(app)
      .patch("/api/applications/1/accept")
      .set(auth("coordinator", 2))
      .expect(400);

    expect(response.body).toEqual({ message: "Принять можно только заявку, ожидающую решения" });
  });

  it("rejects pending application", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 3, event_id: 5, status: "pending", created_by: 2, participant_limit: 10, start_at: future }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/1/reject")
      .set(auth("coordinator", 2))
      .expect(200);

    expect(response.body).toEqual({ message: "Заявка отклонена" });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "application_reject" })
    );
  });

  it("deletes own pending application", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, event_id: 5, status: "pending", participant_limit: 10, start_at: future }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .delete("/api/applications/1")
      .set(auth("volunteer", 1))
      .expect(200);

    expect(response.body).toEqual({ message: "Заявка отозвана" });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "application_delete" })
    );
  });

  it("forbids deleting another user's application", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 9, event_id: 5, status: "pending", participant_limit: 10, start_at: future }] });

    const response = await request(app)
      .delete("/api/applications/1")
      .set(auth("volunteer", 1))
      .expect(403);

    expect(response.body).toEqual({ message: "Нельзя отозвать чужую заявку" });
  });

  it("rejects duplicate pending application", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 5, created_by: 2, participant_limit: 10, start_at: future }] })
      .mockResolvedValueOnce({ rows: [{ id: 9, status: "pending" }] });

    const response = await request(app)
      .post("/api/applications")
      .set(auth("volunteer", 1))
      .send({ event_id: 5 })
      .expect(409);

    expect(response.body).toEqual({ message: "Заявка уже подана и ожидает решения координатора" });
  });

  it("creates repeated application after rejection", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();
    const application = { id: 11, user_id: 1, event_id: 5, status: "pending" };

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 5, created_by: 2, participant_limit: 3, start_at: future }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [application] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/applications")
      .set(auth("volunteer", 1))
      .send({ event_id: 5 })
      .expect(201);

    expect(response.body.application).toEqual(application);
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "application_resubmit",
        details: expect.objectContaining({ repeated_after_rejection: true }),
      })
    );
  });

  it("returns fallback error when application creation fails", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("db error"));

    const response = await request(app)
      .post("/api/applications")
      .set(auth("volunteer", 1))
      .send({ event_id: 5 })
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка при подаче заявки" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("returns fallback error when loading my applications fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db error"));

    const response = await request(app)
      .get("/api/applications/my")
      .set(auth("volunteer", 1))
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка при получении заявок" });
  });

  it("returns 404 when event applications event does not exist", async () => {
    mocks.mockPool.query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get("/api/applications/event/404")
      .set(auth("admin", 1))
      .expect(404);

    expect(response.body).toEqual({ message: "Мероприятие не найдено" });
  });

  it("returns event applications for admin", async () => {
    const rows = [{ id: 1, status: "approved", user_id: 3 }];

    mocks.mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 5, created_by: 2 }] })
      .mockResolvedValueOnce({ rows });

    const response = await request(app)
      .get("/api/applications/event/5")
      .set(auth("admin", 1))
      .expect(200);

    expect(response.body).toEqual(rows);
  });

  it("returns fallback error when loading event applications fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db error"));

    const response = await request(app)
      .get("/api/applications/event/5")
      .set(auth("admin", 1))
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка при получении заявок мероприятия" });
  });

  it("returns 404 when accepting missing application", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/404/accept")
      .set(auth("admin", 1))
      .expect(404);

    expect(response.body).toEqual({ message: "Заявка не найдена" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("forbids accepting application for non-owner coordinator", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 3, event_id: 5, status: "pending", created_by: 99, participant_limit: 10, start_at: future }] });

    const response = await request(app)
      .patch("/api/applications/1/accept")
      .set(auth("coordinator", 2))
      .expect(403);

    expect(response.body).toEqual({ message: "Нет доступа к изменению этой заявки" });
  });

  it("rejects accepting application for past event", async () => {
    const past = new Date(Date.now() - 1000000).toISOString();

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 3, event_id: 5, status: "pending", created_by: 2, participant_limit: 10, start_at: past }] });

    const response = await request(app)
      .patch("/api/applications/1/accept")
      .set(auth("coordinator", 2))
      .expect(400);

    expect(response.body).toEqual({ message: "Нельзя изменять заявки завершённого мероприятия" });
  });

  it("rejects accepting application when there are no free slots", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 3, event_id: 5, status: "pending", created_by: 2, participant_limit: 2, start_at: future }] })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] });

    const response = await request(app)
      .patch("/api/applications/1/accept")
      .set(auth("coordinator", 2))
      .expect(400);

    expect(response.body).toEqual({ message: "Свободных мест нет" });
  });

  it("returns fallback error when accepting application fails", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("db error"));

    const response = await request(app)
      .patch("/api/applications/1/accept")
      .set(auth("admin", 1))
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка при принятии заявки" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when rejecting missing application", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/404/reject")
      .set(auth("admin", 1))
      .expect(404);

    expect(response.body).toEqual({ message: "Заявка не найдена" });
  });

  it("forbids rejecting application for non-owner coordinator", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 3, event_id: 5, status: "pending", created_by: 99, participant_limit: 10, start_at: future }] });

    const response = await request(app)
      .patch("/api/applications/1/reject")
      .set(auth("coordinator", 2))
      .expect(403);

    expect(response.body).toEqual({ message: "Нет доступа к изменению этой заявки" });
  });

  it("rejects rejecting application for past event", async () => {
    const past = new Date(Date.now() - 1000000).toISOString();

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 3, event_id: 5, status: "pending", created_by: 2, participant_limit: 10, start_at: past }] });

    const response = await request(app)
      .patch("/api/applications/1/reject")
      .set(auth("coordinator", 2))
      .expect(400);

    expect(response.body).toEqual({ message: "Нельзя изменять заявки завершённого мероприятия" });
  });

  it("rejects approved application", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            user_id: 3,
            event_id: 5,
            status: "approved",
            participation_confirmed: false,
            created_by: 2,
            participant_limit: 10,
            start_at: future,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/1/reject")
      .set(auth("coordinator", 2))
      .expect(200);

    expect(response.body).toEqual({ message: "Заявка отклонена" });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "application_reject",
        details: expect.objectContaining({
          previous_status: "approved",
          new_status: "rejected",
          previous_participation_confirmed: false,
          new_participation_confirmed: false,
        }),
      })
    );
  });

  it("rejects already rejected application reject", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 3, event_id: 5, status: "rejected", created_by: 2, participant_limit: 10, start_at: future }] });

    const response = await request(app)
      .patch("/api/applications/1/reject")
      .set(auth("coordinator", 2))
      .expect(400);

    expect(response.body).toEqual({
      message: "Отклонить можно только заявку, ожидающую решения или уже принятую заявку",
    });
  });

  it("returns fallback error when rejecting application fails", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("db error"));

    const response = await request(app)
      .patch("/api/applications/1/reject")
      .set(auth("admin", 1))
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка при отклонении заявки" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when deleting missing application", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .delete("/api/applications/404")
      .set(auth("volunteer", 1))
      .expect(404);

    expect(response.body).toEqual({ message: "Заявка не найдена" });
  });

  it("rejects deleting application for past event", async () => {
    const past = new Date(Date.now() - 1000000).toISOString();

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, event_id: 5, status: "pending", participant_limit: 10, start_at: past }] });

    const response = await request(app)
      .delete("/api/applications/1")
      .set(auth("volunteer", 1))
      .expect(400);

    expect(response.body).toEqual({ message: "Нельзя отзывать заявку завершённого мероприятия" });
  });

  it("rejects deleting non-pending application", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();

    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, event_id: 5, status: "approved", participant_limit: 10, start_at: future }] });

    const response = await request(app)
      .delete("/api/applications/1")
      .set(auth("volunteer", 1))
      .expect(400);

    expect(response.body).toEqual({ message: "Отозвать можно только заявку, ожидающую решения координатора" });
  });

  it("returns fallback error when deleting application fails", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("db error"));

    const response = await request(app)
      .delete("/api/applications/1")
      .set(auth("volunteer", 1))
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка при отзыве заявки" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate pending application with pending message", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();
  
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            created_by: 2,
            participant_limit: 10,
            start_at: future,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 9, status: "pending" }],
      });
  
    const response = await request(app)
      .post("/api/applications")
      .set(auth("volunteer", 1))
      .send({ event_id: 5 })
      .expect(409);
  
    expect(response.body).toEqual({
      message: "Заявка уже подана и ожидает решения координатора",
    });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });
  
  it("allows application when event date is invalid and writes resubmit audit action", async () => {
    const application = {
      id: 10,
      user_id: 1,
      event_id: 5,
      status: "pending",
    };
  
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            created_by: 2,
            participant_limit: 10,
            start_at: "bad-date",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [application] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
  
    const response = await request(app)
      .post("/api/applications")
      .set(auth("volunteer", 1))
      .send({ event_id: 5 })
      .expect(201);
  
    expect(response.body).toEqual({
      message: "Заявка отправлена и ожидает решения координатора",
      application,
    });
  
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "application_resubmit",
        details: expect.objectContaining({
          repeated_after_rejection: true,
        }),
      })
    );
  });
  
  it("accepts pending application when approved count query returns empty rows", async () => {
    const future = new Date(Date.now() + 1000000).toISOString();
  
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            user_id: 3,
            event_id: 5,
            status: "pending",
            created_by: 2,
            participant_limit: 10,
            start_at: future,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
  
    const response = await request(app)
      .patch("/api/applications/1/accept")
      .set(auth("coordinator", 2))
      .expect(200);
  
    expect(response.body).toEqual({ message: "Заявка принята" });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "application_accept",
        details: expect.objectContaining({
          previous_status: "pending",
          new_status: "approved",
        }),
      })
    );
  });
});
