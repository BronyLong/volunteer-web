import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import "./HomePage.css";

import locationIcon from "../assets/SVG/location.svg";
import availableSpacesIcon from "../assets/SVG/avalable_spaces.svg";
import leafCategoryIcon from "../assets/SVG/leaf_category.svg";
import elderlyCategoryIcon from "../assets/SVG/elderly_category.svg";
import animalsCategoryIcon from "../assets/SVG/animals_category.svg";
import childrenCategoryIcon from "../assets/SVG/childern_category.svg";
import rocketIcon from "../assets/SVG/rocket.svg";
import calendarIcon from "../assets/SVG/calendar.svg";
import statisticsIcon from "../assets/SVG/statistics.svg";
import toolsIcon from "../assets/SVG/hammer_and_wrench.svg";
import calendarCardIcon from "../assets/SVG/calendar_card.svg";

import animalsHelpImage from "../assets/images/animals_help.png";

const HERO_SLIDES_COUNT = 4;
const HERO_AUTOPLAY_MS = 5000;
const HERO_FADE_MS = 220;

const CATEGORY_META = {
  ecology: {
    label: "Экология",
    icon: leafCategoryIcon,
    tagClass: "event-card__tag--green",
    buttonClass: "event-card__button--green",
    heroButtonClass: "event-preview__button--green",
    heroClass: "hero__event-card--green",
    heroDotsClass: "hero__slider-dots--green",
  },
  children: {
    label: "Детям",
    icon: childrenCategoryIcon,
    tagClass: "event-card__tag--orange",
    buttonClass: "event-card__button--orange",
    heroButtonClass: "event-preview__button--orange",
    heroClass: "hero__event-card--orange",
    heroDotsClass: "hero__slider-dots--orange",
  },
  animals: {
    label: "Животным",
    icon: animalsCategoryIcon,
    tagClass: "event-card__tag--green",
    buttonClass: "event-card__button--green",
    heroButtonClass: "event-preview__button--green",
    heroClass: "hero__event-card--green",
    heroDotsClass: "hero__slider-dots--green",
  },
  elderly: {
    label: "Пожилым",
    icon: elderlyCategoryIcon,
    tagClass: "event-card__tag--orange",
    buttonClass: "event-card__button--orange",
    heroButtonClass: "event-preview__button--orange",
    heroClass: "hero__event-card--orange",
    heroDotsClass: "hero__slider-dots--orange",
  },
};

const CATEGORY_PRIORITY = ["ecology", "children", "animals", "elderly"];

function normalizeCategory(categoryName = "") {
  const normalized = String(categoryName).trim().toLowerCase();

  if (normalized === "экология" || normalized === "ecology") return "ecology";
  if (normalized === "детям" || normalized === "children") return "children";
  if (normalized === "животным" || normalized === "animals") return "animals";
  if (normalized === "пожилым" || normalized === "elderly") return "elderly";

  return "ecology";
}

function formatDate(dateString) {
  if (!dateString) return "Дата не указана";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Дата не указана";

  return date.toLocaleDateString("ru-RU");
}

function isUpcoming(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return date.getTime() >= now.getTime();
}

function sortByNearestDate(items) {
  return [...items].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );
}

function decorateEvent(event) {
  const categoryKey = normalizeCategory(event.category_name);
  const meta = CATEGORY_META[categoryKey];

  return {
    ...event,
    categoryKey,
    categoryLabel: meta.label,
    categoryIcon: meta.icon,
    tagClass: meta.tagClass,
    buttonClass: meta.buttonClass,
    heroButtonClass: meta.heroButtonClass,
    heroClass: meta.heroClass,
    heroDotsClass: meta.heroDotsClass,
    formattedDate: formatDate(event.start_at),
    spotsText: `${event.available_slots ?? 0} мест`,
    placesText: `${event.available_slots ?? 0} из ${event.participant_limit ?? 0}`,
    image: animalsHelpImage,
  };
}

function fillToCount(items, count) {
  if (!items.length) return [];

  const result = [...items];
  let index = 0;

  while (result.length < count) {
    result.push(items[index % items.length]);
    index += 1;
  }

  return result.slice(0, count);
}

