/*
  Reads the front-end-only demo session that app/signin/page.tsx writes to
  localStorage ("user" + "isLoggedIn" — there's no real auth backend here by
  design, see CLAUDE.md). Kept as the one shared place that knows this storage
  shape, so any screen that needs "who's signed in" (e.g. attributing an import
  in Import History) reads it the same way instead of re-parsing localStorage.
*/

export interface CurrentUser {
  username: string;
  name: string;
}

export function getCurrentUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    if (window.localStorage.getItem("isLoggedIn") !== "true") return null;
    const raw = window.localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.username || !parsed?.name) return null;
    return { username: String(parsed.username), name: String(parsed.name) };
  } catch {
    return null;
  }
}
