import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";
import "./EventsPage.css";

import EventCard from "../components/EventCard";
import childrenHelpImage from "../assets/images/children_help.png";
import peopleImage from "../assets/images/people.png";
import leafCategoryIcon from "../assets/SVG/leaf_category.svg";
import elderlyCategoryIcon from "../assets/SVG/elderly_category.svg";
import animalsCategoryIcon from "../assets/SVG/animals_category.svg";
import childrenCategoryIcon from "../assets/SVG/childern_category.svg";

const EVENTS_PER_PAGE = 6;
const VISIBLE_PAGES = 5;

const FILTERS = [
  {
    key: "all",
    label: "Все категории",
    theme: "all",
  },
  {
    key: "Экология",
    label: "Экология",
    icon: leafCategoryIcon,
    theme: "green",
  },
  {
    key: "Детям",
    label: "Детям",
    icon: childrenCategoryIcon,
    theme: "orange",
  },
  {
    key: "Животным",
    label: "Животным",
    icon: animalsCategoryIcon,
    theme: "green",
  },
  {
    key: "Пожилым",
    label: "Пожилым",
    icon: elderlyCategoryIcon,
    theme: "orange",
  },
];

function parseEventDate(dateString) {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    apiFetch("/events")
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) => parseEventDate(a.start_at) - parseEventDate(b.start_at)
        );
        setEvents(sorted);
      })
      .catch((error) => console.error(error.message));
  }, []);

  const filteredEvents = useMemo(() => {
    if (activeCategory === "all") return events;
    return events.filter((event) => event.category_name === activeCategory);
  }, [events, activeCategory]);

  const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);

  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
    const endIndex = startIndex + EVENTS_PER_PAGE;
    return filteredEvents.slice(startIndex, endIndex);
  }, [filteredEvents, currentPage]);

  const currentGroup = Math.floor((currentPage - 1) / VISIBLE_PAGES);
  const startPage = currentGroup * VISIBLE_PAGES + 1;
  const endPage = Math.min(startPage + VISIBLE_PAGES - 1, totalPages);

  const visiblePages = [];
  for (let page = startPage; page <= endPage; page += 1) {
    visiblePages.push(page);
  }

  function goToPage(page) {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToNextGroup() {
    if (endPage < totalPages) {
      goToPage(endPage + 1);
    }
  }

  function handleFilterChange(categoryKey) {
    setActiveCategory(categoryKey);
    setCurrentPage(1);
  }

  const getCategoryType = (categoryName) => {
    if (categoryName === "Экология") return "ecology";
    if (categoryName === "Детям") return "children";
    if (categoryName === "Животным") return "animals";
    return "elderly";
  };

  return (
    <main className="events-page">
      <section className="events-hero">
        <div className="events-hero__background"></div>

        <div className="container events-hero__inner">
          <div className="events-hero__content">
            <h1 className="events-hero__title">Доступные мероприятия</h1>
            <p className="events-hero__subtitle">
              Находите интересные задания, в которых можно принять участие и помочь местным
            </p>
          </div>

          <div className="events-hero__people">
            <img
              src={peopleImage}
              alt="Волонтеры"
              className="events-hero__people-image"
            />
          </div>
        </div>
      </section>

      <section className="events-catalog">
        <div className="container">
          <div className="events-filters">
            {FILTERS.map((filter) => {
              const isActive = activeCategory === filter.key;

              return (
                <button
                  key={filter.key}
                  type="button"
                  className={`events-filters__button events-filters__button--${filter.theme} ${
                    isActive ? "events-filters__button--active" : ""
                  }`}
                  onClick={() => handleFilterChange(filter.key)}
                >
                  {filter.icon && (
                    <span className="events-filters__icon-wrap">
                      <img src={filter.icon} alt="" className="events-filters__icon" />
                    </span>
                  )}
                  <span>{filter.label}</span>
                </button>
              );
            })}
          </div>

          <div className="events-divider"></div>

          <div className="events-grid">
            {paginatedEvents.map((event) => (
              <EventCard
                key={event.id}
                title={event.title}
                date={new Date(event.start_at).toLocaleDateString("ru-RU")}
                location={event.location}
                places={`${event.available_slots} из ${event.participant_limit}`}
                image={childrenHelpImage}
                category={getCategoryType(event.category_name)}
                link={`/events/${event.id}`}
              />
            ))}
          </div>

          {!paginatedEvents.length && (
            <div className="events-empty">
              По выбранной категории мероприятий пока нет.
            </div>
          )}

          {totalPages > 1 && (
            <div className="events-pagination">
              {startPage > 1 && (
                <button
                  type="button"
                  className="events-pagination__item"
                  onClick={() => goToPage(1)}
                >
                  В начало
                </button>
              )}

              {visiblePages.map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`events-pagination__item ${
                    currentPage === page ? "events-pagination__item--active" : ""
                  }`}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              ))}

              {endPage < totalPages && (
                <button
                  type="button"
                  className="events-pagination__item"
                  onClick={goToNextGroup}
                >
                  дальше →
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}