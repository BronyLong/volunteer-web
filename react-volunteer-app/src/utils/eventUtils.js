export function formatDate(value) {
  if (!value) return "Не указано";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Не указано";

  return date.toLocaleDateString("ru-RU");
}

export function formatTime(value) {
  if (!value) return "Не указано";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Не указано";

  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getCoordinatorName(eventData) {
  const firstName = eventData?.first_name?.trim() || "";
  const lastName = eventData?.last_name?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || "Координатор не указан";
}

export function getDisplayValue(value) {
  return value && String(value).trim() ? value : "Не указан";
}

export function isEventPast(startAt) {
  if (!startAt) return false;

  const eventDate = new Date(startAt);
  if (Number.isNaN(eventDate.getTime())) return false;

  return eventDate.getTime() < Date.now();
}

export function formatDuration(minutes) {
  const numericMinutes = Number(minutes);

  if (!Number.isFinite(numericMinutes) || numericMinutes <= 0) {
    return "Не указано";
  }

  const hours = Math.floor(numericMinutes / 60);
  const restMinutes = numericMinutes % 60;

  if (hours > 0 && restMinutes > 0) {
    return `${hours} ч ${restMinutes} мин`;
  }

  if (hours > 0) {
    return `${hours} ч`;
  }

  return `${restMinutes} мин`;
}
