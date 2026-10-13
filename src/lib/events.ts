/** Notify the app that local rows were written (AppProvider listens and triggers a sync). */
export function notifySaved() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("oa:saved"));
}
