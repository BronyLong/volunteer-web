const API_URL = "/api";

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");

  const {
    headers: customHeaders = {},
    method,
    ...restOptions
  } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...restOptions,
    method,
    cache: method === "GET" || !method ? "no-store" : "default",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...customHeaders,
    },
  });

  const contentType = response.headers.get("content-type") || "";

  let data = null;
  let text = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    text = await response.text();
  }

  if (!response.ok) {
    throw new Error(data?.message || text || "Ошибка запроса");
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


export async function confirmRegistration(token) {
  return apiFetch("/auth/confirm-registration", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function requestPasswordReset(email) {
  return apiFetch("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(payload) {
  return apiFetch("/auth/reset-password", {
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

export async function acceptApplication(id) {
  return apiFetch(`/applications/${id}/accept`, {
    method: "PATCH",
  });
}

export async function rejectApplication(id) {
  return apiFetch(`/applications/${id}/reject`, {
    method: "PATCH",
  });
}

export async function confirmApplicationParticipation(id) {
  return apiFetch(`/applications/${id}/confirm-participation`, {
    method: "PATCH",
  });
}

export async function cancelApplicationParticipation(id) {
  return apiFetch(`/applications/${id}/cancel-participation`, {
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

export async function getAdminUsers() {
  return apiFetch("/admin/users");
}

export async function updateAdminUserRole(id, role) {
  return apiFetch(`/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function updateAdminUserActive(id, isActive) {
  return apiFetch(`/admin/users/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}

export async function deleteAdminUserProfile(id) {
  return apiFetch(`/admin/users/${id}/profile`, {
    method: "DELETE",
  });
}

export async function getAdminEvents() {
  return apiFetch("/admin/events");
}

export async function updateAdminEventCoordinator(id, coordinatorId) {
  return apiFetch(`/admin/events/${id}/coordinator`, {
    method: "PATCH",
    body: JSON.stringify({ coordinator_id: coordinatorId }),
  });
}

export async function getAdminLogs(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return apiFetch(`/admin/logs${query ? `?${query}` : ""}`);
}

export async function getNotifications() {
  return apiFetch("/notifications");
}

export async function getUnreadNotificationsCount() {
  return apiFetch("/notifications/unread-count");
}

export async function markNotificationAsRead(id) {
  return apiFetch(`/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsAsRead() {
  return apiFetch("/notifications/read-all", {
    method: "PATCH",
  });
}

export async function getNotificationSettings() {
  return apiFetch("/notifications/settings");
}

export async function updateNotificationSettings(payload) {
  return apiFetch("/notifications/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getCoordinatorNotificationVolunteers() {
  return apiFetch("/notifications/coordinator-volunteers");
}
