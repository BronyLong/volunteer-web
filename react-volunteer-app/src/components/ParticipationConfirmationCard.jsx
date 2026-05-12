import { Link } from "react-router-dom";
import "./ParticipationConfirmationCard.css";

function getApplicationStatusLabel(status) {
  switch (status) {
    case "pending":
      return "Заявка ожидает решения";
    case "approved":
      return "Заявка принята";
    case "rejected":
      return "Заявка отклонена";
    default:
      return "Статус неизвестен";
  }
}

function getParticipationStatusLabel(status, participationConfirmed) {
  if (status !== "approved") {
    return "Участие не засчитывается";
  }

  return participationConfirmed ? "Участие подтверждено" : "Участие не подтверждено";
}

function getParticipationStatusClass(status, participationConfirmed) {
  if (status !== "approved") {
    return "participation-card__status participation-card__status--inactive";
  }

  return participationConfirmed
    ? "participation-card__status participation-card__status--confirmed"
    : "participation-card__status participation-card__status--unconfirmed";
}

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ParticipationConfirmationCard({
  id,
  userId,
  avatar,
  name,
  secondName,
  email,
  phone,
  status = "pending",
  participationConfirmed = false,
  participationConfirmedAt = null,
  confirmedByName = "",
  onConfirm,
  onCancel,
  isConfirming = false,
  isCancelling = false,
}) {
  const isApproved = status === "approved";
  const fullName = `${name} ${secondName}`.trim() || "Пользователь";
  const profileLink = userId ? `/profiles/${userId}` : null;
  const confirmationDate = formatDateTime(participationConfirmedAt);

  return (
    <article className="participation-card">
      <div className="participation-card__user">
        {profileLink ? (
          <Link
            to={profileLink}
            className="participation-card__avatar-link"
            aria-label={`Перейти в профиль пользователя ${fullName}`}
            title="Открыть профиль"
          >
            <img src={avatar} alt={fullName} className="participation-card__avatar" />
          </Link>
        ) : (
          <img src={avatar} alt={fullName} className="participation-card__avatar" />
        )}

        <div className="participation-card__info">
          <h3 className="participation-card__name">{fullName}</h3>

          <div className="participation-card__badges">
            <span className="participation-card__application-status">
              {getApplicationStatusLabel(status)}
            </span>
            <span className={getParticipationStatusClass(status, participationConfirmed)}>
              {getParticipationStatusLabel(status, participationConfirmed)}
            </span>
          </div>

          <p className="participation-card__line">{email}</p>
          <p className="participation-card__line">{phone}</p>

          {participationConfirmed && confirmationDate ? (
            <p className="participation-card__confirmation-note">
              Подтверждено {confirmationDate}
              {confirmedByName ? `, ${confirmedByName}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {isApproved ? (
        <div className="participation-card__actions">
          {participationConfirmed ? (
            <button
              type="button"
              className="participation-card__cancel"
              onClick={() => onCancel?.(id)}
              disabled={isCancelling}
            >
              {isCancelling ? "Отмена..." : "Отменить"}
            </button>
          ) : (
            <button
              type="button"
              className="participation-card__confirm"
              onClick={() => onConfirm?.(id)}
              disabled={isConfirming}
            >
              {isConfirming ? "Подтверждение..." : "Подтвердить"}
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}