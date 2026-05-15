import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockPool: {
    query: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: mocks.mockVerify,
  },
}));

vi.mock("../db.js", () => ({
  pool: mocks.mockPool,
}));

const { authMiddleware } = await import("../middleware/auth.js");

describe("authMiddleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    req = { headers: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    mocks.mockVerify.mockReset();
    mocks.mockPool.query.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 when Authorization header is missing", async () => {
    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Требуется авторизация" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header does not start with Bearer", async () => {
    req.headers.authorization = "Token abc";

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Требуется авторизация" });
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.user and calls next for valid token", async () => {
    const payload = { id: 1, role: "admin", email: "admin@example.com" };
    req.headers.authorization = "Bearer valid-token";
    mocks.mockVerify.mockReturnValue(payload);
    mocks.mockPool.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          email: "admin@example.com",
          role: "admin",
          is_active: true,
        },
      ],
    });

    await authMiddleware(req, res, next);

    expect(mocks.mockVerify).toHaveBeenCalledWith("valid-token", "test-secret");
    expect(mocks.mockPool.query.mock.calls[0][0]).toContain("FROM users");
    expect(mocks.mockPool.query.mock.calls[0][1]).toEqual([1]);
    expect(req.user).toEqual({
      id: 1,
      email: "admin@example.com",
      role: "admin",
      is_active: true,
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 401 when token verification fails", async () => {
    req.headers.authorization = "Bearer invalid-token";
    const error = new Error("invalid");
    error.name = "JsonWebTokenError";
    mocks.mockVerify.mockImplementation(() => {
      throw error;
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Недействительный токен" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token user was not found", async () => {
    req.headers.authorization = "Bearer valid-token";
    mocks.mockVerify.mockReturnValue({ id: 404 });
    mocks.mockPool.query.mockResolvedValue({ rows: [] });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Пользователь не найден" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when account is inactive", async () => {
    req.headers.authorization = "Bearer valid-token";
    mocks.mockVerify.mockReturnValue({ id: 1 });
    mocks.mockPool.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          email: "user@example.com",
          role: "volunteer",
          is_active: false,
        },
      ],
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Аккаунт деактивирован" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 500 when authorization check query fails", async () => {
    req.headers.authorization = "Bearer valid-token";
    const error = new Error("db failed");
    mocks.mockVerify.mockReturnValue({ id: 1 });
    mocks.mockPool.query.mockRejectedValue(error);

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Ошибка проверки авторизации" });
    expect(console.error).toHaveBeenCalledWith("Auth middleware error:", error);
    expect(next).not.toHaveBeenCalled();
  });
});
