import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./NotificationsPage.css";

import {
  getMyProfile,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../api";

import backgroundImage from "../assets/SVG/background.svg";
import { getProfileAvatar } from "../utils/avatarUtils";

function formatDateTime(value) {
  if (!value) return "Дата не указана";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата не указана";

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRoleLabel(role) {
  switch (role) {
    case "coordinator":
      return "Координатор";
    case "volunteer":
      return "Волонтер";
    default:
      return "Пользователь";
  }
}

function getNotificationLink(notification) {
  if (notification?.event_id) return `/events/${notification.event_id}`;
  return null;
}

export default function NotificationsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const profileData = await getMyProfile();

        if (String(profileData.id) !== String(id)) {
          navigate(`/profiles/${profileData.id}/notifications`, { replace: true });
          return;
        }

        if (profileData.role !== "volunteer" && profileData.role !== "coordinator") {
          navigate(`/profiles/${profileData.id}`, { replace: true });
          return;
        }

        const notificationsData = await getNotifications();

        setProfile(profileData);
        setNotifications(Array.isArray(notificationsData) ? notificationsData : []);
      } catch (err) {
        setError(err.message || "Не удалось загрузить уведомления");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, navigate]);

  const fullName = useMemo(() => {
    if (!profile) return "";

    return [profile.first_name, profile.middle_name, profile.last_name]
      .filter(Boolean)
      .join(" ") || "Пользователь";
  }, [profile]);

  async function handleRead(notification) {
    if (notification.is_read || saving) return;

    try {
      setSaving(true);
      const updated = await markNotificationAsRead(notification.id);

      setNotifications((prev) =>
        prev.map((item) =>
          String(item.id) === String(notification.id)
            ? { ...item, is_read: updated.is_read, read_at: updated.read_at }
            : item
        )
      );
    } catch (err) {
      setError(err.message || "Не удалось отметить уведомление прочитанным");
    } finally {
      setSaving(false);
    }
  }

  async function handleReadAll() {
    if (saving) return;

    try {
      setSaving(true);
      setError("");
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
        }))
      );
    } catch (err) {
      setError(err.message || "Не удалось отметить уведомления прочитанными");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="notifications-page">
        <div className="container">
          <div className="notifications-page__state">Загрузка уведомлений...</div>
        </div>
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="notifications-page">
        <div className="container">
          <div className="notifications-page__state notifications-page__state--error">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  return (
    <main className="notifications-page">
      <section
        className="profile-cover"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      ></section>

      <section className="profile-summary">
        <div className="container">
          <div className="profile-summary__avatar-wrap">
            <img
              src={getProfileAvatar(profile)}
              alt="Аватар пользователя"
              className="profile-summary__avatar"
            />
          </div>

          <h1 className="profile-summary__name">{fullName}</h1>
          <div className="profile-summary__role">{getRoleLabel(profile.role)}</div>
        </div>
      </section>

      <section className="notifications-section">
        <div className="container">
          <div className="notifications-card">
            <div className="notifications-card__header">
              <div>
                <h2 className="notifications-card__title">Уведомления</h2>
                <p className="notifications-card__description">
                  Здесь отображаются уведомления на сайте. Эти же уведомления отправляются на email из профиля, если включены настройки получения.
                </p>
              </div>

              <div className="notifications-card__actions">
                <Link
                  to={`/profiles/${profile.id}/notifications/settings`}
                  className="notifications-card__button"
                >
                  Настроить уведомления
                </Link>

                <button
                  type="button"
                  className="notifications-card__button notifications-card__button--secondary"
                  onClick={handleReadAll}
                  disabled={saving || notifications.length === 0}
                >
                  Прочитать все
                </button>
              </div>
            </div>

            <div className="notifications-card__divider"></div>

            {error ? (
              <div className="notifications-page__inline-error">{error}</div>
            ) : null}

            {notifications.length > 0 ? (
              <div className="notifications-list">
                {notifications.map((notification) => {
                  const link = getNotificationLink(notification);

                  return (
                    <article
                      key={notification.id}
                      className={`notification-item ${notification.is_read ? "notification-item--read" : ""}`}
                    >
                      <div className="notification-item__content">
                        <div className="notification-item__top">
                          <h3 className="notification-item__title">{notification.title}</h3>
                          {!notification.is_read ? (
                            <span className="notification-item__badge">Новое</span>
                          ) : null}
                        </div>

                        <p className="notification-item__body">{notification.body}</p>
                        <time className="notification-item__date">
                          {formatDateTime(notification.created_at)}
                        </time>
                      </div>

                      <div className="notification-item__actions">
                        {link ? (
                          <Link
                            to={link}
                            className="notification-item__button"
                            onClick={() => handleRead(notification)}
                          >
                            Открыть
                          </Link>
                        ) : null}

                        {!notification.is_read ? (
                          <button
                            type="button"
                            className="notification-item__button notification-item__button--secondary"
                            onClick={() => handleRead(notification)}
                            disabled={saving}
                          >
                            Прочитано
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="notifications-empty">Уведомлений пока нет</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
