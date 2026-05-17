import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  const mockConnect = vi.fn(() => mockClient);

  const mockPoolConstructor = vi.fn(function MockPool() {
    this.connect = mockConnect;
  });

  return {
    mockClient,
    mockConnect,
    mockPoolConstructor,
  };
});

vi.mock("pg", () => ({
  default: {
    Pool: mocks.mockPoolConstructor,
  },
}));

describe("db", () => {
  beforeEach(() => {
    vi.resetModules();

    mocks.mockClient.query.mockReset();
    mocks.mockClient.release.mockReset();
    mocks.mockConnect.mockClear();
    mocks.mockPoolConstructor.mockClear();

    vi.spyOn(console, "log").mockImplementation(() => {});

    process.env.DB_HOST = "localhost";
    process.env.DB_PORT = "5432";
    process.env.DB_NAME = "volunteer_org";
    process.env.DB_USER = "postgres";
    process.env.DB_PASSWORD = "postgres";
  });

  it("creates pool from env variables", async () => {
    await import("../db.js");

    expect(mocks.mockPoolConstructor).toHaveBeenCalledWith({
      host: "localhost",
      port: 5432,
      database: "volunteer_org",
      user: "postgres",
      password: "postgres",
    });
  });

  it("tests db connection and releases client", async () => {
    const { testDbConnection } = await import("../db.js");

    mocks.mockClient.query.mockResolvedValue({
      rows: [{ now: "now" }],
    });

    await testDbConnection();

    expect(mocks.mockConnect).toHaveBeenCalledTimes(1);
    expect(mocks.mockClient.query).toHaveBeenCalledWith("SELECT NOW()");
    expect(console.log).toHaveBeenCalledWith("PostgreSQL connected:", "now");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("releases client when connection check query throws", async () => {
    const { testDbConnection } = await import("../db.js");

    mocks.mockClient.query.mockRejectedValue(new Error("db failed"));

    await expect(testDbConnection()).rejects.toThrow("db failed");

    expect(mocks.mockConnect).toHaveBeenCalledTimes(1);
    expect(mocks.mockClient.query).toHaveBeenCalledWith("SELECT NOW()");
    expect(mocks.mockClient.release).toHaveBeenCalledTimes(1);
  });
});
