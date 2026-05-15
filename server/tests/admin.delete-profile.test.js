import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/testApp.js";

const mocks = vi.hoisted(() => {
  const mockClient = { query: vi.fn(), release: vi.fn() };

  return {
    mockClient,
    currentUser: null,
    mockPool: {
      query: vi.fn(),
      connect: vi.fn(() => mockClient),
    },
    mockVerify: vi.fn(),
    mockWriteAuditLog: vi.fn(),
    mockRandomUUID: vi.fn(),
  };
});

vi.mock("../db.js", () => ({ pool: mocks.mockPool }));
vi.mock("../utils/audit.js", () => ({ writeAuditLog: mocks.mockWriteAuditLog }));
vi.mock("jsonwebtoken", () => ({ default: { verify: mocks.mockVerify } }));
vi.mock("crypto", async () => {
  const actual = await vi.importActual("crypto");
  return {
    default: {
      ...actual.default,
      randomUUID: mocks.mockRandomUUID,
    },
    ...actual,
    randomUUID: mocks.mockRandomUUID,
  };
});

const adminRoutes = (await import("../routes/admin.routes.js")).default;
const app = createTestApp("/api/admin", adminRoutes);

function auth(role = "admin", id = 1) {
  mocks.currentUser = { id, role, email: `${role}@mail.ru`, is_active: true };
  mocks.mockVerify.mockReturnValue({ id, role, email: `${role}@mail.ru` });

  return { Authorization: "Bearer token" };
}

function resetMocks() {
  mocks.currentUser = null;

  mocks.mockPool.query.mockReset();
  mocks.mockPool.query.mockImplementation((sql) => {
    const queryText = String(sql);

    if (queryText.includes("FROM users") && queryText.includes("WHERE id = $1")) {
      return Promise.resolve({
        rows: mocks.currentUser ? [mocks.currentUser] : [],
      });
    }

    return Promise.resolve({ rows: [] });
  });

  mocks.mockPool.connect.mockClear();
  mocks.mockClient.query.mockReset();
  mocks.mockClient.release.mockReset();
  mocks.mockVerify.mockReset();
  mocks.mockWriteAuditLog.mockReset();
  mocks.mockRandomUUID.mockReset();
}

function targetUser(overrides = {}) {
  return {
    id: 7,
    email: "target@mail.ru",
    role: "volunteer",
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    first_name: "Иван",
    last_name: "Петров",
    middle_name: "",
    gender: "male",
    phone: "+7 (900) 000-00-00",
    city: "Москва",
    avatar_url: "avatar.png",
    bio: "bio",
    social_vk: "https://vk.com/user",
    social_ok: "",
    social_max: "",
    ...overrides,
  };
}

function getAllQueryTexts() {
  return [
    ...mocks.mockPool.query.mock.calls.map((call) => String(call[0])),
    ...mocks.mockClient.query.mock.calls.map((call) => String(call[0])),
  ];
}

describe("admin.routes delete user profile", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    process.env.PERSONAL_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.PERSONAL_DATA_HASH_KEY = Buffer.alloc(32, 2).toString("base64");

    resetMocks();

    mocks.mockRandomUUID.mockReturnValue("uuid-1");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects deleting current admin profile", async () => {
    const response = await request(app)
      .delete("/api/admin/users/1/profile")
      .set(auth("admin", 1))
      .expect(400);

    expect(response.body).toEqual({
      message: "Нельзя удалить профиль текущего администратора",
    });
  });

  it("returns 404 when deleted user does not exist", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .delete("/api/admin/users/404/profile")
      .set(auth())
      .expect(404);

    expect(response.body).toEqual({ message: "Пользователь не найден" });

    if (mocks.mockClient.query.mock.calls.length > 0) {
      expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects deleting another admin profile", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [targetUser({ role: "admin" })] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .delete("/api/admin/users/7/profile")
      .set(auth())
      .expect(400);

    expect(response.body).toEqual({
      message: "Нельзя удалить профиль администратора",
    });

    if (mocks.mockClient.query.mock.calls.length > 0) {
      expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    }
  });

  it("anonymizes and deactivates deleted user profile", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [targetUser()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .delete("/api/admin/users/7/profile")
      .set(auth())
      .expect(200);

    expect(response.body).toEqual({
      message: "Профиль пользователя удален и обезличен",
      user_id: "7",
    });

    const queryTexts = getAllQueryTexts();

    expect(queryTexts.some((query) => query.includes("UPDATE users"))).toBe(true);
    expect(queryTexts.some((query) => query.includes("INSERT INTO profiles"))).toBe(true);
    expect(queryTexts.some((query) => query.includes("DELETE FROM auth_email_tokens"))).toBe(true);
    expect(queryTexts.some((query) => query.includes("DELETE FROM notifications"))).toBe(true);
    expect(queryTexts.some((query) => query.includes("DELETE FROM notification_category_settings"))).toBe(true);
    expect(queryTexts.some((query) => query.includes("DELETE FROM notification_settings"))).toBe(true);

    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_user_profile_delete",
        entityType: "user",
        entityId: "7",
        details: {
          deleted_user: expect.objectContaining({
            id: 7,
            role: "volunteer",
          }),
        },
      })
    );

    if (mocks.mockClient.query.mock.calls.length > 0) {
      expect(mocks.mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
    }
  });

  it("rolls back when user profile deletion fails", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("db failed"));

    const response = await request(app)
      .delete("/api/admin/users/7/profile")
      .set(auth())
      .expect(500);

    expect(response.body).toEqual({
      message: "Не удалось удалить профиль пользователя",
    });

    if (mocks.mockClient.query.mock.calls.length > 0) {
      expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
    }
  });
});
