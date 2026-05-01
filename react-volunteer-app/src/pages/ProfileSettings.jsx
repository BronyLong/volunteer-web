import "./ProfileSettings.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getMyProfile, getUserIdFromToken, updateMyProfile } from "../api";
import {
  INITIAL_PROFILE_FIELD_ERRORS,
  buildValidationErrors,
  formatRussianPhone,
  getFieldClassName,
  getRoleLabel,
  hasValidationErrors,
  mapProfileToForm,
  normalizeEmail,
} from "../utils/profileUtils";

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

const INITIAL_FIELD_ERRORS = INITIAL_PROFILE_FIELD_ERRORS;

export default function ProfileSettings() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState(INITIAL_FIELD_ERRORS);
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
        setFieldErrors(INITIAL_FIELD_ERRORS);
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

    let nextValue = value;

    if (name === "phone") {
      nextValue = formatRussianPhone(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    setFieldErrors((prev) => ({
      ...prev,
      [name]: "",
    }));

    if (error) setError("");
    if (successMessage) setSuccessMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    const preparedFormData = {
      ...formData,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: normalizeEmail(formData.email),
      phone: formData.phone.trim(),
      city: formData.city.trim(),
      bio: formData.bio.trim(),
      social_vk: formData.social_vk.trim(),
      social_ok: formData.social_ok.trim(),
      social_max: formData.social_max.trim(),
    };

    const validationErrors = buildValidationErrors(preparedFormData);
    setFieldErrors(validationErrors);

    if (hasValidationErrors(validationErrors)) {
      setError("Исправьте ошибки в форме");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const payload = {
        first_name: preparedFormData.first_name,
        last_name: preparedFormData.last_name,
        email: preparedFormData.email,
        phone: preparedFormData.phone,
        city: preparedFormData.city,
        avatar_url: profile?.avatar_url || "",
        bio: preparedFormData.bio,
        social_vk: preparedFormData.social_vk,
        social_ok: preparedFormData.social_ok,
        social_max: preparedFormData.social_max,
      };

      await updateMyProfile(payload);

      const freshProfile = await getMyProfile();

      setProfile(freshProfile);
      setFormData(mapProfileToForm(freshProfile));
      setFieldErrors(INITIAL_FIELD_ERRORS);
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
                <label htmlFor="firstName" className="form-field__label">
                  Имя
                </label>
                <input
                  id="firstName"
                  name="first_name"
                  type="text"
                  className={getFieldClassName(Boolean(fieldErrors.first_name))}
                  placeholder="Введите имя"
                  value={formData.first_name}
                  onChange={handleChange}
                  disabled={saving}
                />
                {fieldErrors.first_name ? (
                  <div className="form-field__error">{fieldErrors.first_name}</div>
                ) : null}
              </div>

              <div className="form-field">
                <label htmlFor="lastName" className="form-field__label">
                  Фамилия
                </label>
                <input
                  id="lastName"
                  name="last_name"
                  type="text"
                  className={getFieldClassName(Boolean(fieldErrors.last_name))}
                  placeholder="Введите фамилию"
                  value={formData.last_name}
                  onChange={handleChange}
                  disabled={saving}
                />
                {fieldErrors.last_name ? (
                  <div className="form-field__error">{fieldErrors.last_name}</div>
                ) : null}
              </div>

              <div className="form-field">
                <label htmlFor="email" className="form-field__label">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={getFieldClassName(Boolean(fieldErrors.email))}
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={saving}
                />
                {fieldErrors.email ? (
                  <div className="form-field__error">{fieldErrors.email}</div>
                ) : null}
              </div>

              <div className="form-field">
                <label htmlFor="phone" className="form-field__label">
                  Телефон
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className={getFieldClassName(Boolean(fieldErrors.phone))}
                  placeholder="+7 (900) 000-00-00"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={saving}
                />
                {fieldErrors.phone ? (
                  <div className="form-field__error">{fieldErrors.phone}</div>
                ) : null}
              </div>

              <div className="form-field">
                <label htmlFor="city" className="form-field__label">
                  Город
                </label>
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
              <h2 className="profile-settings-card__title profile-settings-card__title--center">
                Bio
              </h2>
              <div className="profile-settings-card__divider"></div>

              <div className="form-field">
                <label htmlFor="bio" className="form-field__label visually-hidden">
                  Bio
                </label>
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
                <label htmlFor="vk" className="form-field__label">
                  Вконтакте
                </label>
                <input
                  id="vk"
                  name="social_vk"
                  type="text"
                  className={getFieldClassName(Boolean(fieldErrors.social_vk))}
                  placeholder="vk.com/example"
                  value={formData.social_vk}
                  onChange={handleChange}
                  disabled={saving}
                />
                {fieldErrors.social_vk ? (
                  <div className="form-field__error">{fieldErrors.social_vk}</div>
                ) : null}
              </div>

              <div className="form-field">
                <label htmlFor="ok" className="form-field__label">
                  Одноклассники
                </label>
                <input
                  id="ok"
                  name="social_ok"
                  type="text"
                  className={getFieldClassName(Boolean(fieldErrors.social_ok))}
                  placeholder="ok.ru/example"
                  value={formData.social_ok}
                  onChange={handleChange}
                  disabled={saving}
                />
                {fieldErrors.social_ok ? (
                  <div className="form-field__error">{fieldErrors.social_ok}</div>
                ) : null}
              </div>

              <div className="form-field">
                <label htmlFor="max" className="form-field__label">
                  MAX
                </label>
                <input
                  id="max"
                  name="social_max"
                  type="text"
                  className={getFieldClassName(Boolean(fieldErrors.social_max))}
                  placeholder="max.ru/example"
                  value={formData.social_max}
                  onChange={handleChange}
                  disabled={saving}
                />
                {fieldErrors.social_max ? (
                  <div className="form-field__error">{fieldErrors.social_max}</div>
                ) : null}
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