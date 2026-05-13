import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./NotificationSettingsPage.css";

import {
  getMyProfile,
  getNotificationSettings,
  updateNotificationSettings,
} from "../api";

import backgroundImage from "../assets/SVG/background.svg";
import { getProfileAvatar } from "../utils/avatarUtils";

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

export default function NotificationSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const profileData = await getMyProfile();

        if (String(profileData.id) !== String(id)) {
          navigate(`/profiles/${profileData.id}/notifications/settings`, { replace: true });
          return;
        }

        if (profileData.role !== "volunteer" && profileData.role !== "coordinator") {
          navigate(`/profiles/${profileData.id}`, { replace: true });
          return;
        }

        const settingsData = await getNotificationSettings();

        setProfile(profileData);
        setSettings(settingsData.settings);
        setCategories(Array.isArray(settingsData.categories) ? settingsData.categories : []);
      } catch (err) {
        setError(err.message || "Не удалось загрузить настройки уведомлений");
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

  function updateSetting(name, value) {
    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
    setSuccess("");
    setError("");
  }

  function updateCategory(categoryId, enabled) {
    setCategories((prev) =>
      prev.map((category) =>
        String(category.id) === String(categoryId)
          ? { ...category, enabled }
          : category
      )
    );
    setSuccess("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!settings || saving) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const result = await updateNotificationSettings({
        receive_notifications: settings.receive_notifications,
        notify_new_events: settings.notify_new_events,
        notify_coordinator_messages: settings.notify_coordinator_messages,
        notify_application_status: settings.notify_application_status,
        notify_event_assignment: settings.notify_event_assignment,
        notify_new_applications: settings.notify_new_applications,
        categories,
      });

      setSettings(result.settings);
      setCategories(Array.isArray(result.categories) ? result.categories : []);
      setSuccess("Настройки уведомлений сохранены");
    } catch (err) {
      setError(err.message || "Не удалось сохранить настройки уведомлений");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="notification-settings-page">
        <div className="container">
          <div className="notification-settings-page__state">Загрузка настроек...</div>
        </div>
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="notification-settings-page">
        <div className="container">
          <div className="notification-settings-page__state notification-settings-page__state--error">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!profile || !settings) return null;

  return (
    <main className="notification-settings-page">
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

      <section className="notification-settings-section">
        <div className="container">
          <form className="notification-settings-card" onSubmit={handleSubmit}>
            <div className="notification-settings-card__header">
              <div>
                <h2 className="notification-settings-card__title">Настроить уведомления</h2>
                <p className="notification-settings-card__description">
                  Уведомления создаются на сайте и отправляются на email, указанный в профиле.
                </p>
              </div>

              <Link
                to={`/profiles/${profile.id}/notifications`}
                className="notification-settings-card__back"
              >
                К уведомлениям
              </Link>
            </div>

            <div className="notification-settings-card__divider"></div>

            {success ? <div className="notification-settings-card__success">{success}</div> : null}
            {error ? <div className="notification-settings-card__error">{error}</div> : null}

            <div className="notification-settings-list">
              <label className="notification-checkbox notification-checkbox--main">
                <input
                  type="checkbox"
                  checked={Boolean(settings.receive_notifications)}
                  onChange={(event) => updateSetting("receive_notifications", event.target.checked)}
                />
                <span>Получать уведомления</span>
              </label>

              {profile.role === "volunteer" ? (
                <>
                  <label className="notification-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.notify_new_events)}
                      onChange={(event) => updateSetting("notify_new_events", event.target.checked)}
                    />
                    <span>Получать уведомления о новых мероприятиях</span>
                  </label>

                  <div className="notification-settings-group">
                    <h3 className="notification-settings-group__title">
                      Получать уведомления от категорий мероприятий
                    </h3>

                    <div className="notification-settings-group__list">
                      {categories.map((category) => (
                        <label key={category.id} className="notification-checkbox">
                          <input
                            type="checkbox"
                            checked={Boolean(category.enabled)}
                            onChange={(event) => updateCategory(category.id, event.target.checked)}
                          />
                          <span>{category.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="notification-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.notify_coordinator_messages)}
                      onChange={(event) => updateSetting("notify_coordinator_messages", event.target.checked)}
                    />
                    <span>Уведомления от координатора</span>
                  </label>

                  <label className="notification-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.notify_application_status)}
                      onChange={(event) => updateSetting("notify_application_status", event.target.checked)}
                    />
                    <span>Получать уведомления об изменении статуса заявки</span>
                  </label>
                </>
              ) : null}

              {profile.role === "coordinator" ? (
                <>
                  <label className="notification-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.notify_event_assignment)}
                      onChange={(event) => updateSetting("notify_event_assignment", event.target.checked)}
                    />
                    <span>Получать уведомления о назначении координатором мероприятия</span>
                  </label>

                  <label className="notification-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.notify_new_applications)}
                      onChange={(event) => updateSetting("notify_new_applications", event.target.checked)}
                    />
                    <span>Получать уведомления о новых заявках</span>
                  </label>
                </>
              ) : null}
            </div>

            <button
              type="submit"
              className="notification-settings-card__button"
              disabled={saving}
            >
              {saving ? "Сохраняем..." : "Сохранить"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
