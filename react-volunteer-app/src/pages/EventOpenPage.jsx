import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./EventOpenPage.css";

import ApplicationCard from "../components/ApplicationCard";

import eventSettings from "../assets/SVG/cog.svg";
import eventCheckmark from "../assets/SVG/checkmark.svg";
import leafCategoryIcon from "../assets/SVG/leaf_category.svg";
import childrenCategoryIcon from "../assets/SVG/childern_category.svg";
import animalsCategoryIcon from "../assets/SVG/animals_category.svg";
import elderlyCategoryIcon from "../assets/SVG/elderly_category.svg";
import locationIcon from "../assets/SVG/location.svg";
import availableSpacesIcon from "../assets/SVG/avalable_spaces.svg";
import emailIcon from "../assets/SVG/email_footer.svg";
import phoneIcon from "../assets/SVG/phone_footer.svg";
import dateIcon from "../assets/SVG/calendar_card.svg";
import timeIcon from "../assets/SVG/clock.svg";

import eventImage from "../assets/images/animals_help.png";
import womanAvatar from "../assets/images/avatar_man.png";
import {
  apiFetch,
  deleteApplication,
  getToken,
  rejectApplication,
  restoreApplication,
} from "../api";

function getUserFromToken() {
  const token = getToken();
  if (!token) return null;

  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "Не указано";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Не указано";

  return date.toLocaleDateString("ru-RU");
}

