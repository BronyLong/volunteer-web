import { Link } from "react-router-dom";
import "./EventCard.css";

import locationIcon from "../assets/SVG/location.svg";
import availableSpacesIcon from "../assets/SVG/avalable_spaces.svg";
import leafCategoryIcon from "../assets/SVG/leaf_category.svg";
import childrenCategoryIcon from "../assets/SVG/childern_category.svg";
import animalsCategoryIcon from "../assets/SVG/animals_category.svg";
import elderlyCategoryIcon from "../assets/SVG/elderly_category.svg";

const categoryMap = {
  ecology: {
    label: "Экология",
    theme: "green",
    icon: leafCategoryIcon,
  },
  children: {
    label: "Детям",
    theme: "orange",
    icon: childrenCategoryIcon,
  },
  animals: {
    label: "Животным",
    theme: "green",
    icon: animalsCategoryIcon,
  },
  elderly: {
    label: "Пожилым",
    theme: "orange",
    icon: elderlyCategoryIcon,
  },
};

export default function EventCard({
  title = "Название название название название",
  date = "1.01.1980",
  location = "Место проведения место место проведения",
  places = "20 из 20",
  image,
  category = "ecology",
  link = "/event",
}) {
  const currentCategory = categoryMap[category] || categoryMap.ecology;

  return (
    <article className={`event-tile event-tile--${currentCategory.theme}`}>
      <h2 className="event-tile__title">{title}</h2>
      <p className="event-tile__date">Дата проведения: {date}</p>

      <div className="event-tile__card">
        <div className="event-tile__top">
          <div className="event-tile__image-wrap">
            <img src={image} alt="Мероприятие" className="event-tile__image" />
          </div>

          <div className="event-tile__place">
            <span className="event-tile__label">
              МЕСТО
              <img src={locationIcon} alt="" className="event-tile__inline-icon" />
            </span>
            <p>{location}</p>
          </div>
        </div>

        <div className="event-tile__spots">
          <span className="event-tile__label">
            СВОБОДНЫХ МЕСТ
            <img src={availableSpacesIcon} alt="" className="event-tile__inline-icon" />
          </span>
          <strong>{places}</strong>
        </div>

        <div className="event-tile__category-row">
          <div className="event-tile__category-pill">
            <img src={currentCategory.icon} alt="" className="event-tile__category-icon" />
            {currentCategory.label}
              </div>
            </div>

            <Link to={link} className={`event-tile__button event-tile__button--${currentCategory.theme}`}>Подробнее</Link>
        </div>
    </article>
  );
}