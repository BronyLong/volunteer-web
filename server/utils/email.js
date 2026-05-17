function isPlaceholderValue(value) {
  if (!value) return true;

  const normalized = String(value).trim().toLowerCase();

  return (
    normalized === "smtp.example.com" ||
    normalized === "example@example.com" ||
    normalized === "password" ||
    normalized === "your_password" ||
    normalized === "your_email@example.com" ||
    normalized.includes("example.com")
  );
}

function getSmtpConfig() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  return {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    smtpFrom,
  };
}

function isSmtpConfigured(config) {
  return (
    !isPlaceholderValue(config.smtpHost) &&
    !isPlaceholderValue(config.smtpUser) &&
    !isPlaceholderValue(config.smtpPassword) &&
    !isPlaceholderValue(config.smtpFrom)
  );
}

export async function sendMail({ to, subject, text, html }) {
  const config = getSmtpConfig();

  if (!isSmtpConfigured(config)) {
    console.log("Email notification skipped: SMTP settings are not configured", {
      to,
      subject,
    });

    return {
      skipped: true,
      reason: "smtp_not_configured",
    };
  }

  let nodemailer;

  try {
    nodemailer = await import("nodemailer");
  } catch (error) {
    console.error(
      "Email notification skipped: nodemailer is not installed. Run npm install in server.",
      error.message
    );

    return {
      skipped: true,
      reason: "nodemailer_not_installed",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    });

    await transporter.sendMail({
      from: config.smtpFrom,
      to,
      subject,
      text,
      html,
    });

    return {
      skipped: false,
    };
  } catch (error) {
    console.error("Email notification skipped: SMTP sending failed", {
      to,
      subject,
      host: config.smtpHost,
      code: error.code,
      command: error.command,
      message: error.message,
    });

    return {
      skipped: true,
      reason: "smtp_send_failed",
      error: error.message,
    };
  }
}
