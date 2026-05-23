import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getEvents, getMyProfile, getToken } from "../api";
import "./EventsPage.css";

import EventCard from "../components/EventCard";
import defaultEventImage from "../assets/images/default_event.png";
import peopleImage from "../assets/images/people.png";
import leafCategoryIcon from "../assets/SVG/leaf_category.svg";
import elderlyCategoryIcon from "../assets/SVG/elderly_category.svg";
import animalsCategoryIcon from "../assets/SVG/animals_category.svg";
import childrenCategoryIcon from "../assets/SVG/childern_category.svg";

const EVENTS_PER_PAGE = 6;
const VISIBLE_PAGES = 5;
const VISIBLE_PAGES_WITH_NEXT = VISIBLE_PAGES - 1;

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

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: EVENTS_PER_PAGE,
    total: 0,
    total_pages: 1,
    has_next_page: false,
    has_prev_page: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState("all");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUserRole() {
      if (!getToken()) {
        setCurrentUserRole(null);
        return;
      }

      try {
        const profile = await getMyProfile();

        if (!isMounted) return;

        setCurrentUserRole(profile?.role || null);
      } catch {
        if (isMounted) {
          setCurrentUserRole(null);
        }
      }
    }

    loadCurrentUserRole();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    getEvents({
      page: currentPage,
      limit: EVENTS_PER_PAGE,
      category: activeCategory === "all" ? "" : activeCategory,
      urgent: urgentOnly ? "true" : "",
    })
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.items || [];

        setEvents(items);
        setPagination(
          data?.pagination || {
            page: currentPage,
            limit: EVENTS_PER_PAGE,
            total: items.length,
            total_pages: 1,
            has_next_page: false,
            has_prev_page: currentPage > 1,
          }
        );
      })
      .catch((error) => console.error(error.message));
  }, [currentPage, activeCategory, urgentOnly]);

  const totalPages = pagination.total_pages || 1;
  const hasHiddenPages = totalPages > VISIBLE_PAGES;
  const pagesInGroup = hasHiddenPages ? VISIBLE_PAGES_WITH_NEXT : VISIBLE_PAGES;
  const currentGroup = Math.floor((currentPage - 1) / pagesInGroup);
  const startPage = currentGroup * pagesInGroup + 1;
  const endPage = Math.min(startPage + pagesInGroup - 1, totalPages);

  const visiblePages = [];
  for (let page = startPage; page <= endPage; page += 1) {
    visiblePages.push(page);
  }

  const shouldShowNextButton = endPage < totalPages;

  function goToPage(page) {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToNextGroup() {
    if (shouldShowNextButton) {
      goToPage(endPage + 1);
    }
  }

  function handleFilterChange(categoryKey) {
    setActiveCategory(categoryKey);
    setCurrentPage(1);
  }

  function handleUrgentFilterToggle() {
    setUrgentOnly((prev) => !prev);
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
          {currentUserRole === "coordinator" ? (
            <section className="events-create-panel" aria-label="Создание мероприятия">
              <div className="events-create-panel__content">
                <h2 className="events-create-panel__title">Создание мероприятия</h2>
                <p className="events-create-panel__text">
                  Добавьте новое мероприятие, укажите место, дату, задачи и количество
                  доступных мест для волонтёров.
                </p>
              </div>

              <Link to="/create" className="events-create-panel__button">
                Создать мероприятие
              </Link>
            </section>
          ) : null}

          <div className="events-filters">
            <button
              type="button"
              className={`events-filters__button events-filters__button--urgent ${
                urgentOnly ? "events-filters__button--active" : ""
              }`}
              onClick={handleUrgentFilterToggle}
            >
              Срочные
            </button>

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
            {events.map((event) => (
              <EventCard
                key={event.id}
                title={event.title}
                date={new Date(event.start_at).toLocaleDateString("ru-RU")}
                location={event.location}
                places={`${event.available_slots} из ${event.participant_limit}`}
                image={event.image_url || defaultEventImage}
                category={getCategoryType(event.category_name)}
                isUrgent={event.is_urgent}
                link={`/events/${event.id}`}
              />
            ))}
          </div>

          {!events.length && (
            <div className="events-empty">
              По выбранным фильтрам мероприятий пока нет.
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

              {shouldShowNextButton && (
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