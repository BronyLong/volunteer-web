# ВКР: Веб-приложение волонтерской организации

[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/node.js-339933.svg?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Nginx](https://img.shields.io/badge/nginx-%23009639.svg?style=for-the-badge&logo=nginx&logoColor=white)](https://nginx.org/)
[![PM2](https://img.shields.io/badge/pm2-%23000000.svg?style=for-the-badge&logo=pm2&logoColor=white)](https://pm2.keymetrics.io/)
[![JWT](https://img.shields.io/badge/jwt-black.svg?style=for-the-badge&logo=JSON%20web%20tokens)](https://jwt.io/)

## 📋 Описание проекта

Веб-приложение для волонтерской организации, разработанное в рамках выпускной квалификационной работы.

Проект включает клиентскую часть на React, серверную часть на Node.js и Express, а также базу данных PostgreSQL. Приложение предназначено для просмотра волонтерских мероприятий, подачи заявок на участие, управления мероприятиями, обработки заявок и администрирования пользователей.

## 🎯 Цель проекта

Создание современного и удобного веб-интерфейса для управления волонтерской деятельностью, включая:

* Регистрацию и авторизацию пользователей
* Просмотр доступных волонтерских мероприятий
* Подачу заявок на участие в мероприятиях
* Управление мероприятиями координаторами и администраторами
* Обработку заявок участников
* Администрирование пользователей и ролей
* Отображение статистики участия пользователей

## 👥 Типы пользователей

#### 1. Администратор организации

* Доступ к административной панели
* Просмотр списка пользователей
* Изменение ролей пользователей
* Деактивация аккаунтов пользователей
* Переход на страницы профилей пользователей
* Управление мероприятиями и заявками

#### 2. Координатор волонтеров

* Создание мероприятий
* Редактирование и удаление своих мероприятий
* Просмотр заявок на мероприятия
* Принятие и отклонение заявок участников
* Контроль количества доступных мест на мероприятии

#### 3. Волонтер

* Просмотр доступных мероприятий
* Просмотр подробной информации о мероприятии
* Подача заявки на участие
* Отмена своей заявки
* Просмотр своего профиля и активности

#### 4. Гость

* Просмотр информации о приложении
* Просмотр мероприятий
* Регистрация в системе
* Авторизация в системе

## 🛠 Технологический стек

### Фронтенд

* React.js - основная библиотека интерфейса
* Vite - сборщик клиентского приложения
* React Router DOM - маршрутизация
* CSS - стилизация страниц и компонентов
* Fetch API - HTTP-запросы к серверной части

### Бэкенд

* Node.js - среда выполнения серверной части
* Express - серверный фреймворк
* PostgreSQL - реляционная база данных
* pg - подключение к PostgreSQL
* JWT - аутентификация и авторизация
* bcrypt - хеширование паролей
* cors - настройка доступа к API
* dotenv - работа с переменными окружения

### Инструменты разработки

* Visual Studio Code - текстовый редактор кода
* Git - система контроля версий
* Vitest - тестирование frontend и backend
* Supertest - тестирование серверных API
* Nodemon - запуск backend в режиме разработки
* psql / DBeaver - работа с базой данных
* Nginx - раздача production-сборки frontend и проксирование API
* PM2 / systemd - запуск backend на сервере

## 📁 Структура проекта

```text
volunteer-web/
├── react-volunteer-app/       # React-приложение
│   ├── src/                   # Исходный код frontend
│   ├── tests/                 # Тесты frontend-части проекта
│   ├── index.html             # Точка входа frontend
│   ├── package-lock.json
│   ├── package.json
│   ├── vite.json
│   └── vitest.config.js
│
├── server/                    # Серверная часть Node.js + Express
│   ├── middleware/            # Middleware авторизации и проверки ролей
│   ├── routes/                # API-маршруты
│   ├── utils/                 # Вспомогательные функции
│   ├── db.js                  # Подключение к PostgreSQL
│   ├── index.js               # Точка входа backend
│   ├── package-lock.js
│   └── package.json
│
├── volunteer_org/             # SQL-структура БД и данные
│   ├── volunteer_org.sql      # Создание таблиц, связей и триггеров
│   ├── data_inserts.sql       # Тестовые данные
│   └── diagram.pgerd          # Диаграмма БД
│
├── volunteer-web/             # HTML/CSS-макеты без логики
│   ├── images/                # Изображения в формате png
│   ├── pages/                 # Статические страницы HTML/CSS
│   │   ├── CSS/
│   │   └── HTML/
│   └── SVG                    # Векторные изображения
│
├── volunteerWebDocs/                     # Документация проекта
│   ├── .obsidian/                        # Конфиг редактора md файлов obsidian
│   ├── Diagrams/                         # Диаграммы проекта
│   ├── Выполненные задачи/               # Дневник разработки
│   └── Необходимые данные для проекта/   # Основная документация
│
├── package.json               # Общие команды проекта
├── package-lock.json
└── README.md
```


## 📐 Макеты

Дизайн приложения разработан в Figma. Доступ к макетам:

https://www.figma.com/design/DmOfAy8XxDgmWRsm0bwuCK/VolunteerWeb?node-id=0-1&t=LcB0iv4bNcpMYx2P-1

## Литература
Современный веб-дизайн - Ю.А. Сырых