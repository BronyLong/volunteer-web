import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("nodemailer", () => {
  throw new Error("missing nodemailer");
});

const { sendMail } = await import("../utils/email.js");

const OLD_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...OLD_ENV };
  process.env.SMTP_HOST = "smtp.mail.ru";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "sender@mail.ru";
  process.env.SMTP_PASSWORD = "secret-password";
  process.env.SMTP_FROM = "from@mail.ru";
}

describe("email util nodemailer import failure", () => {
  beforeEach(() => {
    resetEnv();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns skipped result when nodemailer cannot be imported", async () => {
    const result = await sendMail({
      to: "user@mail.ru",
      subject: "Тема",
      text: "Текст",
    });

    expect(result).toEqual({
      skipped: true,
      reason: "nodemailer_not_installed",
    });
    expect(console.error).toHaveBeenCalledWith(
      "Email notification skipped: nodemailer is not installed. Run npm install in server.",
      expect.stringContaining("error when mocking a module")
    );
  });
});
