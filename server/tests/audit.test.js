import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPool = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../db.js", () => ({
  pool: mockPool,
}));

const { writeAuditLog } = await import("../utils/audit.js");
const { decryptPersonalData } = await import("../utils/personalData.js");

describe("writeAuditLog", () => {
  beforeEach(() => {
    process.env.PERSONAL_DATA_ENCRYPTION_KEY =
      "7ocHqnLbAqeoy0d533QlKebzhRjFs7FMlm3YOng3/eE=";
    process.env.PERSONAL_DATA_HASH_KEY =
      "rWMjR0d2toP83nrZPvH6QhNdiBYOjuK1nUoMLSowjwc=";
    mockPool.query.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does nothing when action is missing", async () => {
    await writeAuditLog({ entityType: "user" });

    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("does nothing when entityType is missing", async () => {
    await writeAuditLog({ action: "login" });

    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("writes audit log with request metadata and forwarded ip", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await writeAuditLog({
      userId: 1,
      userRole: "admin",
      action: "update",
      entityType: "user",
      entityId: 7,
      req: {
        method: "PATCH",
        originalUrl: "/api/admin/users/7/role",
        ip: "127.0.0.1",
        headers: {
          "x-forwarded-for": "10.0.0.1, 10.0.0.2",
          "user-agent": "vitest",
        },
      },
      details: { role: "coordinator" },
    });

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const values = mockPool.query.mock.calls[0][1];

    expect(values).toEqual([
      1,
      "admin",
      "update",
      "user",
      "7",
      "PATCH",
      "/api/admin/users/7/role",
      expect.any(String),
      expect.any(String),
      "success",
      JSON.stringify({ role: "coordinator" }),
    ]);
    expect(decryptPersonalData(values[7])).toBe("10.0.0.1");
    expect(decryptPersonalData(values[8])).toBe("vitest");
  });

  it("falls back to socket remoteAddress and default values", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await writeAuditLog({
      action: "login_failed",
      entityType: "auth",
      req: {
        socket: { remoteAddress: "::1" },
        headers: {},
      },
      status: "failed",
      details: null,
    });

    const values = mockPool.query.mock.calls[0][1];

    expect(values).toEqual([
      null,
      null,
      "login_failed",
      "auth",
      null,
      null,
      null,
      expect.any(String),
      null,
      "failed",
      JSON.stringify({}),
    ]);
    expect(decryptPersonalData(values[7])).toBe("::1");
  });

  it("logs internal audit error without throwing", async () => {
    const error = new Error("db failed");
    mockPool.query.mockRejectedValue(error);

    await expect(
      writeAuditLog({ action: "x", entityType: "y" })
    ).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith("Audit log write error:", error);
  });
});

describe("writeAuditLog null ip branch", () => {
  beforeEach(() => {
    process.env.PERSONAL_DATA_ENCRYPTION_KEY =
      "7ocHqnLbAqeoy0d533QlKebzhRjFs7FMlm3YOng3/eE=";
    process.env.PERSONAL_DATA_HASH_KEY =
      "rWMjR0d2toP83nrZPvH6QhNdiBYOjuK1nUoMLSowjwc=";
    mockPool.query.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("stores null ip when request has no ip and socket address", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await writeAuditLog({
      action: "system_action",
      entityType: "system",
      req: {
        headers: {},
      },
    });

    const values = mockPool.query.mock.calls[0][1];
    expect(values[7]).toBeNull();
  });
});
