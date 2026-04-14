export const INITIAL_PROFILE_FIELD_ERRORS = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  social_vk: "",
  social_ok: "",
  social_max: "",
};

export function getRoleLabel(role) {
  switch (role) {
    case "admin":
      return "Администратор";
    case "coordinator":
      return "Координатор";
    case "volunteer":
      return "Волонтер";
    default:
      return "Пользователь";
  }
}

export function mapProfileToForm(profile) {
  return {
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    city: profile?.city || "",
    bio: profile?.bio || "",
    social_vk: profile?.social_vk || "",
    social_ok: profile?.social_ok || "",
    social_max: profile?.social_max || "",
  };
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function formatRussianPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  let normalized = digits;

  if (normalized.startsWith("8")) {
    normalized = `7${normalized.slice(1)}`;
  }

  if (!normalized.startsWith("7")) {
    normalized = `7${normalized}`;
  }

  normalized = normalized.slice(0, 11);

  const country = normalized[0];
  const part1 = normalized.slice(1, 4);
  const part2 = normalized.slice(4, 7);
  const part3 = normalized.slice(7, 9);
  const part4 = normalized.slice(9, 11);

  let result = `+${country}`;

  if (part1) result += ` (${part1}`;
  if (part1.length === 3) result += `)`;
  if (part2) result += ` ${part2}`;
  if (part3) result += `-${part3}`;
  if (part4) result += `-${part4}`;

  return result;
}

export function validateRussianPhone(value) {
  if (!value) return true;
  return /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(value);
}

export function validateVkLink(value) {
  if (!value) return true;
  return /^(https?:\/\/)?(www\.)?(vk\.com|vkontakte\.ru)\/[A-Za-z0-9_.-]+\/?$/i.test(
    value
  );
}

export function validateOkLink(value) {
  if (!value) return true;
  return /^(https?:\/\/)?(www\.)?(ok\.ru|odnoklassniki\.ru)\/[A-Za-z0-9_.\/-]+\/?$/i.test(
    value
  );
}

export function validateMaxLink(value) {
  if (!value) return true;
  return /^(https?:\/\/)?(www\.)?max\.ru\/[A-Za-z0-9_.\/-]+\/?$/i.test(value);
}

export function getFieldClassName(hasError) {
  return hasError
    ? "form-field__input form-field__input--error"
    : "form-field__input";
}

export function buildValidationErrors(formData) {
  const errors = { ...INITIAL_PROFILE_FIELD_ERRORS };

  const firstName = formData.first_name.trim();
  const lastName = formData.last_name.trim();
  const email = normalizeEmail(formData.email);
  const phone = formData.phone.trim();
  const socialVk = formData.social_vk.trim();
  const socialOk = formData.social_ok.trim();
  const socialMax = formData.social_max.trim();

  if (!firstName) {
    errors.first_name = "Введите имя";
  }

  if (!lastName) {
    errors.last_name = "Введите фамилию";
  }

  if (!email) {
    errors.email = "Введите email";
  } else if (!validateEmail(email)) {
    errors.email = "Введите корректный email, например example@mail.com";
  }

  if (phone && !validateRussianPhone(phone)) {
    errors.phone = "Введите телефон в формате +7 (900) 000-00-00";
  }

  if (socialVk && !validateVkLink(socialVk)) {
    errors.social_vk = "Укажите корректную ссылку VK";
  }

  if (socialOk && !validateOkLink(socialOk)) {
    errors.social_ok = "Укажите корректную ссылку Одноклассников";
  }

  if (socialMax && !validateMaxLink(socialMax)) {
    errors.social_max = "Укажите корректную ссылку MAX";
  }

  return errors;
}

export function hasValidationErrors(errors) {
  return Object.values(errors).some(Boolean);
}