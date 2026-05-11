import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/testApp.js";

const mocks = vi.hoisted(() => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  return {
    mockClient,
    mockPool: {
      query: vi.fn(),
      connect: vi.fn(() => mockClient),
    },
    mockHash: vi.fn(),
    mockCompare: vi.fn(),
    mockSign: vi.fn(),
    mockWriteAuditLog: vi.fn(),
  };
});

vi.mock("../db.js", () => ({
  pool: mocks.mockPool,
}));

vi.mock("../utils/audit.js", () => ({
  writeAuditLog: mocks.mockWriteAuditLog,
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: mocks.mockHash,
    compare: mocks.mockCompare,
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: mocks.mockSign,
  },
}));

const authRoutes = (await import("../routes/auth.routes.js")).default;
const app = createTestApp("/api/auth", authRoutes);

const validRegisterBody = {
  firstName: " Анна ",
  lastName: " Админ ",
  email: " ADMIN@EXAMPLE.COM ",
  password: "Password1!",
};

function resetClient() {
  mocks.mockClient.query.mockReset();
  mocks.mockClient.release.mockReset();
  mocks.mockPool.query.mockReset();
  mocks.mockPool.connect.mockClear();
  mocks.mockWriteAuditLog.mockReset();
  mocks.mockHash.mockReset();
  mocks.mockCompare.mockReset();
  mocks.mockSign.mockReset();
}

describe("auth.routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    resetClient();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("registers user, creates profile, writes audit log and returns token", async () => {
    const user = { id: 1, email: "admin@example.com", role: "volunteer", is_active: true };

    mocks.mockHash.mockResolvedValue("hashed-password");
    mocks.mockSign.mockReturnValue("jwt-token");
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [user] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post("/api/auth/register")
      .send(validRegisterBody)
      .expect(201);

    expect(response.body).toEqual({
      message: "Регистрация успешна",
      token: "jwt-token",
      user,
    });
    expect(mocks.mockClient.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mocks.mockHash).toHaveBeenCalledWith("Password1!", 10);
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        userRole: "volunteer",
        action: "register",
        entityType: "user",
        entityId: 1,
        db: mocks.mockClient,
      })
    );
    expect(mocks.mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("validates required register fields", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "a@b.ru" })
      .expect(400);

    expect(response.body).toEqual({ message: "Заполни все обязательные поля" });
    expect(mocks.mockPool.connect).not.toHaveBeenCalled();
  });

  it("validates register email", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegisterBody, email: "bad-email" })
      .expect(400);

    expect(response.body.message).toMatch(/корректный email/i);
  });

  it("validates register password", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegisterBody, password: "weak" })
      .expect(400);

    expect(response.body.message).toMatch(/пароль должен/i);
  });

  it("returns 409 when register email already exists", async () => {
    mocks.mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const response = await request(app)
      .post("/api/auth/register")
      .send(validRegisterBody)
      .expect(409);

    expect(response.body).toEqual({ message: "Пользователь с таким email уже существует" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("returns 500 when register transaction fails", async () => {
    mocks.mockClient.query.mockRejectedValueOnce(new Error("db failed"));

    const response = await request(app)
      .post("/api/auth/register")
      .send(validRegisterBody)
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка сервера при регистрации" });
    expect(mocks.mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("logs user in", async () => {
    const user = {
      id: 1,
      email: "user@example.com",
      password: "hashed",
      role: "volunteer",
      is_active: true,
    };

    mocks.mockPool.query.mockResolvedValue({ rows: [user] });
    mocks.mockCompare.mockResolvedValue(true);
    mocks.mockSign.mockReturnValue("jwt-token");

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: " USER@EXAMPLE.COM ", password: "Password1!" })
      .expect(200);

    expect(response.body).toEqual({
      message: "Вход выполнен",
      token: "jwt-token",
      user: { id: 1, email: "user@example.com", role: "volunteer" },
    });
    expect(mocks.mockCompare).toHaveBeenCalledWith("Password1!", "hashed");
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "login", entityType: "auth", entityId: 1 })
    );
  });

  it("validates login required fields", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "" })
      .expect(400);

    expect(response.body).toEqual({ message: "Email и пароль обязательны" });
  });

  it("returns 401 and writes audit log when login user is not found", async () => {
    mocks.mockPool.query.mockResolvedValue({ rows: [] });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "missing@example.com", password: "Password1!" })
      .expect(401);

    expect(response.body).toEqual({ message: "Неверный email или пароль" });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login_failed",
        entityType: "auth",
        status: "failed",
        details: expect.objectContaining({ reason: "user_not_found" }),
      })
    );
  });

  it("returns 403 when user is inactive", async () => {
    mocks.mockPool.query.mockResolvedValue({
      rows: [{ id: 1, email: "u@mail.ru", password: "hash", role: "volunteer", is_active: false }],
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "u@mail.ru", password: "Password1!" })
      .expect(403);

    expect(response.body).toEqual({ message: "Аккаунт деактивирован" });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "login_blocked", status: "failed" })
    );
  });

  it("returns 401 when password is invalid", async () => {
    mocks.mockPool.query.mockResolvedValue({
      rows: [{ id: 1, email: "u@mail.ru", password: "hash", role: "volunteer", is_active: true }],
    });
    mocks.mockCompare.mockResolvedValue(false);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "u@mail.ru", password: "Wrong1!" })
      .expect(401);

    expect(response.body).toEqual({ message: "Неверный email или пароль" });
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "login_failed",
        details: expect.objectContaining({ reason: "invalid_password" }),
      })
    );
  });

  it("returns 500 when login query fails", async () => {
    mocks.mockPool.query.mockRejectedValue(new Error("db failed"));

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "u@mail.ru", password: "Password1!" })
      .expect(500);

    expect(response.body).toEqual({ message: "Ошибка сервера при входе" });
  });
});
