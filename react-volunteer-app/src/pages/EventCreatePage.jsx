import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./EventCreatePage.css";

import YandexEventMap from "../components/YandexEventMap";

import leafCategoryIcon from "../assets/SVG/leaf_category.svg";
import childrenCategoryIcon from "../assets/SVG/childern_category.svg";
import animalsCategoryIcon from "../assets/SVG/animals_category.svg";
import elderlyCategoryIcon from "../assets/SVG/elderly_category.svg";
import uploadArrowIcon from "../assets/SVG/arrow.svg";

import {
  createEvent,
  getCategories,
  getCoordinatorNotificationVolunteers,
  getUserFromToken,
} from "../api";
import { getProfileAvatar } from "../utils/avatarUtils";

const INITIAL_FORM = {
  title: "",
  description: "",
  category: "",
  places: "20",
  location: "",
  date: "",
  time: "",
  durationMinutes: "120",
};

function getCategoryIconByName(name) {
  const normalized = String(name || "").toLowerCase();

  if (normalized.includes("эколог")) return leafCategoryIcon;
  if (normalized.includes("дет")) return childrenCategoryIcon;
  if (normalized.includes("живот")) return animalsCategoryIcon;
  if (normalized.includes("пожил")) return elderlyCategoryIcon;

  return leafCategoryIcon;
}

