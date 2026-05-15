import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCreateTransport: vi.fn(),
  mockSendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  createTransport: mocks.mockCreateTransport,
  default: {
    createTransport: mocks.mockCreateTransport,
  },
}));

const { sendMail } = await import("../utils/email.js");

const OLD_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...OLD_ENV };
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  delete process.env.SMTP_FROM;
}

describe("email util", () => {
  beforeEach(() => {
    resetEnv();
    mocks.mockCreateTransport.mockReset();
    mocks.mockSendMail.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("skips email when SMTP config is missing", async () => {
    const result = await sendMail({
      to: "user@mail.ru",
      subject: "Тема",
      text: "Текст",
      html: "<p>Текст</p>",
    });

    expect(result).toEqual({ skipped: true, reason: "smtp_not_configured" });
    expect(console.log).toHaveBeenCalledWith(
      "Email notification skipped: SMTP settings are not configured",
      { to: "user@mail.ru", subject: "Тема" }
    );
    expect(mocks.mockCreateTransport).not.toHaveBeenCalled();
  });

  it("skips email when SMTP config contains placeholder values", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "example@example.com";
    process.env.SMTP_PASSWORD = "password";
    process.env.SMTP_FROM = "example@example.com";

    const result = await sendMail({ to: "user@mail.ru", subject: "Тема", text: "Текст" });

    expect(result).toEqual({ skipped: true, reason: "smtp_not_configured" });
    expect(mocks.mockCreateTransport).not.toHaveBeenCalled();
  });

  it("sends email through nodemailer when SMTP config is valid", async () => {
    process.env.SMTP_HOST = "smtp.mail.ru";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "sender@mail.ru";
    process.env.SMTP_PASSWORD = "secret-password";
    process.env.SMTP_FROM = "from@mail.ru";
    mocks.mockSendMail.mockResolvedValue({ messageId: "1" });
    mocks.mockCreateTransport.mockReturnValue({ sendMail: mocks.mockSendMail });

    const result = await sendMail({
      to: "user@mail.ru",
      subject: "Тема",
      text: "Текст",
      html: "<p>Текст</p>",
    });

    expect(result).toEqual({ skipped: false });
    expect(mocks.mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.mail.ru",
      port: 465,
      secure: true,
      auth: {
        user: "sender@mail.ru",
        pass: "secret-password",
      },
    });
    expect(mocks.mockSendMail).toHaveBeenCalledWith({
      from: "from@mail.ru",
      to: "user@mail.ru",
      subject: "Тема",
      text: "Текст",
      html: "<p>Текст</p>",
    });
  });

  it("uses SMTP user as from address and non-secure connection for non-465 port", async () => {
    process.env.SMTP_HOST = "smtp.mail.ru";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "sender@mail.ru";
    process.env.SMTP_PASSWORD = "secret-password";
    mocks.mockSendMail.mockResolvedValue({ messageId: "1" });
    mocks.mockCreateTransport.mockReturnValue({ sendMail: mocks.mockSendMail });

    await sendMail({ to: "user@mail.ru", subject: "Тема", text: "Текст" });

    expect(mocks.mockCreateTransport.mock.calls[0][0].secure).toBe(false);
    expect(mocks.mockSendMail.mock.calls[0][0].from).toBe("sender@mail.ru");
  });

  it("returns skipped result when SMTP sending fails", async () => {
    process.env.SMTP_HOST = "smtp.mail.ru";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "sender@mail.ru";
    process.env.SMTP_PASSWORD = "secret-password";
    const error = new Error("send failed");
    error.code = "EAUTH";
    error.command = "AUTH";
    mocks.mockSendMail.mockRejectedValue(error);
    mocks.mockCreateTransport.mockReturnValue({ sendMail: mocks.mockSendMail });

    const result = await sendMail({ to: "user@mail.ru", subject: "Тема", text: "Текст" });

    expect(result).toEqual({ skipped: true, reason: "smtp_send_failed", error: "send failed" });
    expect(console.error).toHaveBeenCalledWith(
      "Email notification skipped: SMTP sending failed",
      expect.objectContaining({
        to: "user@mail.ru",
        subject: "Тема",
        host: "smtp.mail.ru",
        code: "EAUTH",
        command: "AUTH",
        message: "send failed",
      })
    );
  });
});
