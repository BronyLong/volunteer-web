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

const applicationsRoutes = (await import("../routes/applications.routes.js")).default;
const app = createTestApp("/api/applications", applicationsRoutes);

function auth(role = "coordinator", id = 2) {
  mocks.mockVerify.mockReturnValue({ id, role, email: `${role}@mail.ru` });
  mocks.mockPool.query.mockResolvedValueOnce({
    rows: [{ id, role, email: `${role}@mail.ru`, is_active: true }],
  });
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
  mocks.mockNotifyApplicationStatus.mockReset();
}

function application(overrides = {}) {
  return {
    id: 1,
    user_id: 10,
    event_id: 5,
    status: "approved",
    created_by: 2,
    participant_limit: 10,
    start_at: "2000-01-01T10:00:00.000Z",
    participation_confirmed: false,
    ...overrides,
  };
}

describe("applications.routes participation confirmation", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    resetMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("confirms participation for approved completed application", async () => {
    const appRow = application();
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [appRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/1/confirm-participation")
      .set(auth("coordinator", 2))
      .expect(200);

    expect(response.body).toEqual({ message: "Участие подтверждено" });
    expect(mocks.mockClient.query.mock.calls[2][0]).toContain("participation_confirmed = TRUE");
    expect(mocks.mockClient.query.mock.calls[2][1]).toEqual(["1", 2]);
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "application_participation_confirm",
        entityType: "application",
        entityId: "1",
        db: mocks.mockClient,
      })
    );
    expect(mocks.mockClient.query).toHaveBeenCalledWith("COMMIT");
  });

  it("returns 404 when application for participation confirmation is missing", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/404/confirm-participation")
      .set(auth("coordinator", 2))
      .expect(404);

    expect(response.body).toEqual({ message: "Заявка не найдена" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("forbids participation confirmation for non-owner coordinator", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [application({ created_by: 99 })] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/1/confirm-participation")
      .set(auth("coordinator", 2))
      .expect(403);

    expect(response.body).toEqual({ message: "Нет доступа к подтверждению участия" });
  });

  it("allows admin to confirm participation", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [application({ created_by: 99 })] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await request(app)
      .patch("/api/applications/1/confirm-participation")
      .set(auth("admin", 1))
      .expect(200);

    expect(mocks.mockClient.query).toHaveBeenCalledWith("COMMIT");
  });

  it("rejects participation confirmation before event completion", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [application({ start_at: "2099-01-01T10:00:00.000Z" })] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/1/confirm-participation")
      .set(auth("coordinator", 2))
      .expect(400);

    expect(response.body).toEqual({
      message: "Участие можно подтверждать только после завершения мероприятия",
    });
  });

  it("rejects participation confirmation for non-approved application", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [application({ status: "pending" })] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/1/confirm-participation")
      .set(auth("coordinator", 2))
      .expect(400);

    expect(response.body).toEqual({
      message: "Подтвердить участие можно только для принятой заявки",
    });
  });

  it("returns fallback error when participation confirmation fails", async () => {
    mocks.mockClient.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error("db failed"));

    const response = await request(app)
      .patch("/api/applications/1/confirm-participation")
      .set(auth("coordinator", 2))
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка при подтверждении участия" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("cancels participation confirmation", async () => {
    const appRow = application({ participation_confirmed: true });
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [appRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/1/cancel-participation")
      .set(auth("coordinator", 2))
      .expect(200);

    expect(response.body).toEqual({ message: "Подтверждение участия отменено" });
    expect(mocks.mockClient.query.mock.calls[2][0]).toContain("participation_confirmed = FALSE");
    expect(mocks.mockClient.query.mock.calls[2][1]).toEqual(["1"]);
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "application_participation_cancel" })
    );
  });

  it("returns 404 when application for participation cancellation is missing", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/404/cancel-participation")
      .set(auth("coordinator", 2))
      .expect(404);

    expect(response.body).toEqual({ message: "Заявка не найдена" });
  });

  it("forbids participation cancellation for non-owner coordinator", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [application({ created_by: 99 })] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/1/cancel-participation")
      .set(auth("coordinator", 2))
      .expect(403);

    expect(response.body).toEqual({ message: "Нет доступа к изменению подтверждения участия" });
  });

  it("rejects participation cancellation before event completion", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [application({ start_at: "2099-01-01T10:00:00.000Z" })] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/1/cancel-participation")
      .set(auth("coordinator", 2))
      .expect(400);

    expect(response.body).toEqual({
      message: "Подтверждение участия можно менять только после завершения мероприятия",
    });
  });

  it("rejects participation cancellation for non-approved application", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [application({ status: "rejected" })] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .patch("/api/applications/1/cancel-participation")
      .set(auth("coordinator", 2))
      .expect(400);

    expect(response.body).toEqual({
      message: "Изменять подтверждение можно только для принятой заявки",
    });
  });

  it("returns fallback error when participation cancellation fails", async () => {
    mocks.mockClient.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error("db failed"));

    const response = await request(app)
      .patch("/api/applications/1/cancel-participation")
      .set(auth("coordinator", 2))
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка при отмене подтверждения участия" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });
});
