import { Link } from "react-router-dom";
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

export default function HomePage() {
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

        <div className="hero__event-card">
          <p className="hero__event-subtitle">Ближайшее мероприятие</p>

          <h2 className="hero__event-title">
            Название название
            название название
          </h2>

          <p className="hero__event-date">Дата проведения: 1.01.1980</p>

          <div className="event-preview">
            <div className="event-preview__inner">
              <div className="event-preview__top">
                <div className="event-preview__image-wrap">
                  <img src={animalsHelpImage} alt="Мероприятие" className="event-preview__image" />
                </div>

                <div className="event-preview__place">
                  <span className="event-preview__label">
                    МЕСТО
                    <img src={locationIcon} alt="" className="inline-icon-svg"/>
                  </span>
                  <p>Место проведения место проведения</p>
                </div>
              </div>

              <div className="event-preview__places">
                <span className="event-preview__label">
                  СВОБОДНЫХ МЕСТ
                  <img src={availableSpacesIcon} alt="" className="inline-icon-svg" />
                </span>
                <strong>20 из 20</strong>
              </div>

              <div className="event-preview__category-row">
                <div className="event-preview__category-pill">
                  <img src={leafCategoryIcon} alt="" className="inline-icon-svg" />
                  Экология
                </div>
              </div>

              <Link to="*" class="event-preview__button">
                Подать заявку
              </Link>
            </div>
          </div>

          <div className="hero__slider-dots">
            <span className="hero__dot hero__dot--active"></span>
            <span className="hero__dot"></span>
            <span className="hero__dot"></span>
            <span className="hero__dot"></span>
          </div>
        </div>
      </div>
    </section>

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
              <img src={calendarIcon} alt="" class="feature-card__icon-svg" />
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

        <div className="join-banner">
          <div className="join-banner__text">Хотите стать частью команды?</div>
          <Link to="/events" className="join-banner__button">
            Принять участие
          </Link>
        </div>
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

    <section className="events">
      <div className="container">
        <p className="section-label section-label--green">Мероприятия</p>
        <h2 className="section-title">Вы можете помочь здесь</h2>

        <div className="events__grid">
          <article className="event-card">
            <div className="event-card__top">
              <span className="event-card__tag event-card__tag--green">
                <img src={leafCategoryIcon} alt="" className="tag-icon-svg" />
                Экология
              </span>
              <span className="event-card__spots">20 мест</span>
            </div>
            <h3 className="event-card__title">Экологическая акция в городском парке</h3>
            <div className="event-card__meta">
              <p>
                <img src={locationIcon} alt="" className="meta-icon-svg" />
                Центральный парк
              </p>
              <p>
                <img src={calendarCardIcon} alt="" className="meta-icon-svg" />
                15 июня 2026
              </p>
            </div>
            <Link to="*" className="event-card__button event-card__button--green">
              Подробнее
            </Link>
          </article>

          <article className="event-card">
            <div className="event-card__top">
              <span className="event-card__tag event-card__tag--orange">
                <img src={elderlyCategoryIcon} alt="" className="tag-icon-svg" />
                Пожилым
              </span>
              <span className="event-card__spots">20 мест</span>
            </div>
            <h3 className="event-card__title">Поддержка пожилых людей</h3>
            <div className="event-card__meta">
              <p>
                <img src={locationIcon} alt="" className="meta-icon-svg" />
                Дом ветеранов
              </p>
              <p>
                <img src={calendarCardIcon} alt="" className="meta-icon-svg" />
                15 августа 2026
              </p>
            </div>
            <Link to="*" className="event-card__button event-card__button--orange">
              Подробнее
            </Link>
          </article>

          <article className="event-card">
            <div className="event-card__top">
              <span className="event-card__tag event-card__tag--green">
                <img src={animalsCategoryIcon} alt="" className="tag-icon-svg" />
                Животным
              </span>
              <span className="event-card__spots">20 мест</span>
            </div>
            <h3 className="event-card__title">Помощь приюту для животных</h3>
            <div className="event-card__meta">
              <p>
                <img src={locationIcon} alt="" className="meta-icon-svg" />
                Приют “Добрые лапы”
              </p>
              <p>
                <img src={calendarCardIcon} alt="" className="meta-icon-svg" />
                20 октября 2026
              </p>
            </div>
            <Link to="*" className="event-card__button event-card__button--green">
              Подробнее
            </Link>
          </article>

          <article className="event-card event-card--mobile-only">
            <div className="event-card__top">
              <span className="event-card__tag event-card__tag--orange">
                <img src={childrenCategoryIcon} alt="" className="tag-icon-svg" />
                Детям
              </span>
              <span className="event-card__spots">18 мест</span>
            </div>
            <h3 className="event-card__title">Помощь детям-инвалидам</h3>
            <div className="event-card__meta">
              <p>
                <img src={locationIcon} alt="" className="meta-icon-svg" />
                Детский дом "Аист"
              </p>
              <p>
                <img src={calendarCardIcon} alt="" className="meta-icon-svg" />
                2 ноября 2026
              </p>
            </div>
            <Link to="*" className="event-card__button event-card__button--orange">
              Подробнее
            </Link>
          </article>
        </div>
      </div>
    </section>

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
    </>
  );
}