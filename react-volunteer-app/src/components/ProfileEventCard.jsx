import { Link } from "react-router-dom";
import "./ProfileEventCard.css";

import locationIcon from "../assets/SVG/location_footer.svg";
import calendarIcon from "../assets/SVG/calendar_green.svg";

export default function ProfileEventCard({
  title = 'Субботник в парке “Зеленый уголок”',
  location = 'г. Икс, неизвестная область, улица пушкина, парк “Зеленый уголок”',
  date = "1.01.1980",
  buttonText = "К мероприятию",
  link = "/event",
}) {
  return (
    <article className="profile-event-card">
      <div className="profile-event-card__content">
        <h3 className="profile-event-card__title">{title}</h3>

        <div className="profile-event-card__meta">
          <div className="profile-event-card__row">
            <img
              src={locationIcon}
              alt=""
              className="profile-event-card__icon"
            />
            <span>{location}</span>
          </div>

          <div className="profile-event-card__row">
            <img
              src={calendarIcon}
              alt=""
              className="profile-event-card__icon"
            />
            <span>{date}</span>
          </div>
        </div>
      </div>

      <div className="profile-event-card__action">
        <Link to={link} className="profile-event-card__button">
          {buttonText}
        </Link>
      </div>
    </article>
  );
}