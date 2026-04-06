import { Link } from "react-router-dom";
import "./EventOpenPage.css";

import ApplicationCard from "../components/ApplicationCard";

import eventSettings from "../assets/SVG/cog.svg";
import eventCheckmark from "../assets/SVG/checkmark.svg";
import leafCategoryIcon from "../assets/SVG/leaf_category.svg";
import locationIcon from "../assets/SVG/location.svg";
import availableSpacesIcon from "../assets/SVG/avalable_spaces.svg";
import emailIcon from "../assets/SVG/email_footer.svg";
import phoneIcon from "../assets/SVG/phone_footer.svg";
import dateIcon from "../assets/SVG/calendar_card.svg"
import timeIcon from "../assets/SVG/clock.svg"

import eventImage from "../assets/images/animals_help.png";
import womanAvatar from "../assets/images/avatar_woman.png";

export default function EventOpenPage() {
  const applications = [
    {
      id: 1,
      avatar: womanAvatar,
      name: "Ксения",
      secondName: "Михайловна",
      email: "example@mail.ru",
      phone: "8 (800) 555-35-35",
    },
    {
      id: 2,
      avatar: womanAvatar,
      name: "Анна",
      secondName: "Сергеевна",
      email: "anna@mail.ru",
      phone: "8 (901) 123-45-67",
    },
    {
      id: 3,
      avatar: womanAvatar,
      name: "Мария",
      secondName: "Игоревна",
      email: "maria@mail.ru",
      phone: "8 (999) 765-43-21",
    },
  ];

  return (
    <>
      <main className="event-page">
        <section className="event-layout">
          <div className="container">
            <div className="event-shell">
              <article className="event-card">
                <div className="event-card__header">
                  <div className="event-card__header-content">
                    <h1 className="event-card__title">
                      Субботник в парке “Зеленый уголок”
                    </h1>
                    <p className="event-card__description">
                      Мы приглашаем вас принять участие в субботнике по уборке парка
                      “Зеленый уголок”. Наша цель - сделать парк чистым, удобным и более
                      веселым местом для всех жителей города.
                    </p>
                  </div>

                  <Link
                    to="/settings"
                    className="event-card__settings"
                    aria-label="Редактировать мероприятие"
                  >
                    <img
                      src={eventSettings}
                      alt=""
                      className="event-card__settings-icon"
                    />
                  </Link>
                </div>

                <div className="event-card__top-grid">
                  <div className="event-card__image-box">
                    <img
                      src={eventImage}
                      alt="Субботник в парке"
                      className="event-card__image"
                    />
                  </div>

                  <div className="event-card__tasks-box">
                    <h2 className="event-card__section-title">
                      Что предстоит сделать
                    </h2>

                    <ul className="event-card__tasks-list">
                      <li className="event-card__task-item">
                        <img
                          src={eventCheckmark}
                          alt=""
                          className="event-card__task-icon"
                        />
                        <span>Уборка мусора, сортировка отходов</span>
                      </li>
                      <li className="event-card__task-item">
                        <img
                          src={eventCheckmark}
                          alt=""
                          className="event-card__task-icon"
                        />
                        <span>Посадка новых деревьев и кустарников</span>
                      </li>
                      <li className="event-card__task-item">
                        <img
                          src={eventCheckmark}
                          alt=""
                          className="event-card__task-icon"
                        />
                        <span>
                          Обустройство зоны отдыха новыми лавочками и урнами
                        </span>
                      </li>
                      <li className="event-card__task-item">
                        <img
                          src={eventCheckmark}
                          alt=""
                          className="event-card__task-icon"
                        />
                        <span>
                          Обустройство зоны отдыха новыми лавочками и урнами
                        </span>
                      </li>
                      <li className="event-card__task-item">
                        <img
                          src={eventCheckmark}
                          alt=""
                          className="event-card__task-icon"
                        />
                        <span>
                          Обустройство зоны отдыха новыми лавочками и урнами
                        </span>
                      </li>
                      <li className="event-card__task-item">
                        <img
                          src={eventCheckmark}
                          alt=""
                          className="event-card__task-icon"
                        />
                        <span>
                          Обустройство зоны отдыха новыми лавочками и урнами
                        </span>
                      </li>
                      <li className="event-card__task-item">
                        <img
                          src={eventCheckmark}
                          alt=""
                          className="event-card__task-icon"
                        />
                        <span>
                          Обустройство зоны отдыха новыми лавочками и урнами
                        </span>
                      </li>
                      <li className="event-card__task-item">
                        <img
                          src={eventCheckmark}
                          alt=""
                          className="event-card__task-icon"
                        />
                        <span>
                          Обустройство зоны отдыха новыми лавочками и урнами
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="event-card__divider"></div>

                <div className="event-card__meta-grid">
                  <div className="event-card__meta-left">
                    <div className="event-card__category-pill">
                      <img
                        src={leafCategoryIcon}
                        alt=""
                        className="event-card__category-icon"
                      />
                      <span>Экология</span>
                    </div>

                    <div className="event-card__places-box">
                      <span className="event-card__meta-label">
                        СВОБОДНЫХ МЕСТ
                        <img
                          src={availableSpacesIcon}
                          alt=""
                          className="event-card__meta-inline-icon"
                        />
                      </span>
                      <strong>20 из 20</strong>
                    </div>
                  </div>

                  <div className="event-card__location-box">
                    <span className="event-card__meta-label">
                      МЕСТО ПРОВЕДЕНИЯ
                      <img
                        src={locationIcon}
                        alt=""
                        className="event-card__meta-inline-icon"
                      />
                    </span>
                    <p>
                      г. Икс, неизвестная область, улица пушкина, парк “Зеленый
                      уголок”
                    </p>
                  </div>
                </div>

                <div className="event-card__divider"></div>

                <div className="event-card__date-time-grid">
                  <div className="event-card__info-box">
                    <span className="event-card__meta-label">
                      ДАТА ПРОВЕДЕНИЯ
                      <img src={dateIcon} className="event-card__meta-inline-icon" />
                    </span>
                    <strong>1.01.1980</strong>
                  </div>

                  <div className="event-card__info-box">
                    <span className="event-card__meta-label">
                      ВРЕМЯ ПРОВЕДЕНИЯ
                      <img src={timeIcon} className="event-card__meta-inline-icon" />
                    </span>
                    <strong>11:00</strong>
                  </div>
                </div>

                <div className="event-card__divider"></div>

                <div className="event-card__bottom">
                  <div className="coordinator-card">
                    <div className="coordinator-card__label">КООРДИНАТОР</div>

                    <div className="coordinator-card__body">
                      <div className="coordinator-card__avatar-wrap">
                        <img
                          src={womanAvatar}
                          alt="Координатор"
                          className="coordinator-card__avatar"
                        />
                      </div>

                      <div className="coordinator-card__info">
                        <h3 className="coordinator-card__name">
                          Ксения Михайловна
                        </h3>

                        <p className="coordinator-card__line">
                          <img
                            src={emailIcon}
                            alt=""
                            className="coordinator-card__icon"
                          />
                          <span>example@mail.ru</span>
                        </p>

                        <p className="coordinator-card__line">
                          <img
                            src={phoneIcon}
                            alt=""
                            className="coordinator-card__icon"
                          />
                          <span>8 (800) 555-35-35</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <a href="#" className="event-card__join-button">
                    Принять участие
                  </a>
                </div>
              </article>
            </div>

            <section className="applications-section">
              <div className="applications-card">
                <h2 className="applications-card__title">Поданные заявки</h2>

                {applications.length > 0 ? (
                  <div className="applications-list">
                    {applications.map((application) => (
                      <ApplicationCard
                        key={application.id}
                        avatar={application.avatar}
                        name={application.name}
                        secondName={application.secondName}
                        email={application.email}
                        phone={application.phone}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="applications-empty">
                    Пока нет поданных заявок на это мероприятие
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </main>
    </>
  );
}