function resizeImage(file, maxWidth = 1200, maxHeight = 900, quality = 0.85) {
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
        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      img.onerror = () => reject(new Error("Не удалось загрузить изображение"));
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function getVolunteerName(volunteer) {
  return [volunteer.first_name, volunteer.middle_name, volunteer.last_name]
    .filter(Boolean)
    .join(" ") || volunteer.email || "Волонтёр";
}

function normalizeVolunteerSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function getVolunteerSearchFields(volunteer) {
  return [
    volunteer.first_name,
    volunteer.last_name,
    volunteer.middle_name,
    volunteer.email,
    getVolunteerName(volunteer),
    [volunteer.last_name, volunteer.first_name, volunteer.middle_name]
      .filter(Boolean)
      .join(" "),
    [volunteer.first_name, volunteer.middle_name, volunteer.last_name]
      .filter(Boolean)
      .join(" "),
  ]
    .map(normalizeVolunteerSearchText)
    .filter(Boolean);
}

function isVolunteerMatchedBySearch(volunteer, searchValue) {
  const queryParts = normalizeVolunteerSearchText(searchValue)
    .split(" ")
    .filter(Boolean);

  if (queryParts.length === 0) {
    return true;
  }

  const searchableText = getVolunteerSearchFields(volunteer).join(" ");

  return queryParts.every((part) => searchableText.includes(part));
}

export default function EventCreatePage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [preview, setPreview] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [locationCoordinates, setLocationCoordinates] = useState(null);
  const [categories, setCategories] = useState([]);
  const [notificationVolunteers, setNotificationVolunteers] = useState([]);
  const [selectedNotificationVolunteerIds, setSelectedNotificationVolunteerIds] = useState([]);
  const [isUrgentEvent, setIsUrgentEvent] = useState(false);
  const [notifySpecificVolunteers, setNotifySpecificVolunteers] = useState(false);
  const [volunteerSearch, setVolunteerSearch] = useState("");
  const [volunteerDropdownOpen, setVolunteerDropdownOpen] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const descriptionRef = useRef(null);
  const locationRef = useRef(null);

  const selectedCategory = useMemo(() => {
    const found = categories.find((option) => String(option.id) === String(formData.category));
    return (
      found || {
        id: "",
        name: "Экология",
        icon: leafCategoryIcon,
      }
    );
  }, [categories, formData.category]);

  const availableNotificationVolunteers = useMemo(() => {
    if (!isUrgentEvent) return notificationVolunteers;
    return notificationVolunteers.filter((volunteer) => volunteer.can_receive_urgent);
  }, [isUrgentEvent, notificationVolunteers]);

  const selectedNotificationVolunteers = useMemo(
    () =>
      selectedNotificationVolunteerIds
        .map((id) => availableNotificationVolunteers.find((volunteer) => String(volunteer.id) === String(id)))
        .filter(Boolean),
    [availableNotificationVolunteers, selectedNotificationVolunteerIds]
  );

  const filteredNotificationVolunteers = useMemo(() => {
    return availableNotificationVolunteers
      .filter((volunteer) => !selectedNotificationVolunteerIds.includes(volunteer.id))
      .filter((volunteer) => isVolunteerMatchedBySearch(volunteer, volunteerSearch))
      .slice(0, 8);
  }, [availableNotificationVolunteers, selectedNotificationVolunteerIds, volunteerSearch]);

  const showVolunteerPicker = notifySpecificVolunteers || isUrgentEvent;
  const selectedVolunteerModeLabel = isUrgentEvent
    ? "Выбранные волонтёры получат срочное уведомление. Если никого не выбрать, уведомление получат все подходящие волонтёры координатора."
    : "Уведомление получат только выбранные волонтёры.";

  useEffect(() => {
    const currentUser = getUserFromToken();

    if (!currentUser) {
      navigate("/login", { replace: true });
      return;
    }

    if (currentUser.role !== "coordinator" && currentUser.role !== "admin") {
      navigate("/", { replace: true });
      return;
    }

    async function loadInitialData() {
      try {
        setLoadingCategories(true);
        const data = await getCategories();
        const prepared = data.map((category) => ({
          ...category,
          icon: getCategoryIconByName(category.name),
        }));

        setCategories(prepared);

        if (prepared.length > 0) {
          setFormData((prev) => ({
            ...prev,
            category: String(prepared[0].id),
          }));
        }

        if (currentUser.role === "coordinator") {
          const volunteers = await getCoordinatorNotificationVolunteers();
          setNotificationVolunteers(Array.isArray(volunteers) ? volunteers : []);
        }
      } catch (err) {
        setError(err.message || "Не удалось загрузить данные формы");
      } finally {
        setLoadingCategories(false);
      }
    }

    loadInitialData();
  }, [navigate]);

  useEffect(() => {
    autoResize(descriptionRef.current);
    autoResize(locationRef.current);
  }, [formData.description, formData.location]);

  function autoResize(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function handleLocationAddressChange(nextAddress) {
    setFormData((prev) => ({
      ...prev,
      location: nextAddress,
    }));

    if (error) setError("");
  }

  function handleChange(event) {
    const { name, value } = event.target;
  
    if (name === "places" || name === "durationMinutes") {
      if (value === "") {
        setFormData((prev) => ({
          ...prev,
          [name]: "",
        }));
        return;
      }
  
      const numericValue = Number(value);
      if (numericValue < 1) return;
  
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
      return;
    }
  
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "location") {
      setLocationCoordinates(null);
    }
  
    if (error) setError("");
  }

  function handlePlacesBlur() {
    if (formData.places === "" || Number(formData.places) < 1) {
      setFormData((prev) => ({
        ...prev,
        places: "1",
      }));
    }
  }

  function handleDurationBlur() {
    if (formData.durationMinutes === "" || Number(formData.durationMinutes) < 1) {
      setFormData((prev) => ({
        ...prev,
        durationMinutes: "1",
      }));
    }
  }

  function handleTaskChange(index, value) {
    setTasks((prev) =>
      prev.map((task, taskIndex) => (taskIndex === index ? value : task))
    );
  }

  function handleRemoveTask(index) {
    setTasks((prev) => prev.filter((_, taskIndex) => taskIndex !== index));
  }

  function handleAddTask() {
    const trimmedTask = newTask.trim();
    if (!trimmedTask) return;

    setTasks((prev) => [...prev, trimmedTask]);
    setNewTask("");
  }

  function handleTaskKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddTask();
    }
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Выберите изображение");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await resizeImage(file);
      setPreview(dataUrl);
      setImageDataUrl(dataUrl);
    } catch (err) {
      setError(err.message || "Не удалось загрузить изображение");
    } finally {
      event.target.value = "";
    }
  }

  function handleUrgentToggle(event) {
    const checked = event.target.checked;
    setIsUrgentEvent(checked);

    if (checked) {
      setNotifySpecificVolunteers(false);
      setSelectedNotificationVolunteerIds((prev) => {
        const urgentAllowedIds = new Set(
          notificationVolunteers
            .filter((volunteer) => volunteer.can_receive_urgent)
            .map((volunteer) => String(volunteer.id))
        );

        return prev.filter((id) => urgentAllowedIds.has(String(id)));
      });
    }

    if (error) setError("");
  }

  function handleNotifySpecificToggle(event) {
    const checked = event.target.checked;
    setNotifySpecificVolunteers(checked);

    if (checked) {
      setIsUrgentEvent(false);
    }

    if (error) setError("");
  }

  function handleAddNotificationVolunteer(volunteer) {
    setSelectedNotificationVolunteerIds((prev) => {
      if (prev.includes(volunteer.id)) return prev;
      return [...prev, volunteer.id];
    });
    setVolunteerSearch("");
    setVolunteerDropdownOpen(false);
  }

  function handleRemoveNotificationVolunteer(volunteerId) {
    setSelectedNotificationVolunteerIds((prev) => prev.filter((id) => id !== volunteerId));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    if (
      !formData.title.trim() ||
      !formData.description.trim() ||
      !formData.category ||
      !formData.places ||
      !formData.location.trim() ||
      !formData.date ||
      !formData.time ||
      !formData.durationMinutes
    ) {
      setError("Заполните все обязательные поля");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        title: formData.title.trim(),
        image_url: imageDataUrl || null,
        description: formData.description.trim(),
        start_at: `${formData.date}T${formData.time}:00`,
        location: formData.location.trim(),
        location_latitude: locationCoordinates ? locationCoordinates[0] : null,
        location_longitude: locationCoordinates ? locationCoordinates[1] : null,
        tasks: tasks
          .map((task) => task.trim())
          .filter(Boolean),
        participant_limit: Number(formData.places),
        duration_minutes: Number(formData.durationMinutes),
        category_id: formData.category,
        is_urgent: isUrgentEvent,
        notify_specific_volunteers: notifySpecificVolunteers,
        notify_volunteer_ids: showVolunteerPicker ? selectedNotificationVolunteerIds : [],
      };

      const result = await createEvent(payload);
      const createdId = result?.event?.id;

      if (createdId) {
        navigate(`/events/${createdId}`);
        return;
      }

      navigate("/events");
    } catch (err) {
      setError(err.message || "Не удалось создать мероприятие");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="event-edit-page">
      <section className="event-edit-section">
        <div className="container">
          <div className="event-edit-shell">
            <form className="event-edit-card" onSubmit={handleSubmit}>
              <h1 className="event-edit-card__title">Новое мероприятие</h1>
              <div className="event-edit-card__divider"></div>

              {error ? (
                <p className="event-edit-form__status">{error}</p>
              ) : null}

              <div className="event-edit-form">
                <div className="event-edit-form__full">
                  <div className="form-field">
                    <label htmlFor="eventTitle" className="form-field__label">
                      Название мероприятия
                    </label>
                    <input
                      id="eventTitle"
                      name="title"
                      type="text"
                      placeholder="Название..."
                      className="form-field__input"
                      value={formData.title}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="event-edit-form__full">
                  <div className="form-field">
                    <label
                      htmlFor="eventDescription"
                      className="form-field__label"
                    >
                      Описание мероприятия
                    </label>
                    <textarea
                      ref={descriptionRef}
                      id="eventDescription"
                      name="description"
                      placeholder="Описание..."
                      className="form-field__textarea form-field__textarea--description"
                      rows="1"
                      value={formData.description}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="event-edit-form__full">
                  <div className="form-field">
                    <span className="form-field__label">Задачи</span>

                    <div className="tasks-box">
                      <div className="tasks-list">
                        {tasks.map((task, index) => (
                          <div className="task-item" key={index}>
                            <input
                              type="text"
                              className="task-input"
                              value={task}
                              onChange={(event) =>
                                handleTaskChange(index, event.target.value)
                              }
                              disabled={saving}
                            />

                            <button
                              type="button"
                              className="task-remove"
                              onClick={() => handleRemoveTask(index)}
                              aria-label="Удалить задачу"
                              disabled={saving}
                            >
                              −
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="task-add">
                        <input
                          type="text"
                          className="task-input"
                          placeholder="Новая задача"
                          value={newTask}
                          onChange={(event) => setNewTask(event.target.value)}
                          onKeyDown={handleTaskKeyDown}
                          disabled={saving}
                        />

                        <button
                          type="button"
                          className="task-add-btn"
                          onClick={handleAddTask}
                          aria-label="Добавить задачу"
                          disabled={saving}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="event-edit-form__full">
                  <div className="form-field">
                    <span className="form-field__label">Уведомления</span>

                    <div className="event-notification-box">
                      <div className="event-notification-box__checks">
                        <label className="event-notification-check">
                          <input
                            type="checkbox"
                            checked={isUrgentEvent}
                            onChange={handleUrgentToggle}
                            disabled={saving}
                          />
                          <span className="event-notification-check__box" aria-hidden="true"></span>
                          <span className="event-notification-check__content">
                            <span className="event-notification-check__title">Срочное мероприятие</span>
                            <span className="event-notification-check__text">
                              Срочное уведомление нельзя отключить в настройках. Получателями будут выбранные волонтёры или все подходящие волонтёры координатора.
                            </span>
                          </span>
                        </label>

                        <label className="event-notification-check">
                          <input
                            type="checkbox"
                            checked={notifySpecificVolunteers}
                            onChange={handleNotifySpecificToggle}
                            disabled={saving}
                          />
                          <span className="event-notification-check__box" aria-hidden="true"></span>
                          <span className="event-notification-check__content">
                            <span className="event-notification-check__title">Уведомить конкретных волонтёров</span>
                            <span className="event-notification-check__text">
                              Обычное уведомление получат только выбранные волонтёры.
                            </span>
                          </span>
                        </label>
                      </div>

                      {showVolunteerPicker ? (
                        <div className="event-volunteer-picker">
                          <div className="event-volunteer-picker__head">
                            <h2 className="event-volunteer-picker__title">Выбранные волонтёры</h2>
                            <p className="event-volunteer-picker__text">
                              В поиск попадают волонтёры, связанные с мероприятиями координатора. Для срочного уведомления доступны только волонтёры с принятой заявкой или подтвержденным участием.
                            </p>
                            <p className="event-volunteer-picker__mode">{selectedVolunteerModeLabel}</p>
                          </div>

                          <div className="event-volunteer-picker__search-wrap">
                            <input
                              type="text"
                              className="event-volunteer-picker__search"
                              placeholder="Введите ФИО или почту волонтёра"
                              value={volunteerSearch}
                              onChange={(event) => {
                                setVolunteerSearch(event.target.value);
                                setVolunteerDropdownOpen(true);
                              }}
                              onFocus={() => setVolunteerDropdownOpen(true)}
                              onBlur={() => {
                                window.setTimeout(() => setVolunteerDropdownOpen(false), 120);
                              }}
                              disabled={saving || availableNotificationVolunteers.length === 0}
                            />

                            {volunteerDropdownOpen ? (
                              <div className="event-volunteer-picker__dropdown">
                                {filteredNotificationVolunteers.length > 0 ? (
                                  filteredNotificationVolunteers.map((volunteer) => (
                                    <button
                                      key={volunteer.id}
                                      type="button"
                                      className="event-volunteer-picker__option"
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => handleAddNotificationVolunteer(volunteer)}
                                      disabled={saving}
                                    >
                                      <img
                                        src={getProfileAvatar(volunteer)}
                                        alt=""
                                        className="event-volunteer-picker__avatar"
                                      />
                                      <span className="event-volunteer-picker__option-content">
                                        <span className="event-volunteer-picker__name">{getVolunteerName(volunteer)}</span>
                                        <span className="event-volunteer-picker__email">{volunteer.email}</span>
                                      </span>
                                    </button>
                                  ))
                                ) : (
                                  <div className="event-volunteer-picker__empty">
                                    Подходящие волонтёры не найдены
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>

                          {selectedNotificationVolunteers.length > 0 ? (
                            <div className="event-volunteer-picker__selected-list">
                              {selectedNotificationVolunteers.map((volunteer) => (
                                <div key={volunteer.id} className="event-volunteer-picker__selected-item">
                                  <img
                                    src={getProfileAvatar(volunteer)}
                                    alt=""
                                    className="event-volunteer-picker__selected-avatar"
                                  />
                                  <span className="event-volunteer-picker__selected-content">
                                    <span className="event-volunteer-picker__selected-name">
                                      {getVolunteerName(volunteer)}
                                    </span>
                                    <span className="event-volunteer-picker__selected-email">
                                      {volunteer.email}
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    className="event-volunteer-picker__remove"
                                    onClick={() => handleRemoveNotificationVolunteer(volunteer.id)}
                                    disabled={saving}
                                    aria-label={`Убрать ${getVolunteerName(volunteer)} из списка уведомления`}
                                  >
                                    −
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="event-volunteer-picker__notice">
                              Волонтёры пока не выбраны.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="event-edit-form__left">
                  <div className="form-field">
                    <label htmlFor="eventCategory" className="form-field__label">
                      Категория
                    </label>

                    <div
                      className="select-wrap"
                      style={{
                        "--category-icon": `url("${selectedCategory.icon}")`,
                      }}
                    >
                      <select
                        id="eventCategory"
                        name="category"
                        className="form-field__select"
                        value={formData.category}
                        onChange={handleChange}
                        disabled={saving || loadingCategories}
                      >
                        {categories.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>

                      <span className="select-wrap__arrow" aria-hidden="true"></span>
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="eventPlaces" className="form-field__label">
                      Количество мест
                    </label>
                    <input
                      id="eventPlaces"
                      name="places"
                      type="number"
                      min="1"
                      className="form-field__input form-field__input--small"
                      value={formData.places}
                      onChange={handleChange}
                      onBlur={handlePlacesBlur}
                      disabled={saving}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="eventLocation" className="form-field__label">
                      Место проведения
                    </label>
                    <textarea
                      ref={locationRef}
                      id="eventLocation"
                      name="location"
                      placeholder="Место проведения..."
                      className="form-field__textarea form-field__textarea--location"
                      rows="1"
                      value={formData.location}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>

                  <div className="event-edit-form__map-field">
                    <YandexEventMap
                      address={formData.location}
                      coordinates={locationCoordinates}
                      title={formData.title || "Место проведения мероприятия"}
                      editable
                      onCoordinatesChange={setLocationCoordinates}
                      onAddressChange={handleLocationAddressChange}
                    />
                  </div>

                  <div className="event-edit-form__datetime">
                    <div className="form-field">
                      <label htmlFor="eventDate" className="form-field__label">
                        Дата проведения
                      </label>
                      <input
                        id="eventDate"
                        name="date"
                        type="date"
                        className="form-field__input"
                        value={formData.date}
                        onChange={handleChange}
                        disabled={saving}
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="eventTime" className="form-field__label">
                        Время проведения
                      </label>
                      <input
                        id="eventTime"
                        name="time"
                        type="time"
                        className="form-field__input"
                        value={formData.time}
                        onChange={handleChange}
                        disabled={saving}
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="eventDuration" className="form-field__label">
                        Длительность, минут
                      </label>
                      <input
                        id="eventDuration"
                        name="durationMinutes"
                        type="number"
                        min="1"
                        className="form-field__input"
                        value={formData.durationMinutes}
                        onChange={handleChange}
                        onBlur={handleDurationBlur}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>

                <div className="event-edit-form__right">
                  <div className="form-field">
                    <label htmlFor="eventImage" className="form-field__label">
                      Загрузить изображение
                    </label>

                    <label htmlFor="eventImage" className="upload-box">
                      <input
                        id="eventImage"
                        name="eventImage"
                        type="file"
                        accept="image/*"
                        className="upload-box__input"
                        onChange={handleImageChange}
                        disabled={saving}
                      />

                      {preview ? (
                        <img
                          src={preview}
                          alt="Превью изображения"
                          className="upload-box__preview upload-box__preview--visible"
                        />
                      ) : (
                        <span className="upload-box__placeholder" aria-hidden="true">
                          <img
                            src={uploadArrowIcon}
                            alt=""
                            className="upload-box__icon-svg"
                          />
                        </span>
                      )}
                    </label>
                  </div>
                </div>

                <div className="event-edit-form__actions">
                  <button type="submit" className="event-edit-form__submit" disabled={saving}>
                    {saving ? "Создаем..." : "Создать мероприятие"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
