import "./EventsPage.css"

import EventCard from "../components/EventCard";
import animalsHelpImage from "../assets/images/animals_help.png";
import childrenHelpImage from "../assets/images/children_help.png";
import peopleImage from "../assets/images/people.png"
import leafCategoryIcon from "../assets/SVG/leaf_category.svg";
import elderlyCategoryIcon from "../assets/SVG/elderly_category.svg";
import animalsCategoryIcon from "../assets/SVG/animals_category.svg";
import childrenCategoryIcon from "../assets/SVG/childern_category.svg";

export default function EventsPage() {
  return (
    <main className="events-page">
    <section className="events-hero">
      <div className="events-hero__background"></div>

      <div className="container events-hero__inner">
        <div className="events-hero__content">
          <h1 className="events-hero__title">Доступные мероприятия</h1>
          <p className="events-hero__subtitle">
            Находите интересные задания, в которых можно принять участие и помочь местным
          </p>
        </div>

        <div className="events-hero__people">
          <img src={peopleImage} alt="Волонтеры" className="events-hero__people-image" />
        </div>
      </div>
    </section>

    <section className="events-catalog">
      <div className="container">
        <div className="events-filters">
          <button className="events-filters__button events-filters__button--active" type="button">
            <span>Все категории</span>
          </button>

          <button className="events-filters__button" type="button">
            <span className="events-filters__icon-wrap">
              <img src={leafCategoryIcon} alt="" className="events-filters__icon" />
            </span>
            <span>Экология</span>
          </button>

          <button className="events-filters__button events-filters__button--orange" type="button">
            <span className="events-filters__icon-wrap">
              <img src={childrenCategoryIcon} alt="" className="events-filters__icon" />
            </span>
            <span>Детям</span>
          </button>

          <button className="events-filters__button" type="button">
            <span className="events-filters__icon-wrap">
              <img src={animalsCategoryIcon} alt="" className="events-filters__icon" />
            </span>
            <span>Животным</span>
          </button>

          <button className="events-filters__button events-filters__button--orange" type="button">
            <span className="events-filters__icon-wrap">
              <img src={elderlyCategoryIcon} alt="" className="events-filters__icon" />
            </span>
            <span>Пожилым</span>
          </button>
        </div>

        <div className="events-divider"></div>

        <div className="events-grid">
          <EventCard
            title="Экологическая акция в городском мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу  парке"
            date="12.05.2026"
            location="г. Икс, городской парк"
            places="20 из 20"
            image={animalsHelpImage}
            category="ecology"
          />

          <EventCard
            title="Помощь детям"
            date="15.05.2026"
            location="г. Икс, детский центр"
            places="12 из 20"
            image={childrenHelpImage}
            category="children"
            link="/events/1"
          />
          <EventCard
            title="Помощь детям"
            date="15.05.2026"
            location="г. Икс, детский центр"
            places="12 из 20"
            image={childrenHelpImage}
            category="animals"
            link="/events/1"
          />
          <EventCard
            title="Экологическая акция в городском мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу  парке"
            date="12.05.2026"
            location="г. Икс, городской парк"
            places="20 из 20"
            image={animalsHelpImage}
            category="elderly"
          />
          <EventCard
            title="Помощь детям"
            date="15.05.2026"
            location="г. Икс, детский центр"
            places="12 из 20"
            image={childrenHelpImage}
            category="children"
            link="/events/1"
          />
          <EventCard
            title="Экологическая акция в городском мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу мяу  парке"
            date="12.05.2026"
            location="г. Икс, городской парк"
            places="20 из 20"
            image={animalsHelpImage}
            category="ecology"
          />
        </div>

        <div className="events-pagination">
          <a href="#" className="events-pagination__item events-pagination__item--active">1</a>
          <a href="#" className="events-pagination__item">2</a>
          <a href="#" className="events-pagination__item">3</a>
          <a href="#" className="events-pagination__item">4</a>
          <a href="#" className="events-pagination__item">5</a>
        </div>
      </div>
    </section>
  </main>
  );
}