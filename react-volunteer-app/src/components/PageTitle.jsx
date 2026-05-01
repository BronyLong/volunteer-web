import { useEffect } from "react";
import { matchPath, useLocation } from "react-router-dom";

const APP_NAME = "Рука помощи";

const titles = [
  { path: "/", title: "Главная" },
  { path: "/events", title: "Мероприятия" },
  { path: "/login", title: "Вход" },
  { path: "/register", title: "Регистрация" },
  { path: "/help", title: "Помощь" },
  { path: "/create", title: "Создание мероприятия" },
  { path: "/admin", title: "Администрирование" },
  { path: "/profiles/:id/settings", title: "Настройки профиля" },
  { path: "/profiles/:id", title: "Профиль" },
  { path: "/events/:id/edit", title: "Редактирование мероприятия" },
  { path: "/events/:id", title: "Мероприятие" },
];

export default function PageTitle() {
  const location = useLocation();

  useEffect(() => {
    const currentPage = titles.find((item) =>
      matchPath({ path: item.path, end: true }, location.pathname)
    );

    document.title = currentPage
      ? `${currentPage.title} | ${APP_NAME}`
      : `Страница не найдена | ${APP_NAME}`;
  }, [location.pathname]);

  return null;
}