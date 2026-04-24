import { Link } from "react-router-dom";
import "./ApplicationCard.css";

function getStatusLabel(status) {
  switch (status) {
    case "pending":
      return "Ожидает решения";
    case "approved":
      return "Принята";
    case "rejected":
      return "Отклонена";
    default:
      return "Неизвестно";
  }
}

function getStatusClass(status) {
  switch (status) {
    case "pending":
      return "application-card__status application-card__status--pending";
    case "approved":
      return "application-card__status application-card__status--approved";
    case "rejected":
      return "application-card__status application-card__status--rejected";
    default:
      return "application-card__status";
  }
}

export default function ApplicationCard({
  id,
  userId,
  avatar,
  name,
  secondName,
  email,
  phone,
  status = "pending",
  onAccept,
  onReject,
  isAccepting = false,
  isRejecting = false,
  canAccept = true,
  canReject = true,
}) {
  const isPending = status === "pending";
  const fullName = `${name} ${secondName}`.trim() || "Пользователь";
  const profileLink = userId ? `/profiles/${userId}` : null;

  return (
    <article className="application-card">
      <div className="application-card__user">
        {profileLink ? (
          <Link
            to={profileLink}
            className="application-card__avatar-link"
            aria-label={`Перейти в профиль пользователя ${fullName}`}
            title="Открыть профиль"
          >
            <img src={avatar} alt={fullName} className="application-card__avatar" />
          </Link>
        ) : (
          <img src={avatar} alt={fullName} className="application-card__avatar" />
        )}

        <div className="application-card__info">
          <h3 className="application-card__name">{fullName}</h3>
          <span className={getStatusClass(status)}>{getStatusLabel(status)}</span>
          <p className="application-card__line">{email}</p>
          <p className="application-card__line">{phone}</p>
        </div>
      </div>

      {isPending ? (
        <div className="application-card__actions">
          <button
            type="button"
            className="application-card__accept"
            onClick={() => onAccept?.(id)}
            disabled={isAccepting || !canAccept}
            aria-label="Принять заявку"
            title={!canAccept ? "Нельзя изменять заявки завершённого мероприятия" : "Принять заявку"}
          >
            {isAccepting ? "Принятие..." : "Принять"}
          </button>

          <button
            type="button"
            className="application-card__reject"
            onClick={() => onReject?.(id)}
            disabled={isRejecting || !canReject}
            aria-label="Отклонить заявку"
            title={!canReject ? "Нельзя изменять заявки завершённого мероприятия" : "Отклонить заявку"}
          >
            {isRejecting ? "Отклонение..." : "Отклонить"}
          </button>
        </div>
      ) : null}
    </article>
  );
}
