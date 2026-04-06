import { useEffect, useMemo, useRef, useState } from "react";
import "./EventEditPage.css";

import leafCategoryIcon from "../assets/SVG/leaf_category.svg";
import childrenCategoryIcon from "../assets/SVG/childern_category.svg";
import animalsCategoryIcon from "../assets/SVG/animals_category.svg";
import elderlyCategoryIcon from "../assets/SVG/elderly_category.svg";
import uploadArrowIcon from "../assets/SVG/arrow.svg";

const CATEGORY_OPTIONS = [
  { value: "eco", label: "Экология", icon: leafCategoryIcon },
  { value: "children", label: "Детям", icon: childrenCategoryIcon },
  { value: "animals", label: "Животным", icon: animalsCategoryIcon },
  { value: "elderly", label: "Пожилым", icon: elderlyCategoryIcon },
];

const INITIAL_FORM = {
  title: 'Субботник в парке “Зеленый уголок”',
  description:
    'Мы приглашаем вас принять участие в субботнике по уборке парка “Зеленый уголок”. Наша цель - сделать парк чистым, удобным и более веселым местом для всех жителей города.',
  category: "eco",
  places: "20",
  location:
    'г. Икс, неизвестная область, улица пушкина, парк “Зеленый уголок”',
  date: "1980-01-01",
  time: "11:00",
};

const INITIAL_TASKS = [
  "Собрать мусор",
  "Постричь кусты",
  "Отчитаться о выполненных действиях",
];

export default function EventEditPage() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [newTask, setNewTask] = useState("");
  const [preview, setPreview] = useState("");

  const descriptionRef = useRef(null);
  const locationRef = useRef(null);

  const selectedCategory = useMemo(
    () =>
      CATEGORY_OPTIONS.find((option) => option.value === formData.category) ||
      CATEGORY_OPTIONS[0],
    [formData.category]
  );

  useEffect(() => {
    autoResize(descriptionRef.current);
    autoResize(locationRef.current);
  }, [formData.description, formData.location]);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  function autoResize(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "places") {
      if (value === "") {
        setFormData((prev) => ({ ...prev, places: "" }));
        return;
      }

      const numericValue = Number(value);
      if (numericValue < 1) return;

      setFormData((prev) => ({
        ...prev,
        places: value,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handlePlacesBlur() {
    if (formData.places === "" || Number(formData.places) < 1) {
      setFormData((prev) => ({
        ...prev,
        places: "1",
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

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);

    setPreview((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return imageUrl;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    console.log("Сохранение мероприятия", { ...formData, tasks, preview });
  }

  function handleDelete() {
    console.log("Удаление мероприятия");
  }

  return (
    <main className="event-edit-page">
      <section className="event-edit-section">
        <div className="container">
          <div className="event-edit-shell">
            <form className="event-edit-card" onSubmit={handleSubmit}>
              <h1 className="event-edit-card__title">Изменить мероприятие</h1>
              <div className="event-edit-card__divider"></div>

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
                      className="form-field__input"
                      value={formData.title}
                      onChange={handleChange}
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
                      className="form-field__textarea form-field__textarea--description"
                      rows="1"
                      value={formData.description}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="event-edit-form__full">
                  <div className="form-field">
                    <span className="form-field__label">Задачи</span>

                    <div className="tasks-box">
                      <div className="tasks-list">
                        {tasks.map((task, index) => (
                          <div className="task-item" key={`${index}-${task}`}>
                            <input
                              type="text"
                              className="task-input"
                              value={task}
                              onChange={(event) =>
                                handleTaskChange(index, event.target.value)
                              }
                            />

                            <button
                              type="button"
                              className="task-remove"
                              onClick={() => handleRemoveTask(index)}
                              aria-label="Удалить задачу"
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
                        />

                        <button
                          type="button"
                          className="task-add-btn"
                          onClick={handleAddTask}
                          aria-label="Добавить задачу"
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
                      style={{ "--category-icon": `url(${selectedCategory.icon})` }}
                    >
                      <select
                        id="eventCategory"
                        name="category"
                        className="form-field__select"
                        value={formData.category}
                        onChange={handleChange}
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
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
                      className="form-field__textarea form-field__textarea--location"
                      rows="1"
                      value={formData.location}
                      onChange={handleChange}
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
                  <button type="submit" className="event-edit-form__submit">
                    Применить изменения
                  </button>

                  <button
                    type="button"
                    className="event-edit-form__delete"
                    onClick={handleDelete}
                  >
                    Удалить мероприятие
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