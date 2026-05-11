import manAvatar from "../assets/images/avatar_man.png";
import womanAvatar from "../assets/images/avatar_woman.png";

export function getDefaultAvatarByGender(gender) {
  return gender === "female" ? womanAvatar : manAvatar;
}

export function getProfileAvatar(profile) {
  return profile?.avatar_url || getDefaultAvatarByGender(profile?.gender);
}
