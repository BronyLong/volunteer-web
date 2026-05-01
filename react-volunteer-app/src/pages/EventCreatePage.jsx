import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./EventCreatePage.css";

import leafCategoryIcon from "../assets/SVG/leaf_category.svg";
import childrenCategoryIcon from "../assets/SVG/childern_category.svg";
import animalsCategoryIcon from "../assets/SVG/animals_category.svg";
import elderlyCategoryIcon from "../assets/SVG/elderly_category.svg";
import uploadArrowIcon from "../assets/SVG/arrow.svg";

import { createEvent, getCategories, getUserFromToken } from "../api";

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

export default function EventCreatePage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [preview, setPreview] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [categories, setCategories] = useState([]);
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

    async function loadCategories() {
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
      } catch (err) {
        setError(err.message || "Не удалось загрузить категории");
      } finally {
        setLoadingCategories(false);
      }
    }

    loadCategories();
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
        tasks: tasks
          .map((task) => task.trim())
          .filter(Boolean),
        participant_limit: Number(formData.places),
        duration_minutes: Number(formData.durationMinutes),
        category_id: formData.category,
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