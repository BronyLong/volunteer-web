const API_URL = "http://localhost:5000/api";

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}${path}`, {
    cache: options.method === "GET" || !options.method ? "no-store" : "default",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new Error(data?.message || "Ошибка запроса");
  }

  return data;
}

export async function loginUser(payload) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registerUser(payload) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMyProfile() {
  return apiFetch("/profile/me");
}

export async function getProfileById(id) {
  return apiFetch(`/profile/${id}`);
}

export async function updateMyProfile(payload) {
  return apiFetch("/profile/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getCategories() {
  return apiFetch("/categories");
}

export async function getEventById(id) {
  return apiFetch(`/events/${id}`);
}

export async function createEvent(payload) {
  return apiFetch("/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEvent(id, payload) {
  return apiFetch(`/events/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteEvent(id) {
  return apiFetch(`/events/${id}`, {
    method: "DELETE",
  });
}

export async function deleteApplication(id) {
  return apiFetch(`/applications/${id}`, {
    method: "DELETE",
  });
}

export async function rejectApplication(id) {
  return apiFetch(`/applications/${id}/reject`, {
    method: "PATCH",
  });
}

export async function restoreApplication(id) {
  return apiFetch(`/applications/${id}/restore`, {
    method: "PATCH",
  });
}

export function saveToken(token) {
  localStorage.setItem("token", token);
}

export function getToken() {
  return localStorage.getItem("token");
}

export function removeToken() {
  localStorage.removeItem("token");
}

export function getUserIdFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.id;
  } catch {
    return null;
  }
}

export function getUserFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}