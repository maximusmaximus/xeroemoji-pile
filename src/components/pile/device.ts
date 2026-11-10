const PHONE_LIVE_LIMIT = 160;

export function onPhone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches &&
    Math.min(window.screen.width, window.screen.height) < 820
  );
}

export function liveLimit() {
  return onPhone() ? PHONE_LIVE_LIMIT : 280;
}
