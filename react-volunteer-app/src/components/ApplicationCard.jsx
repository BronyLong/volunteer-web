import "./ApplicationCard.css";

import womanAvatar from "../assets/images/avatar_woman.png";
import emailIcon from "../assets/SVG/email_footer.svg";
import phoneIcon from "../assets/SVG/phone_footer.svg";

export default function ApplicationCard({
  id,
  avatar = womanAvatar,
  email = "example@mail.ru",
  phone = "8 (800) 555-35-35",
  name = "Ксения",
  secondName = "Михайловна",
  status = "active",
  onReject,
  onRestore,
  isRejecting = false,
  isRestoring = false,
}) {
  const isRejected = status === "rejected";

  return (
    <article className="application-item">
      <div className="application-item__person">
        <div className="application-item__avatar-wrap">
          <img src={avatar} alt="Заявитель" className="application-item__avatar" />
        </div>

        <div className="application-item__info">
          <h3 className="application-item__name">
            {name} {secondName}
          </h3>

          <p className="application-item__line">
            <img src={emailIcon} alt="" className="application-item__icon" />
            <span>{email}</span>
          </p>

          <p className="application-item__line">
            <img src={phoneIcon} alt="" className="application-item__icon" />
            <span>{phone}</span>
          </p>

          <p
            className={`application-item__status ${
              isRejected
                ? "application-item__status--rejected"
                : "application-item__status--active"
            }`}
          >
            {isRejected ? "Заявка отклонена" : "Заявка активна"}
          </p>
        </div>
      </div>

      {isRejected ? (
        <button
          type="button"
          className="application-item__restore"
          onClick={() => onRestore?.(id)}
          disabled={isRestoring}
        >
          {isRestoring ? "Восстанавливаем..." : "Восстановить заявку"}
        </button>
      ) : (
        <button
          type="button"
          className="application-item__reject"
          onClick={() => onReject?.(id)}
          disabled={isRejecting}
        >
          {isRejecting ? "Отклоняем..." : "Отклонить заявку"}
        </button>
      )}
    </article>
  );
}