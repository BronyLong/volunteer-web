import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import HelpPage from './pages/HelpPage';
import EventOpenPage from './pages/EventOpenPage';
import ProfileSettings from './pages/ProfileSettings';

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
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<ProfileSettings />} />
        <Route path='/help' element={<HelpPage />} />
        <Route path='/events/1' element={<EventOpenPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
