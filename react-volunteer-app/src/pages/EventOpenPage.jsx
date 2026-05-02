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
  acceptApplication,
  apiFetch,
  deleteApplication,
  getToken,
  rejectApplication,
} from "../api";

import {
  formatDate,
  formatDuration,
  formatTime,
  getCoordinatorName,
  getDisplayValue,
  isEventPast,
} from "../utils/eventUtils";

function getUserFromToken() {
  const token = getToken();
  if (!token) return null;

  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function getCategoryIcon(categoryName) {
  const normalized = String(categoryName || "").toLowerCase();

  if (normalized.includes("эколог")) return leafCategoryIcon;
  if (normalized.includes("дет")) return childrenCategoryIcon;
  if (normalized.includes("живот")) return animalsCategoryIcon;
  if (normalized.includes("пожил")) return elderlyCategoryIcon;

  return leafCategoryIcon;
}

function getCategoryTheme(categoryName) {
  const normalized = String(categoryName || "").toLowerCase();

  if (normalized.includes("дет")) return "orange";
  if (normalized.includes("пожил")) return "orange";
  if (normalized.includes("эколог")) return "green";
  if (normalized.includes("живот")) return "green";

  return "green";
}

function getApplicationTime(application) {
  return new Date(
    application.created_at ||
      application.updated_at ||
      application.submitted_at ||
      application.application_date ||
      0
  ).getTime();
}

export default function EventOpenPage() {
  const params = useParams();
  const eventId = params.id || "1";

  const [eventData, setEventData] = useState(null);
  const [applications, setApplications] = useState([]);
  const [showRejectedApplications, setShowRejectedApplications] = useState(false);
  const [myApplications, setMyApplications] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
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

      const currentRole = user.role;

      try {
        setApplicationsLoading(true);

        if (currentRole === "volunteer") {
          const myApps = await apiFetch("/applications/my");
          const filtered = myApps.filter(
            (application) => String(application.event_id) === String(eventId)
          );
          setMyApplications(filtered);
        }

        if (currentRole === "coordinator" || currentRole === "admin") {
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
    String(currentUser.id) === String(eventData.creator_id);

  const eventIsPast = useMemo(() => isEventPast(eventData?.start_at), [eventData]);

  const canEditEvent = Boolean(eventData && (isAdmin || isOwnerCoordinator));
  const canViewApplications = Boolean(eventData && (isAdmin || isOwnerCoordinator));
  const canChangeApplications = Boolean(!eventIsPast && canViewApplications);
  const canVolunteerInteract = Boolean(isVolunteer && !eventIsPast);

  const categoryIcon = useMemo(() => {
    return getCategoryIcon(eventData?.category_name);
  }, [eventData]);

  const categoryTheme = useMemo(() => {
    return getCategoryTheme(eventData?.category_name);
  }, [eventData]);

  const hasCoordinatorContactAccess = useMemo(() => {
    if (!eventData) return false;
    return Boolean(eventData.email);
  }, [eventData]);

  const coordinatorContactsHidden = useMemo(() => {
    if (!eventData) return false;
    return !hasCoordinatorContactAccess;
  }, [eventData, hasCoordinatorContactAccess]);

  const coordinatorContactHint = useMemo(() => {
    if (!coordinatorContactsHidden) return "";

    if (isGuest) {
      return "Войдите в аккаунт и подайте заявку на это мероприятие, чтобы увидеть контакты координатора";
    }

    if (isVolunteer) {
      return "Контактные данные откроются после подачи заявки на это мероприятие";
    }

    return "Контактные данные скрыты";
  }, [coordinatorContactsHidden, isGuest, isVolunteer]);

  const coordinatorProfileLink = useMemo(() => {
    if (!eventData?.creator_id) return null;
    return `/profiles/${eventData.creator_id}`;
  }, [eventData]);

  const currentApplication = useMemo(() => {
    if (myApplications.length === 0) return null;

    const sortedApplications = [...myApplications].sort((a, b) => {
      const timeDiff = getApplicationTime(b) - getApplicationTime(a);

      if (timeDiff !== 0) return timeDiff;

      return Number(b.id || 0) - Number(a.id || 0);
    });

    const activeApplication = sortedApplications.find(
      (application) =>
        application.status === "pending" || application.status === "approved"
    );

    return activeApplication || sortedApplications[0];
  }, [myApplications]);

  const visibleApplications = useMemo(() => {
    if (showRejectedApplications) return applications;

    return applications.filter((application) => application.status !== "rejected");
  }, [applications, showRejectedApplications]);

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

  async function handleAcceptApplication(applicationId) {
    if (eventIsPast) return;

    try {
      setAcceptingId(applicationId);
      setError("");

      await acceptApplication(applicationId);
      await refreshManagerApplicationData();
    } catch (err) {
      setError(err.message || "Не удалось принять заявку");
    } finally {
      setAcceptingId(null);
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

  function getMyApplicationStatusText(status) {
    switch (status) {
      case "pending":
        return "Заявка отправлена и ожидает решения координатора";
      case "approved":
        return "Вы участвуете в мероприятии";
      case "rejected":
        return "Заявка отклонена";
      default:
        return "Вы подали заявку";
    }
  }

  function getMyApplicationStatusClass(status) {
    return status === "rejected"
      ? "event-card__application-status event-card__application-status--rejected"
      : "event-card__application-status";
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
                  <div
                    className={`event-card__category-pill event-card__category-pill--${categoryTheme}`}
                  >
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

                <div className="event-card__info-box">
                  <span className="event-card__meta-label">
                    ДЛИТЕЛЬНОСТЬ
                    <img
                      src={timeIcon}
                      alt=""
                      className="event-card__meta-inline-icon"
                    />
                  </span>
                  <strong>{formatDuration(eventData.duration_minutes)}</strong>
                </div>
              </div>

              <div className="event-card__divider"></div>

              <div className="event-card__bottom">
                <div className="coordinator-card">
                  <div className="coordinator-card__label">КООРДИНАТОР</div>

                  <div className="coordinator-card__body">
                    {coordinatorProfileLink ? (
                      <Link
                        to={coordinatorProfileLink}
                        className="coordinator-card__avatar-link"
                        aria-label={`Перейти в профиль координатора ${getCoordinatorName(
                          eventData
                        )}`}
                        title="Открыть профиль координатора"
                      >
                        <div className="coordinator-card__avatar-wrap">
                          <img
                            src={eventData.avatar_url || womanAvatar}
                            alt="Координатор"
                            className="coordinator-card__avatar"
                          />
                        </div>
                      </Link>
                    ) : (
                      <div className="coordinator-card__avatar-wrap">
                        <img
                          src={eventData.avatar_url || womanAvatar}
                          alt="Координатор"
                          className="coordinator-card__avatar"
                        />
                      </div>
                    )}

                    <div className="coordinator-card__info">
                      <h3 className="coordinator-card__name">
                        {getCoordinatorName(eventData)}
                      </h3>

                      <p
                        className={`coordinator-card__line ${
                          coordinatorContactsHidden
                            ? "coordinator-card__line--muted"
                            : ""
                        }`}
                      >
                        <img
                          src={emailIcon}
                          alt=""
                          className="coordinator-card__icon"
                        />
                        <span>
                          {coordinatorContactsHidden
                            ? "Контактные данные скрыты"
                            : getDisplayValue(eventData.email)}
                        </span>
                      </p>

                      <p
                        className={`coordinator-card__line ${
                          coordinatorContactsHidden
                            ? "coordinator-card__line--muted"
                            : ""
                        }`}
                      >
                        <img
                          src={phoneIcon}
                          alt=""
                          className="coordinator-card__icon"
                        />
                        <span>
                          {coordinatorContactsHidden
                            ? "Контактные данные скрыты"
                            : getDisplayValue(eventData.phone)}
                        </span>
                      </p>

                      {coordinatorContactsHidden && coordinatorContactHint ? (
                        <div className="coordinator-card__hint">
                          {coordinatorContactHint}
                        </div>
                      ) : null}
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
                  (currentApplication ? (
                    <div className="event-card__application-actions">
                      <div className={getMyApplicationStatusClass(currentApplication.status)}>
                        {getMyApplicationStatusText(currentApplication.status)}
                      </div>

                      {currentApplication.status === "pending" ? (
                        <button
                          type="button"
                          className="event-card__withdraw-button"
                          onClick={() => handleWithdrawApplication(currentApplication.id)}
                          disabled={actionLoading}
                        >
                          {actionLoading ? "Отзываем..." : "Отозвать"}
                        </button>
                      ) : null}

                      {currentApplication.status === "rejected" ? (
                        <button
                          type="button"
                          className="event-card__join-button"
                          onClick={handleApply}
                          disabled={actionLoading}
                        >
                          {actionLoading ? "Отправляем..." : "Подать заявку повторно"}
                        </button>
                      ) : null}
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
                <div className="applications-card__header">
                  <h2 className="applications-card__title">Поданные заявки</h2>

                  <label className="applications-card__toggle">
                    <input
                      type="checkbox"
                      checked={showRejectedApplications}
                      onChange={(event) => setShowRejectedApplications(event.target.checked)}
                    />
                    <span>Показывать отклоненные заявки</span>
                  </label>
                </div>

                {eventIsPast ? (
                  <div className="applications-empty">
                    Мероприятие завершено. Просмотр заявок доступен, изменение
                    статусов отключено.
                  </div>
                ) : null}

                {applicationsLoading ? (
                  <div className="applications-empty">Загрузка заявок...</div>
                ) : visibleApplications.length > 0 ? (
                  <div className="applications-list">
                    {visibleApplications.map((application) => (
                      <ApplicationCard
                        key={application.id}
                        id={application.id}
                        userId={application.user_id}
                        avatar={application.avatar_url || womanAvatar}
                        name={application.first_name || "Имя не указано"}
                        secondName={application.last_name || ""}
                        email={application.email || "Не указан"}
                        phone={application.phone || "Не указан"}
                        status={application.status}
                        onAccept={handleAcceptApplication}
                        onReject={handleRejectApplication}
                        isAccepting={acceptingId === application.id}
                        isRejecting={rejectingId === application.id}
                        canAccept={canChangeApplications}
                        canReject={canChangeApplications}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="applications-empty">
                    Пока нет заявок для отображения
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