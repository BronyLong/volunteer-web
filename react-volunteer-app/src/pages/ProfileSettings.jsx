import "./ProfileSettings.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getMyProfile, getUserIdFromToken, updateMyProfile } from "../api";

import manAvatar from "../assets/images/avatar_man.png";
import backgroundImage from "../assets/SVG/background.svg";

const INITIAL_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  city: "",
  bio: "",
  social_vk: "",
  social_ok: "",
  social_max: "",
};

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

function mapProfileToForm(profile) {
  return {
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    city: profile?.city || "",
    bio: profile?.bio || "",
    social_vk: profile?.social_vk || "",
    social_ok: profile?.social_ok || "",
    social_max: profile?.social_max || "",
  };
}

export default function ProfileSettings() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const currentUserId = String(getUserIdFromToken() || "");
  const requestedUserId = String(id || "");
  const isOwner = currentUserId && requestedUserId && currentUserId === requestedUserId;

  useEffect(() => {
    if (!currentUserId) {
      navigate("/login", { replace: true });
      return;
    }

    if (!isOwner) {
      navigate(`/profiles/${id}`, { replace: true });
      return;
    }

    async function loadProfile() {
      try {
        setLoading(true);
        setError("");
        setSuccessMessage("");

        const data = await getMyProfile();
        setProfile(data);
        setFormData(mapProfileToForm(data));
      } catch (err) {
        setError(err.message || "Не удалось загрузить настройки профиля");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [currentUserId, id, isOwner, navigate]);

  const fullName = useMemo(() => {
    const firstName = formData.first_name.trim();
    const lastName = formData.last_name.trim();
    const combined = `${firstName} ${lastName}`.trim();

    return combined || "Пользователь";
  }, [formData.first_name, formData.last_name]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) setError("");
    if (successMessage) setSuccessMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.email.trim()) {
      setError("Заполните имя, фамилию и email");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        city: formData.city.trim(),
        avatar_url: profile?.avatar_url || "",
        bio: formData.bio.trim(),
        social_vk: formData.social_vk.trim(),
        social_ok: formData.social_ok.trim(),
        social_max: formData.social_max.trim(),
      };

      await updateMyProfile(payload);

      const freshProfile = await getMyProfile();

      setProfile(freshProfile);
      setFormData(mapProfileToForm(freshProfile));
      setSuccessMessage("Изменения сохранены");
    } catch (err) {
      setError(err.message || "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="profile-settings-page">
        <div className="container">
          <div className="profile-page__state">Загрузка настроек...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="profile-settings-page">
      <section
        className="profile-cover"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      ></section>

      <section className="profile-summary">
        <div className="container">
          <div className="profile-summary__avatar-wrap">
            <img
              src={profile?.avatar_url || manAvatar}
              alt="Аватар пользователя"
              className="profile-summary__avatar"
            />
          </div>

          <h1 className="profile-summary__name">{fullName}</h1>
          <div className="profile-summary__role">{getRoleLabel(profile?.role)}</div>
        </div>
      </section>

      <section className="profile-settings">
        <div className="container">
          {error ? (
            <div className="profile-page__state profile-page__state--error">{error}</div>
          ) : null}

          {successMessage ? (
            <div className="profile-page__state">{successMessage}</div>
          ) : null}

          <form className="profile-settings-card" onSubmit={handleSubmit}>
            <div className="profile-settings-card__column profile-settings-card__column--left">
              <h2 className="profile-settings-card__title">Основная информация</h2>
              <div className="profile-settings-card__divider"></div>

              <div className="form-field">
                <label htmlFor="firstName" className="form-field__label">Имя</label>
                <input
                  id="firstName"
                  name="first_name"
                  type="text"
                  className="form-field__input"
                  placeholder="Введите имя"
                  value={formData.first_name}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="form-field">
                <label htmlFor="lastName" className="form-field__label">Фамилия</label>
                <input
                  id="lastName"
                  name="last_name"
                  type="text"
                  className="form-field__input"
                  placeholder="Введите фамилию"
                  value={formData.last_name}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="form-field">
                <label htmlFor="email" className="form-field__label">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="form-field__input"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="form-field">
                <label htmlFor="phone" className="form-field__label">Телефон</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="form-field__input"
                  placeholder="+7 (900) 000-00-00"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="form-field">
                <label htmlFor="city" className="form-field__label">Город</label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  className="form-field__input"
                  placeholder="Введите город"
                  value={formData.city}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <button
                type="submit"
                className="profile-settings-card__button profile-settings-card__button--desktop"
                disabled={saving}
              >
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </button>
            </div>

            <div className="profile-settings-card__column profile-settings-card__column--right">
              <h2 className="profile-settings-card__title profile-settings-card__title--center">Bio</h2>
              <div className="profile-settings-card__divider"></div>

              <div className="form-field">
                <label htmlFor="bio" className="form-field__label visually-hidden">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  className="form-field__textarea"
                  placeholder="Введите краткую информацию о себе"
                  value={formData.bio}
                  onChange={handleChange}
                  disabled={saving}
                ></textarea>
              </div>

              <div className="form-field">
                <label htmlFor="vk" className="form-field__label">Вконтакте</label>
                <input
                  id="vk"
                  name="social_vk"
                  type="text"
                  className="form-field__input"
                  placeholder="vk.com/example"
                  value={formData.social_vk}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="form-field">
                <label htmlFor="ok" className="form-field__label">Одноклассники</label>
                <input
                  id="ok"
                  name="social_ok"
                  type="text"
                  className="form-field__input"
                  placeholder="ok.ru/example"
                  value={formData.social_ok}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="form-field">
                <label htmlFor="max" className="form-field__label">MAX</label>
                <input
                  id="max"
                  name="social_max"
                  type="text"
                  className="form-field__input"
                  placeholder="max.ru/example"
                  value={formData.social_max}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <button type="submit" className="profile-settings-card__button" disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}