function selectEventsByCategory(events, count = 4) {
  if (!events.length) return [];

  const result = [];
  const usedIds = new Set();

  for (const category of CATEGORY_PRIORITY) {
    const found = events.find(
      (event) => event.categoryKey === category && !usedIds.has(event.id)
    );

    if (found) {
      result.push(found);
      usedIds.add(found.id);
    }
  }

  for (const event of events) {
    if (result.length >= count) break;

    if (!usedIds.has(event.id)) {
      result.push(event);
      usedIds.add(event.id);
    }
  }

  return fillToCount(result, count);
}

export default function HomePage() {
  const [events, setEvents] = useState([]);
  const [requestedSlide, setRequestedSlide] = useState(0);
  const [visibleSlide, setVisibleSlide] = useState(0);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [carouselTick, setCarouselTick] = useState(0);

  const fadeTimeoutRef = useRef(null);

  useEffect(() => {
    apiFetch("/events")
      .then((data) => {
        const upcomingEvents = sortByNearestDate(
          data.filter((event) => isUpcoming(event.start_at))
        );

        const sourceEvents = upcomingEvents.length
          ? upcomingEvents
          : sortByNearestDate(data);

        setEvents(sourceEvents.map(decorateEvent));
      })
      .catch((error) => {
        console.error("Не удалось загрузить мероприятия:", error);
      });
  }, []);

  const heroEvents = useMemo(() => {
    return selectEventsByCategory(events, HERO_SLIDES_COUNT);
  }, [events]);

  const helpEvents = useMemo(() => {
    return selectEventsByCategory(events, 4);
  }, [events]);

  useEffect(() => {
    if (!heroEvents.length) return;
    if (requestedSlide >= heroEvents.length) {
      setRequestedSlide(0);
      setVisibleSlide(0);
    }
  }, [heroEvents, requestedSlide]);

  useEffect(() => {
    if (!heroEvents.length) return undefined;
    if (requestedSlide === visibleSlide) return undefined;

    setIsHeroVisible(false);

    fadeTimeoutRef.current = window.setTimeout(() => {
      setVisibleSlide(requestedSlide);
      setIsHeroVisible(true);
    }, HERO_FADE_MS);

    return () => {
      if (fadeTimeoutRef.current) {
        window.clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [requestedSlide, visibleSlide, heroEvents.length]);

  useEffect(() => {
    if (heroEvents.length <= 1) return undefined;

    const intervalId = window.setInterval(() => {
      setRequestedSlide((prev) => (prev + 1) % heroEvents.length);
    }, HERO_AUTOPLAY_MS);

    return () => window.clearInterval(intervalId);
  }, [heroEvents.length, carouselTick]);

  const handleDotClick = (index) => {
    setRequestedSlide(index);
    setCarouselTick((prev) => prev + 1);
  };

  const currentHeroEvent = heroEvents[visibleSlide] || null;

  const helpEvent1 = helpEvents[0] || null;
  const helpEvent2 = helpEvents[1] || null;
  const helpEvent3 = helpEvents[2] || null;
  const helpEvent4 = helpEvents[3] || null;

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__content">
            <h1 className="hero__title">
              Присоединяйтесь к добрым делам и находите мероприятия, где ваша помощь действительно нужна
            </h1>

            <p className="hero__text">
              Сайт помогает регистрироваться, подавать заявки на участие,
              отслеживать волонтёрские часы и взаимодействовать с
              координаторами в одном удобном интерфейсе.
            </p>

            <div className="hero__actions">
              <Link to="/events" className="hero__button hero__button--filled">
                Смотреть мероприятия
              </Link>
              <a href="#advantages" className="hero__button hero__button--outline">
                Узнать о платформе
              </a>
            </div>
          </div>

          <div
            className={`hero__event-card ${
              currentHeroEvent ? currentHeroEvent.heroClass : ""
            }`}
          >
            <p className="hero__event-subtitle">Ближайшее мероприятие</p>

            <div
              className={`hero__event-card-content ${
                isHeroVisible ? "hero__event-card-content--visible" : ""
              }`}
            >
              <h2 className="hero__event-title">
                {currentHeroEvent ? currentHeroEvent.title : "Загрузка мероприятий"}
              </h2>

              <p className="hero__event-date">
                Дата проведения: {currentHeroEvent ? currentHeroEvent.formattedDate : "—"}
              </p>

              <div className="event-preview">
                <div className="event-preview__inner">
                  <div className="event-preview__top">
                    <div className="event-preview__image-wrap">
                      <img
                        src={currentHeroEvent ? currentHeroEvent.image : animalsHelpImage}
                        alt="Мероприятие"
                        className="event-preview__image"
                      />
                    </div>

                    <div className="event-preview__place">
                      <span className="event-preview__label">
                        МЕСТО
                        <img src={locationIcon} alt="" className="inline-icon-svg" />
                      </span>
                      <p>
                        {currentHeroEvent
                          ? currentHeroEvent.location
                          : "Место проведения"}
                      </p>
                    </div>
                  </div>

                  <div className="event-preview__places">
                    <span className="event-preview__label">
                      СВОБОДНЫХ МЕСТ
                      <img src={availableSpacesIcon} alt="" className="inline-icon-svg" />
                    </span>
                    <strong>{currentHeroEvent ? currentHeroEvent.placesText : "—"}</strong>
                  </div>

                  <div className="event-preview__category-row">
                    <div className="event-preview__category-pill">
                      <img
                        src={currentHeroEvent ? currentHeroEvent.categoryIcon : leafCategoryIcon}
                        alt=""
                        className="inline-icon-svg"
                      />
                      {currentHeroEvent ? currentHeroEvent.categoryLabel : "Экология"}
                    </div>
                  </div>

                  <Link
                    to={currentHeroEvent ? `/events/${currentHeroEvent.id}` : "/events"}
                    className={`event-preview__button ${
                      currentHeroEvent
                        ? currentHeroEvent.heroButtonClass
                        : "event-preview__button--green"
                    }`}
                  >
                    Подать заявку
                  </Link>
                </div>
              </div>
            </div>

            <div
              className={`hero__slider-dots ${
                currentHeroEvent
                  ? currentHeroEvent.heroDotsClass
                  : "hero__slider-dots--green"
              }`}
            >
              {(heroEvents.length ? heroEvents : Array.from({ length: 4 })).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`hero__dot ${index === requestedSlide ? "hero__dot--active" : ""}`}
                  onClick={() => handleDotClick(index)}
                  aria-label={`Слайд ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider"></div>

      <section className="advantages" id="advantages">
        <div className="container">
          <p className="section-label section-label--orange">О платформе</p>
          <h2 className="section-title">Что получает пользователь от системы</h2>

          <div className="advantages__grid">
            <article className="feature-card">
              <div className="feature-card__icon">
                <img src={rocketIcon} alt="" className="feature-card__icon-svg" />
              </div>
              <h3 className="feature-card__title">Удобный старт</h3>
              <p className="feature-card__text">Быстрая регистрация и понятная навигация для новых волонтёров.</p>
            </article>

            <article className="feature-card">
              <div className="feature-card__icon">
                <img src={calendarIcon} alt="" className="feature-card__icon-svg" />
              </div>
              <h3 className="feature-card__title">Актуальные события</h3>
              <p className="feature-card__text">Каталог мероприятий с датой, местом, статусом и доступными местами.</p>
            </article>

            <article className="feature-card">
              <div className="feature-card__icon">
                <img src={statisticsIcon} alt="" className="feature-card__icon-svg" />
              </div>
              <h3 className="feature-card__title">Прозрачная активность</h3>
              <p className="feature-card__text">Личный кабинет со статистикой участия и подтверждёнными часами.</p>
            </article>

            <article className="feature-card">
              <div className="feature-card__icon">
                <img src={toolsIcon} alt="" className="feature-card__icon-svg" />
              </div>
              <h3 className="feature-card__title">Удобные инструменты</h3>
              <p className="feature-card__text">Функции для координаторов и администраторов без перегрузки интерфейса.</p>
            </article>
          </div>  
        </div>
      </section>

      <div className="section-divider"></div>

      <section className="join-banner-cta">
        <div className="join-banner">
            <div className="join-banner__text">Хотите стать частью команды?</div>
              <Link to="/events" className="join-banner__button">
                Принять участие
              </Link>
          </div>
      </section>

      <section className="steps">
        <div className="container">
          <p className="section-label section-title--center section-label--green">Как это работает</p>
          <h2 className="section-title section-title--center">Как стать волонтером в 4 шага</h2>

          <div className="steps__grid">
            <article className="step-card">
              <span className="step-card__num">01</span>
              <h3 className="step-card__title">Зарегистрируйтесь</h3>
              <p className="step-card__text">Создайте аккаунт, заполните профиль и укажите основную информацию о себе.</p>
            </article>

            <article className="step-card">
              <span className="step-card__num">02</span>
              <h3 className="step-card__title">Выберите мероприятие</h3>
              <p className="step-card__text">Найдите подходящую инициативу по дате, категории и формату участия.</p>
            </article>

            <article className="step-card">
              <span className="step-card__num">03</span>
              <h3 className="step-card__title">Подайте заявку</h3>
              <p className="step-card__text">Оставьте заявку на участие и отслеживайте её статус в личном кабинете.</p>
            </article>

            <article className="step-card">
              <span className="step-card__num">04</span>
              <h3 className="step-card__title">Помогайте и развивайтесь</h3>
              <p className="step-card__text">Участвуйте в мероприятиях, накапливайте часы и следите за своей статистикой.</p>
            </article>
          </div>
        </div>
      </section>

      <div className="section-divider"></div>

      <section className="events">
        <div className="container">
          <p className="section-label section-label--green">Мероприятия</p>
          <h2 className="section-title">Вы можете помочь здесь</h2>

          <div className="events__grid">
            <article className="event-card">
              <div className="event-card__top">
                <span className={`event-card__tag ${helpEvent1 ? helpEvent1.tagClass : "event-card__tag--green"}`}>
                  <img
                    src={helpEvent1 ? helpEvent1.categoryIcon : leafCategoryIcon}
                    alt=""
                    className="tag-icon-svg"
                  />
                  {helpEvent1 ? helpEvent1.categoryLabel : "Экология"}
                </span>
                <span className="event-card__spots">
                  {helpEvent1 ? helpEvent1.spotsText : "20 мест"}
                </span>
              </div>
              <h3 className="event-card__title-home">
                {helpEvent1 ? helpEvent1.title : "Экологическая акция в городском парке"}
              </h3>
              <div className="event-card__meta">
                <p>
                  <img src={locationIcon} alt="" className="meta-icon-svg" />
                  {helpEvent1 ? helpEvent1.location : "Центральный парк"}
                </p>
                <p>
                  <img src={calendarCardIcon} alt="" className="meta-icon-svg" />
                  {helpEvent1 ? helpEvent1.formattedDate : "15 июня 2026"}
                </p>
              </div>
              <Link
                to={helpEvent1 ? `/events/${helpEvent1.id}` : "*"}
                className={`event-card__button ${
                  helpEvent1 ? helpEvent1.buttonClass : "event-card__button--green"
                }`}
              >
                Подробнее
              </Link>
            </article>

            <article className="event-card">
              <div className="event-card__top">
                <span className={`event-card__tag ${helpEvent2 ? helpEvent2.tagClass : "event-card__tag--orange"}`}>
                  <img
                    src={helpEvent2 ? helpEvent2.categoryIcon : elderlyCategoryIcon}
                    alt=""
                    className="tag-icon-svg"
                  />
                  {helpEvent2 ? helpEvent2.categoryLabel : "Пожилым"}
                </span>
                <span className="event-card__spots">
                  {helpEvent2 ? helpEvent2.spotsText : "20 мест"}
                </span>
              </div>
              <h3 className="event-card__title-home">
                {helpEvent2 ? helpEvent2.title : "Поддержка пожилых людей"}
              </h3>
              <div className="event-card__meta">
                <p>
                  <img src={locationIcon} alt="" className="meta-icon-svg" />
                  {helpEvent2 ? helpEvent2.location : "Дом ветеранов"}
                </p>
                <p>
                  <img src={calendarCardIcon} alt="" className="meta-icon-svg" />
                  {helpEvent2 ? helpEvent2.formattedDate : "15 августа 2026"}
                </p>
              </div>
              <Link
                to={helpEvent2 ? `/events/${helpEvent2.id}` : "*"}
                className={`event-card__button ${
                  helpEvent2 ? helpEvent2.buttonClass : "event-card__button--orange"
                }`}
              >
                Подробнее
              </Link>
            </article>

            <article className="event-card">
              <div className="event-card__top">
                <span className={`event-card__tag ${helpEvent3 ? helpEvent3.tagClass : "event-card__tag--green"}`}>
                  <img
                    src={helpEvent3 ? helpEvent3.categoryIcon : animalsCategoryIcon}
                    alt=""
                    className="tag-icon-svg"
                  />
                  {helpEvent3 ? helpEvent3.categoryLabel : "Животным"}
                </span>
                <span className="event-card__spots">
                  {helpEvent3 ? helpEvent3.spotsText : "20 мест"}
                </span>
              </div>
              <h3 className="event-card__title-home">
                {helpEvent3 ? helpEvent3.title : "Помощь приюту для животных"}
              </h3>
              <div className="event-card__meta">
                <p>
                  <img src={locationIcon} alt="" className="meta-icon-svg" />
                  {helpEvent3 ? helpEvent3.location : "Приют “Добрые лапы”"}
                </p>
                <p>
                  <img src={calendarCardIcon} alt="" className="meta-icon-svg" />
                  {helpEvent3 ? helpEvent3.formattedDate : "20 октября 2026"}
                </p>
              </div>
              <Link
                to={helpEvent3 ? `/events/${helpEvent3.id}` : "*"}
                className={`event-card__button ${
                  helpEvent3 ? helpEvent3.buttonClass : "event-card__button--green"
                }`}
              >
                Подробнее
              </Link>
            </article>

            <article className="event-card event-card--mobile-only">
              <div className="event-card__top">
                <span className={`event-card__tag ${helpEvent4 ? helpEvent4.tagClass : "event-card__tag--orange"}`}>
                  <img
                    src={helpEvent4 ? helpEvent4.categoryIcon : childrenCategoryIcon}
                    alt=""
                    className="tag-icon-svg"
                  />
                  {helpEvent4 ? helpEvent4.categoryLabel : "Детям"}
                </span>
                <span className="event-card__spots">
                  {helpEvent4 ? helpEvent4.spotsText : "18 мест"}
                </span>
              </div>
              <h3 className="event-card__title-home">
                {helpEvent4 ? helpEvent4.title : "Помощь детям-инвалидам"}
              </h3>
              <div className="event-card__meta">
                <p>
                  <img src={locationIcon} alt="" className="meta-icon-svg" />
                  {helpEvent4 ? helpEvent4.location : 'Детский дом "Аист"'}
                </p>
                <p>
                  <img src={calendarCardIcon} alt="" className="meta-icon-svg" />
                  {helpEvent4 ? helpEvent4.formattedDate : "2 ноября 2026"}
                </p>
              </div>
              <Link
                to={helpEvent4 ? `/events/${helpEvent4.id}` : "*"}
                className={`event-card__button ${
                  helpEvent4 ? helpEvent4.buttonClass : "event-card__button--orange"
                }`}
              >
                Подробнее
              </Link>
            </article>
          </div>
        </div>
      </section>

      <div className="section-divider"></div>

      <section className="cta">
        <div className="container">
          <div className="cta__box"> 
            <div className="cta__content">
              <h2 className="cta__title">Станьте частью волонтерского сообщества</h2>
              <p className="cta__text">
                Присоединяйтесь к платформе, выбирайте мероприятия, отслеживайте свою
                активность и помогайте тем, кому это действительно нужно.
              </p>
            </div>

            <div className="cta__actions">
              <Link to="/register" className="cta__button cta__button--light">
                Зарегистрироваться
              </Link>
              <Link to="/events" className="cta__button cta__button--solid">
                Смотреть мероприятия
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider"></div>
    </>
  );
}