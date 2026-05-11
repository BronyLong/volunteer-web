import { describe, expect, it, vi, beforeEach } from "vitest";
import { authMiddleware } from "../middleware/auth.js";

const mockVerify = vi.hoisted(() => vi.fn());

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: mockVerify,
  },
}));

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
    mockVerify.mockReset();
  });

  it("returns 401 when Authorization header is missing", () => {
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Требуется авторизация" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header does not start with Bearer", () => {
    req.headers.authorization = "Token abc";

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Требуется авторизация" });
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.user and calls next for valid token", () => {
    const payload = { id: 1, role: "admin", email: "admin@example.com" };
    req.headers.authorization = "Bearer valid-token";
    mockVerify.mockReturnValue(payload);

    authMiddleware(req, res, next);

    expect(mockVerify).toHaveBeenCalledWith("valid-token", "test-secret");
    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 401 when token verification fails", () => {
    req.headers.authorization = "Bearer invalid-token";
    mockVerify.mockImplementation(() => {
      throw new Error("invalid");
    });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Недействительный токен" });
    expect(next).not.toHaveBeenCalled();
  });
});
