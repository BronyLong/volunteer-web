import { Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import EventsPage from "./pages/EventsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import NotFoundPage from "./pages/NotFoundPage";
import HelpPage from "./pages/HelpPage";
import EventOpenPage from "./pages/EventOpenPage";
import ProfileSettings from "./pages/ProfileSettings";
import EventEditPage from "./pages/EventEditPage";
import EventCreatePage from "./pages/EventCreatePage";
import ScrollToTop from "./components/ScrollToTop";

import "./styles/reset.css";
import "./styles/variables.css";
import "./styles/global.css";

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/profiles/:id" element={<ProfilePage />} />
        <Route path="/profiles/:id/settings" element={<ProfileSettings />} />

        <Route path="/help" element={<HelpPage />} />
        <Route path="/create" element={<EventCreatePage />} />
        <Route path="/events/:id" element={<EventOpenPage />} />
        <Route path="/events/:id/edit" element={<EventEditPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}