function formatTime(value) {
  if (!value) return "Не указано";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Не указано";

  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCategoryIcon(categoryName) {
  const normalized = String(categoryName || "").toLowerCase();

  if (normalized.includes("эколог")) return leafCategoryIcon;
  if (normalized.includes("дет")) return childrenCategoryIcon;
  if (normalized.includes("живот")) return animalsCategoryIcon;
  if (normalized.includes("пожил")) return elderlyCategoryIcon;

  return leafCategoryIcon;
}

function getCoordinatorName(eventData) {
  const firstName = eventData?.first_name?.trim() || "";
  const lastName = eventData?.last_name?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || "Координатор не указан";
}

function getDisplayValue(value) {
  return value && String(value).trim() ? value : "Не указан";
}

function isEventPast(startAt) {
  if (!startAt) return false;

  const eventDate = new Date(startAt);
  if (Number.isNaN(eventDate.getTime())) return false;

  return eventDate.getTime() < Date.now();
}

export default function EventOpenPage() {
  const params = useParams();
  const eventId = params.id || "1";

  const [eventData, setEventData] = useState(null);
  const [applications, setApplications] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setCurrentUser(getUserFromToken());
  }, []);

  useEffect(() => {
    async function loadEvent() {
      try {
        setLoading(true);
        setError("");

        const eventResponse = await apiFetch(`/events/${eventId}`);
        setEventData(eventResponse);
      } catch (err) {
        setError(err.message || "Не удалось загрузить мероприятие");
      } finally {
        setLoading(false);
      }
    }

    loadEvent();
  }, [eventId]);

  useEffect(() => {
    async function loadApplications() {
      const user = getUserFromToken();
      if (!user) return;

      const role = user.role;

      try {
        setApplicationsLoading(true);

        if (role === "volunteer") {
          const myApps = await apiFetch("/applications/my");
          const filtered = myApps.filter(
            (application) => String(application.event_id) === String(eventId)
          );
          setMyApplications(filtered);
        }

        if (role === "coordinator" || role === "admin") {
          const eventApps = await apiFetch(`/applications/event/${eventId}`);
          setApplications(eventApps);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setApplicationsLoading(false);
      }
    }

    loadApplications();
  }, [eventId, currentUser]);

  const role = currentUser?.role || "guest";
  const isGuest = !currentUser;
  const isVolunteer = role === "volunteer";
  const isAdmin = role === "admin";
  const isOwnerCoordinator =
    role === "coordinator" &&
    currentUser &&
    eventData &&
    currentUser.id === eventData.creator_id;

  const eventIsPast = useMemo(() => isEventPast(eventData?.start_at), [eventData]);

  const canEditEvent = Boolean(eventData && (isAdmin || isOwnerCoordinator));
  const canViewApplications = Boolean(eventData && (isAdmin || isOwnerCoordinator));
  const canChangeApplications = Boolean(!eventIsPast && canViewApplications);
  const canVolunteerInteract = Boolean(isVolunteer && !eventIsPast);

  const categoryIcon = useMemo(() => {
    return getCategoryIcon(eventData?.category_name);
  }, [eventData]);

  async function refreshVolunteerApplicationData() {
    const refreshedEvent = await apiFetch(`/events/${eventId}`);
    const myApps = await apiFetch("/applications/my");
    const filtered = myApps.filter(
      (application) => String(application.event_id) === String(eventId)
    );

    setEventData(refreshedEvent);
    setMyApplications(filtered);
  }

  async function refreshManagerApplicationData() {
    const refreshedEvent = await apiFetch(`/events/${eventId}`);
    const eventApps = await apiFetch(`/applications/event/${eventId}`);

    setEventData(refreshedEvent);
    setApplications(eventApps);
  }

  async function handleApply() {
    if (!currentUser || !isVolunteer || eventIsPast) return;

    try {
      setActionLoading(true);
      setError("");

      await apiFetch("/applications", {
        method: "POST",
        body: JSON.stringify({
          event_id: eventId,
        }),
      });

      await refreshVolunteerApplicationData();
    } catch (err) {
      setError(err.message || "Не удалось подать заявку");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleWithdrawApplication(applicationId) {
    if (eventIsPast) return;

    try {
      setActionLoading(true);
      setError("");

      await deleteApplication(applicationId);
      await refreshVolunteerApplicationData();
    } catch (err) {
      setError(err.message || "Не удалось отозвать заявку");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectApplication(applicationId) {
    if (eventIsPast) return;

    try {
      setRejectingId(applicationId);
      setError("");

      await rejectApplication(applicationId);
      await refreshManagerApplicationData();
    } catch (err) {
      setError(err.message || "Не удалось отклонить заявку");
    } finally {
      setRejectingId(null);
    }
  }

  async function handleRestoreApplication(applicationId) {
    if (eventIsPast) return;

    try {
      setRestoringId(applicationId);
      setError("");

      await restoreApplication(applicationId);
      await refreshManagerApplicationData();
    } catch (err) {
      setError(err.message || "Не удалось восстановить заявку");
    } finally {
      setRestoringId(null);
    }
  }

  if (loading) {
    return (
      <main className="event-page">
        <section className="event-layout">
          <div className="container">
            <div className="applications-card">
              <div className="applications-empty">Загрузка мероприятия...</div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (error && !eventData) {
    return (
      <main className="event-page">
        <section className="event-layout">
          <div className="container">
            <div className="applications-card">
              <div className="applications-empty">{error}</div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!eventData) {
    return (
      <main className="event-page">
        <section className="event-layout">
          <div className="container">
            <div className="applications-card">
              <div className="applications-empty">Мероприятие не найдено</div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="event-page">
      <section className="event-layout">
        <div className="container">
          <div className="event-shell">
            <article className="event-card">
              <div className="event-card__header">
                <div className="event-card__header-content">
                  <h1 className="event-card__title">{eventData.title}</h1>
                  <p className="event-card__description">
                    {eventData.description || "Описание отсутствует"}
                  </p>
                </div>

                {canEditEvent ? (
                  <Link
                    to={`/events/${eventId}/edit`}
                    className="event-card__settings"
                    aria-label="Редактировать мероприятие"
                  >
                    <img
                      src={eventSettings}
                      alt=""
                      className="event-card__settings-icon"
                    />
                  </Link>
                ) : null}
              </div>

              <div className="event-card__top-grid">
                <div className="event-card__image-box">
                  <img
                    src={eventData.image_url || eventImage}
                    alt={eventData.title}
                    className="event-card__image"
                  />
                </div>

                <div className="event-card__tasks-box">
                  <h2 className="event-card__section-title">
                    Что предстоит сделать
                  </h2>

                  {Array.isArray(eventData.tasks) && eventData.tasks.length > 0 ? (
                    <ul className="event-card__tasks-list">
                      {eventData.tasks.map((task, index) => (
                        <li className="event-card__task-item" key={`${task}-${index}`}>
                          <img
                            src={eventCheckmark}
                            alt=""
                            className="event-card__task-icon"
                          />
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="event-card__tasks-list">
                      <li className="event-card__task-item">
                        <img
                          src={eventCheckmark}
                          alt=""
                          className="event-card__task-icon"
                        />
                        <span>Список задач пока не заполнен</span>
                      </li>
                    </ul>
                  )}
                </div>
              </div>

              <div className="event-card__divider"></div>

              <div className="event-card__meta-grid">
                <div className="event-card__meta-left">
                  <div className="event-card__category-pill">
                    <img
                      src={categoryIcon}
                      alt=""
                      className="event-card__category-icon"
                    />
                    <span>{eventData.category_name || "Категория не указана"}</span>
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
                    <strong>
                      {eventData.available_slots} из {eventData.participant_limit}
                    </strong>
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
                  <p>{eventData.location || "Место не указано"}</p>
                </div>
              </div>

              <div className="event-card__divider"></div>

              <div className="event-card__date-time-grid">
                <div className="event-card__info-box">
                  <span className="event-card__meta-label">
                    ДАТА ПРОВЕДЕНИЯ
                    <img
                      src={dateIcon}
                      alt=""
                      className="event-card__meta-inline-icon"
                    />
                  </span>
                  <strong>{formatDate(eventData.start_at)}</strong>
                </div>

                <div className="event-card__info-box">
                  <span className="event-card__meta-label">
                    ВРЕМЯ ПРОВЕДЕНИЯ
                    <img
                      src={timeIcon}
                      alt=""
                      className="event-card__meta-inline-icon"
                    />
                  </span>
                  <strong>{formatTime(eventData.start_at)}</strong>
                </div>
              </div>

              <div className="event-card__divider"></div>

              <div className="event-card__bottom">
                <div className="coordinator-card">
                  <div className="coordinator-card__label">КООРДИНАТОР</div>

                  <div className="coordinator-card__body">
                    <div className="coordinator-card__avatar-wrap">
                      <img
                        src={eventData.avatar_url || womanAvatar}
                        alt="Координатор"
                        className="coordinator-card__avatar"
                      />
                    </div>

                    <div className="coordinator-card__info">
                      <h3 className="coordinator-card__name">
                        {getCoordinatorName(eventData)}
                      </h3>

                      <p className="coordinator-card__line">
                        <img
                          src={emailIcon}
                          alt=""
                          className="coordinator-card__icon"
                        />
                        <span>{getDisplayValue(eventData.email)}</span>
                      </p>

                      <p className="coordinator-card__line">
                        <img
                          src={phoneIcon}
                          alt=""
                          className="coordinator-card__icon"
                        />
                        <span>{getDisplayValue(eventData.phone)}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {eventIsPast ? (
                  <div className="event-card__application-status">
                    Мероприятие завершено
                  </div>
                ) : null}

                {isGuest && !eventIsPast ? (
                  <Link to="/login" className="event-card__join-button">
                    Войти для участия
                  </Link>
                ) : null}

                {canVolunteerInteract &&
                  (myApplications.length > 0 ? (
                    <div className="event-card__application-actions">
                      <div className="event-card__application-status">
                        Вы подали заявку
                      </div>

                      <button
                        type="button"
                        className="event-card__withdraw-button"
                        onClick={() => handleWithdrawApplication(myApplications[0].id)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? "Отзываем..." : "Отозвать"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="event-card__join-button"
                      onClick={handleApply}
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Отправляем..." : "Принять участие"}
                    </button>
                  ))}
              </div>

              {error && eventData ? (
                <>
                  <div className="event-card__divider"></div>
                  <div className="applications-empty">{error}</div>
                </>
              ) : null}
            </article>
          </div>

          {canViewApplications ? (
            <section className="applications-section">
              <div className="applications-card">
                <h2 className="applications-card__title">Поданные заявки</h2>

                {eventIsPast ? (
                  <div className="applications-empty">
                    Мероприятие завершено. Просмотр заявок доступен, изменение статусов отключено.
                  </div>
                ) : null}

                {applicationsLoading ? (
                  <div className="applications-empty">Загрузка заявок...</div>
                ) : applications.length > 0 ? (
                  <div className="applications-list">
                    {applications.map((application) => (
                      <ApplicationCard
                        key={application.id}
                        id={application.id}
                        avatar={application.avatar_url || womanAvatar}
                        name={application.first_name || "Имя не указано"}
                        secondName={application.last_name || ""}
                        email={application.email || "Не указан"}
                        phone={application.phone || "Не указан"}
                        status={application.status}
                        onReject={handleRejectApplication}
                        onRestore={handleRestoreApplication}
                        isRejecting={rejectingId === application.id}
                        isRestoring={restoringId === application.id}
                        canReject={canChangeApplications}
                        canRestore={canChangeApplications}
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
          ) : null}
        </div>
      </section>
    </main>
  );
}