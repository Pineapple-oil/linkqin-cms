import type { AuthUser } from "@linkqin/shared";

const TOKEN_KEY = "linkqin_access_token";

type Listener = () => void;

let accessToken: string | null = localStorage.getItem(TOKEN_KEY);
let currentUser: AuthUser | null = null;
const listeners = new Set<Listener>();

export const authStore = {
  getAccessToken: () => accessToken,
  setAccessToken(token: string | null) {
    accessToken = token;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    notify();
  },
  getUser: () => currentUser,
  setUser(user: AuthUser | null) {
    currentUser = user;
    notify();
  },
  clear() {
    accessToken = null;
    currentUser = null;
    localStorage.removeItem(TOKEN_KEY);
    notify();
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

function notify(): void {
  for (const listener of listeners) listener();
}
