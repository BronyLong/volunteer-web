import "./ProfilePage.css";
import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import { getProfileById, updateMyProfile } from "../api";
import { formatDuration } from "../utils/eventUtils";
import ProfileEventCard from "../components/ProfileEventCard";

import locationIcon from "../assets/SVG/location_footer.svg";
import emailIcon from "../assets/SVG/email_footer.svg";
import phoneIcon from "../assets/SVG/phone_footer.svg";
import okIcon from "../assets/SVG/odnoklassniki.svg";
import vkIcon from "../assets/SVG/vkontakte.svg";
import maxIcon from "../assets/SVG/max.svg";
import arrowIcon from "../assets/SVG/arrow.svg";
import backgroundImage from "../assets/SVG/background.svg";
import manAvatar from "../assets/images/avatar_man.png";

function getTextValue(value, fallback = "Не указано") {
  return value && String(value).trim() ? value : fallback;
}

function getContactPlaceholder(profile) {
  if (!profile) return "Недоступно";

  if (profile.access_level === "public") {
    if (profile.role === "coordinator") {
      return "Контактные данные скрыты";
    }

    return "Контактные данные скрыты";
  }

  return "Не указано";
}

function normalizeLink(value) {
  if (!value || !String(value).trim()) return "";
  const trimmed = String(value).trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function getRoleLabel(role) {
  switch (role) {
    case "admin":
      return "Администратор";
    case "coordinator":
      return "Координатор";
    case "volunteer":
      return "Волонтер";
    default:
      return "Пользователь";
  }
}

function getEventsTitle(role, isOwner) {
  if (role === "coordinator") {
    return isOwner ? "Мои мероприятия" : "Мероприятия координатора";
  }

  return isOwner ? "Мои мероприятия" : "Мероприятия пользователя";
}

function formatEventDate(value) {
  if (!value) return "Дата не указана";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата не указана";

  return date.toLocaleDateString("ru-RU");
}

function getAccessMessage(profile) {
  if (!profile) return "";

  if (profile.access_level === "private") {
    return "Это ваш приватный профиль. Здесь доступны редактирование и все контактные данные.";
  }

  if (profile.access_level === "contact") {
    return "Контактные данные доступны.";
  }

  if (profile.access_level === "public") {
    if (profile.role === "coordinator") {
      return "Контактные данные скрыты. Доступ появится после участия в мероприятии этого координатора.";
    }

    return "Контактные данные скрыты.";
  }

  return "";
}

function getAccessClassName(profile) {
  if (!profile) return "profile-summary__access-note";

  return `profile-summary__access-note profile-summary__access-note--${profile.access_level}`;
}

function resizeImage(file, maxWidth = 600, maxHeight = 600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Не удалось обработать изображение"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error("Не удалось загрузить изображение"));
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { id } = useParams();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const data = await getProfileById(id);
        setProfile(data);
      } catch (err) {
        setError(err.message || "Не удалось загрузить профиль");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [id]);

  const fullName = useMemo(() => {
    if (!profile) return "";

    const firstName = profile.first_name?.trim() || "";
    const lastName = profile.last_name?.trim() || "";
    const combined = `${firstName} ${lastName}`.trim();

    return combined || "Пользователь";
  }, [profile]);

  const canViewContacts = Boolean(profile?.can_view_contacts || profile?.is_owner);

  const socials = useMemo(() => {
    if (!profile || !canViewContacts) return [];

    const items = [
      {
        key: "ok",
        href: normalizeLink(profile.social_ok),
        icon: okIcon,
        label: "Одноклассники",
      },
      {
        key: "vk",
        href: normalizeLink(profile.social_vk),
        icon: vkIcon,
        label: "VK",
      },
      {
        key: "max",
        href: normalizeLink(profile.social_max),
        icon: maxIcon,
        label: "MAX",
      },
    ];

    return items.filter((item) => item.href);
  }, [profile, canViewContacts]);

  const volunteerStats = useMemo(() => {
    const stats = profile?.volunteer_stats || {};

    return {
      completedEventsCount: Number(stats.completed_events_count || 0),
      completedMinutes: Number(stats.completed_minutes || 0),
      upcomingEventsCount: Number(stats.upcoming_events_count || 0),
    };
  }, [profile]);

  const profileEvents = useMemo(() => {
    if (!profile) return [];

    if (profile.role === "coordinator") {
      return Array.isArray(profile.coordinator_events)
        ? profile.coordinator_events
        : [];
    }

    return Array.isArray(profile.volunteer_events)
      ? profile.volunteer_events
      : [];
  }, [profile]);

  function handleAvatarClick() {
    if (!profile?.is_owner || avatarLoading) return;
    fileInputRef.current?.click();
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file || !profile?.is_owner) return;

    if (!file.type.startsWith("image/")) {
      setError("Выберите изображение");
      event.target.value = "";
      return;
    }

    try {
      setAvatarLoading(true);
      setError("");

      const dataUrl = await resizeImage(file, 600, 600, 0.8);

      await updateMyProfile({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        city: profile.city || "",
        avatar_url: dataUrl,
        bio: profile.bio || "",
        social_vk: profile.social_vk || "",
        social_ok: profile.social_ok || "",
        social_max: profile.social_max || "",
      });

      setProfile((prev) => ({
        ...prev,
        avatar_url: dataUrl,
      }));
    } catch (err) {
      setError(err.message || "Не удалось обновить аватар");
    } finally {
      setAvatarLoading(false);
      event.target.value = "";
    }
  }

  if (loading) {
    return (
      <main className="profile-page">
        <div className="container">
          <div className="profile-page__state">Загрузка профиля...</div>
        </div>
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="profile-page">
        <div className="container">
          <div className="profile-page__state profile-page__state--error">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="profile-page">
        <div className="container">
          <div className="profile-page__state">Профиль не найден</div>
        </div>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <section
        className="profile-cover"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      ></section>

      <section className="profile-summary">
        <div className="container">
          <div
            className={`profile-summary__avatar-wrap ${
              profile.is_owner ? "profile-summary__avatar-wrap--editable" : ""
            } ${avatarLoading ? "profile-summary__avatar-wrap--loading" : ""}`}
            onClick={handleAvatarClick}
            role={profile.is_owner ? "button" : undefined}
            tabIndex={profile.is_owner ? 0 : undefined}
            onKeyDown={(e) => {
              if (!profile.is_owner) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleAvatarClick();
              }
            }}
            aria-label={
              profile.is_owner ? "Изменить аватар пользователя" : undefined
            }
          >
            <img
              src={profile.avatar_url || manAvatar}
              alt="Аватар пользователя"
              className="profile-summary__avatar"
            />

            {profile.is_owner ? (
              <div className="profile-summary__avatar-overlay">
                <img
                  src={arrowIcon}
                  alt=""
                  className="profile-summary__avatar-arrow"
                />
                <span className="profile-summary__avatar-text">
                  {avatarLoading ? "Сохраняем..." : "Изменить аватар"}
                </span>
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="profile-summary__avatar-input"
              onChange={handleAvatarChange}
            />
          </div>

          <h1 className="profile-summary__name">{fullName}</h1>

          <div className="profile-summary__role">
            {getRoleLabel(profile.role)}
          </div>

          <div className={getAccessClassName(profile)}>
            {getAccessMessage(profile)}
          </div>

          {error ? (
            <div className="profile-page__inline-error">{error}</div>
          ) : null}
        </div>
      </section>

      <section className="profile-info">
        <div className="container">
          <div className="profile-card">
            <div className="profile-card__column profile-card__column--left">
              <h2 className="profile-card__title">Основная информация</h2>

              <div className="profile-card__divider"></div>

              <ul className="profile-contacts">
                <li className="profile-contacts__item">
                  <img src={phoneIcon} alt="" className="profile-contacts__icon" />
                  <span>
                    {canViewContacts
                      ? getTextValue(profile.phone)
                      : getContactPlaceholder(profile)}
                  </span>
                </li>

                <li className="profile-contacts__item">
                  <img src={emailIcon} alt="" className="profile-contacts__icon" />
                  <span>
                    {canViewContacts
                      ? getTextValue(profile.email)
                      : getContactPlaceholder(profile)}
                  </span>
                </li>

                <li className="profile-contacts__item">
                  <img
                    src={locationIcon}
                    alt=""
                    className="profile-contacts__icon"
                  />
                  <span>
                    {canViewContacts
                      ? getTextValue(profile.city)
                      : getContactPlaceholder(profile)}
                  </span>
                </li>
              </ul>

              {profile.is_owner ? (
                <>
                  <div className="profile-card__bottom-divider"></div>

                  <div className="profile-card__button-wrap">
                    <Link
                      to={`/profiles/${profile.id}/settings`}
                      className="profile-card__button"
                    >
                      Изменить
                    </Link>
                  </div>
                </>
              ) : null}
            </div>

            <div className="profile-card__column profile-card__column--right">
              <h2 className="profile-card__title profile-card__title--center">
                Bio
              </h2>

              <div className="profile-card__divider"></div>

              <div className="profile-bio">
                {getTextValue(profile.bio, "Пока не заполнено")}
              </div>

              {socials.length > 0 ? (
                <div className="profile-socials">
                  {socials.map((social) => (
                    <a
                      key={social.key}
                      href={social.href}
                      className="profile-socials__link"
                      aria-label={social.label}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={social.icon}
                        alt={social.label}
                        className="profile-socials__icon"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="profile-socials__empty">
                  {canViewContacts
                    ? "Социальные сети не указаны"
                    : "Социальные сети скрыты"}
                </div>
              )}

              {profile.is_owner ? (
                <>
                  <div className="profile-card__bottom-divider"></div>

                  <div className="profile-card__button-wrap">
                    <Link
                      to={`/profiles/${profile.id}/settings`}
                      className="profile-card__button"
                    >
                      Изменить
                    </Link>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {profile.role === "admin" ? (
            profile.is_owner ? (
              <section className="profile-events">
                <div className="profile-events__header">
                  <h2 className="profile-events__title">Администрирование</h2>

                  <Link to="/admin" className="profile-events__create-button">
                    Перейти
                  </Link>
                </div>
              </section>
            ) : null
          ) : (
            <section className="profile-events">
              <div className="profile-events__header">
                <h2 className="profile-events__title">
                  {getEventsTitle(profile.role, profile.is_owner)}
                </h2>

                {profile.is_owner && profile.role === "coordinator" ? (
                  <Link to="/create" className="profile-events__create-button">
                    Добавить мероприятие
                  </Link>
                ) : null}
              </div>

              <div className="profile-events__divider"></div>

              {profile.role === "volunteer" ? (
                <>
                  <div className="profile-events__stats">
                    <div className="profile-events__stat-card">
                      <span className="profile-events__stat-value">
                        {volunteerStats.completedEventsCount}
                      </span>
                      <span className="profile-events__stat-label">
                        Завершено мероприятий
                      </span>
                    </div>

                    <div className="profile-events__stat-card">
                      <span className="profile-events__stat-value">
                        {formatDuration(volunteerStats.completedMinutes)}
                      </span>
                      <span className="profile-events__stat-label">
                        Время участия
                      </span>
                    </div>

                    <div className="profile-events__stat-card">
                      <span className="profile-events__stat-value">
                        {volunteerStats.upcomingEventsCount}
                      </span>
                      <span className="profile-events__stat-label">
                        Предстоит мероприятий
                      </span>
                    </div>
                  </div>

                  <div className="profile-events__divider"></div>
                </>
              ) : null}

              {profileEvents.length > 0 ? (
                <div className="profile-events__list">
                  {profileEvents.map((event) => (
                    <ProfileEventCard
                      key={event.id}
                      title={event.title}
                      location={event.location || "Не указано"}
                      date={formatEventDate(event.start_at)}
                      link={`/events/${event.id}`}
                      buttonText="К мероприятию"
                    />
                  ))}
                </div>
              ) : (
                <div className="profile-events__empty">
                  Здесь пока нет мероприятий
                </div>
              )}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}