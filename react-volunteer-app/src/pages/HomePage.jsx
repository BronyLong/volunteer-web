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
      <section class="hero">
      <div class="container hero__inner">
        <div class="hero__content">
          <h1 class="hero__title">
            Присоединяйтесь к добрым делам и находите мероприятия, где ваша помощь действительно нужна
          </h1>

          <p class="hero__text">
            Сайт помогает регистрироваться, подавать заявки на участие,
            отслеживать волонтёрские часы и взаимодействовать с
            координаторами в одном удобном интерфейсе.
          </p>

          <div class="hero__actions">
            <Link to="/events" class="hero__button hero__button--filled">
              Смотреть мероприятия
            </Link>
            <a href="#advantages" className="hero__button hero__button--outline">
              Узнать о платформе
            </a>
          </div>
        </div>

        <div class="hero__event-card">
          <p class="hero__event-subtitle">Ближайшее мероприятие</p>

          <h2 class="hero__event-title">
            Название название
            название название
          </h2>

          <p class="hero__event-date">Дата проведения: 1.01.1980</p>

          <div class="event-preview">
            <div class="event-preview__inner">
              <div class="event-preview__top">
                <div class="event-preview__image-wrap">
                  <img src={animalsHelpImage} alt="Мероприятие" class="event-preview__image" />
                </div>

                <div class="event-preview__place">
                  <span class="event-preview__label">
                    МЕСТО
                    <img src={locationIcon} alt="" class="inline-icon-svg"/>
                  </span>
                  <p>Место проведения место проведения</p>
                </div>
              </div>

              <div class="event-preview__places">
                <span class="event-preview__label">
                  СВОБОДНЫХ МЕСТ
                  <img src={availableSpacesIcon} alt="" class="inline-icon-svg" />
                </span>
                <strong>20 из 20</strong>
              </div>

              <div class="event-preview__category-row">
                <div class="event-preview__category-pill">
                  <img src={leafCategoryIcon} alt="" class="inline-icon-svg" />
                  Экология
                </div>
              </div>

              <Link to="*" class="event-preview__button">
                Подать заявку
              </Link>
            </div>
          </div>

          <div class="hero__slider-dots">
            <span class="hero__dot hero__dot--active"></span>
            <span class="hero__dot"></span>
            <span class="hero__dot"></span>
            <span class="hero__dot"></span>
          </div>
        </div>
      </div>
    </section>

    <section class="advantages" id="advantages">
      <div class="container">
        <p class="section-label section-label--orange">О платформе</p>
        <h2 class="section-title">Что получает пользователь от системы</h2>

        <div class="advantages__grid">
          <article class="feature-card">
            <div class="feature-card__icon">
              <img src={rocketIcon} alt="" class="feature-card__icon-svg" />
            </div>
            <h3 class="feature-card__title">Удобный старт</h3>
            <p class="feature-card__text">Быстрая регистрация и понятная навигация для новых волонтёров.</p>
          </article>

          <article class="feature-card">
            <div class="feature-card__icon">
              <img src={calendarIcon} alt="" class="feature-card__icon-svg" />
            </div>
            <h3 class="feature-card__title">Актуальные события</h3>
            <p class="feature-card__text">Каталог мероприятий с датой, местом, статусом и доступными местами.</p>
          </article>

          <article class="feature-card">
            <div class="feature-card__icon">
              <img src={statisticsIcon} alt="" class="feature-card__icon-svg" />
            </div>
            <h3 class="feature-card__title">Прозрачная активность</h3>
            <p class="feature-card__text">Личный кабинет со статистикой участия и подтверждёнными часами.</p>
          </article>

          <article class="feature-card">
            <div class="feature-card__icon">
              <img src={toolsIcon} alt="" class="feature-card__icon-svg" />
            </div>
            <h3 class="feature-card__title">Удобные инструменты</h3>
            <p class="feature-card__text">Функции для координаторов и администраторов без перегрузки интерфейса.</p>
          </article>
        </div>

        <div class="join-banner">
          <div class="join-banner__text">Хотите стать частью команды?</div>
          <Link to="/events" class="join-banner__button">
            Принять участие
          </Link>
        </div>
      </div>
    </section>

    <section class="steps">
      <div class="container">
        <p class="section-label section-title--center section-label--green">Как это работает</p>
        <h2 class="section-title section-title--center">Как стать волонтером в 4 шага</h2>

        <div class="steps__grid">
          <article class="step-card">
            <span class="step-card__num">01</span>
            <h3 class="step-card__title">Зарегистрируйтесь</h3>
            <p class="step-card__text">Создайте аккаунт, заполните профиль и укажите основную информацию о себе.</p>
          </article>

          <article class="step-card">
            <span class="step-card__num">02</span>
            <h3 class="step-card__title">Выберите мероприятие</h3>
            <p class="step-card__text">Найдите подходящую инициативу по дате, категории и формату участия.</p>
          </article>

          <article class="step-card">
            <span class="step-card__num">03</span>
            <h3 class="step-card__title">Подайте заявку</h3>
            <p class="step-card__text">Оставьте заявку на участие и отслеживайте её статус в личном кабинете.</p>
          </article>

          <article class="step-card">
            <span class="step-card__num">04</span>
            <h3 class="step-card__title">Помогайте и развивайтесь</h3>
            <p class="step-card__text">Участвуйте в мероприятиях, накапливайте часы и следите за своей статистикой.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="events">
      <div class="container">
        <p class="section-label section-label--green">Мероприятия</p>
        <h2 class="section-title">Вы можете помочь здесь</h2>

        <div class="events__grid">
          <article class="event-card">
            <div class="event-card__top">
              <span class="event-card__tag event-card__tag--green">
                <img src={leafCategoryIcon} alt="" class="tag-icon-svg" />
                Экология
              </span>
              <span class="event-card__spots">20 мест</span>
            </div>
            <h3 class="event-card__title">Экологическая акция в городском парке</h3>
            <div class="event-card__meta">
              <p>
                <img src={locationIcon} alt="" class="meta-icon-svg" />
                Центральный парк
              </p>
              <p>
                <img src={calendarCardIcon} alt="" class="meta-icon-svg" />
                15 июня 2026
              </p>
            </div>
            <Link to="*" class="event-card__button event-card__button--green">
              Подробнее
            </Link>
          </article>

          <article class="event-card">
            <div class="event-card__top">
              <span class="event-card__tag event-card__tag--orange">
                <img src={elderlyCategoryIcon} alt="" class="tag-icon-svg" />
                Пожилым
              </span>
              <span class="event-card__spots">20 мест</span>
            </div>
            <h3 class="event-card__title">Поддержка пожилых людей</h3>
            <div class="event-card__meta">
              <p>
                <img src={locationIcon} alt="" class="meta-icon-svg" />
                Дом ветеранов
              </p>
              <p>
                <img src={calendarCardIcon} alt="" class="meta-icon-svg" />
                15 августа 2026
              </p>
            </div>
            <Link to="*" class="event-card__button event-card__button--orange">
              Подробнее
            </Link>
          </article>

          <article class="event-card">
            <div class="event-card__top">
              <span class="event-card__tag event-card__tag--green">
                <img src={animalsCategoryIcon} alt="" class="tag-icon-svg" />
                Животным
              </span>
              <span class="event-card__spots">20 мест</span>
            </div>
            <h3 class="event-card__title">Помощь приюту для животных</h3>
            <div class="event-card__meta">
              <p>
                <img src={locationIcon} alt="" class="meta-icon-svg" />
                Приют “Добрые лапы”
              </p>
              <p>
                <img src={calendarCardIcon} alt="" class="meta-icon-svg" />
                20 октября 2026
              </p>
            </div>
            <Link to="*" class="event-card__button event-card__button--green">
              Подробнее
            </Link>
          </article>

          <article class="event-card event-card--mobile-only">
            <div class="event-card__top">
              <span class="event-card__tag event-card__tag--orange">
                <img src={childrenCategoryIcon} alt="" class="tag-icon-svg" />
                Детям
              </span>
              <span class="event-card__spots">18 мест</span>
            </div>
            <h3 class="event-card__title">Помощь детям-инвалидам</h3>
            <div class="event-card__meta">
              <p>
                <img src={locationIcon} alt="" class="meta-icon-svg" />
                Детский дом "Аист"
              </p>
              <p>
                <img src={calendarCardIcon} alt="" class="meta-icon-svg" />
                2 ноября 2026
              </p>
            </div>
            <Link to="*" class="event-card__button event-card__button--orange">
              Подробнее
            </Link>
          </article>
        </div>
      </div>
    </section>

    <section class="cta">
      <div class="container">
        <div class="cta__box"> 
          <div class="cta__content">
            <h2 class="cta__title">Станьте частью волонтерского сообщества</h2>
            <p class="cta__text">
              Присоединяйтесь к платформе, выбирайте мероприятия, отслеживайте свою
              активность и помогайте тем, кому это действительно нужно.
            </p>
          </div>

          <div class="cta__actions">
            <Link to="/register" class="cta__button cta__button--light">
              Зарегистрироваться
            </Link>
            <Link to="/events" class="cta__button cta__button--solid">
              Смотреть мероприятия
            </Link>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}