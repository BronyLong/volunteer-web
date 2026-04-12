import { Link } from "react-router-dom";
import "./ApplicationCard.css";

function getStatusLabel(status) {
  switch (status) {
    case "rejected":
      return "Отклонена";
    case "active":
      return "Подана";
    default:
      return "Неизвестно";
  }
}

function getStatusClass(status) {
  switch (status) {
    case "rejected":
      return "application-card__status application-card__status--rejected";
    case "active":
      return "application-card__status application-card__status--active";
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
  status = "active",
  onReject,
  onRestore,
  isRejecting = false,
  isRestoring = false,
  canReject = true,
  canRestore = true,
}) {
  const isRejected = status === "rejected";
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
            <img
              src={avatar}
              alt={fullName}
              className="application-card__avatar"
            />
          </Link>
        ) : (
          <img
            src={avatar}
            alt={fullName}
            className="application-card__avatar"
          />
        )}

        <div className="application-card__info">
          <h3 className="application-card__name">{fullName}</h3>

          <span className={getStatusClass(status)}>
            {getStatusLabel(status)}
          </span>

          <p className="application-card__line">{email}</p>
          <p className="application-card__line">{phone}</p>
        </div>
      </div>

      {isRejected ? (
        <button
          type="button"
          className="application-card__restore"
          onClick={() => onRestore?.(id)}
          disabled={isRestoring || !canRestore}
          aria-label="Восстановить заявку"
          title={
            !canRestore
              ? "Нельзя изменять заявки завершённого мероприятия"
              : "Восстановить заявку"
          }
        >
          {isRestoring ? "Восстановление..." : "Восстановить заявку"}
        </button>
      ) : (
        <button
          type="button"
          className="application-card__reject"
          onClick={() => onReject?.(id)}
          disabled={isRejecting || !canReject}
          aria-label="Отклонить заявку"
          title={
            !canReject
              ? "Нельзя изменять заявки завершённого мероприятия"
              : "Отклонить заявку"
          }
        >
          {isRejecting ? "Отклонение..." : "Отклонить заявку"}
        </button>
      )}
    </article>
  );
}