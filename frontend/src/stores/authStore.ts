import { create } from "zustand";
import type { User } from "@/types/auth";
import { getAccessToken, setAccessToken, setRefreshToken, clearTokens } from "@/lib/auth";

interface AuthState {
  /** The currently authenticated user, or null. */
  user: User | null;
  /** Access token string, or null. */
  accessToken: string | null;
  /** Whether the user is authenticated. */
  isAuthenticated: boolean;
  /** The user's role. */
  role: "agent" | "admin" | null;

  /** Set the authenticated user and tokens. */
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  /** Update the access token after a refresh. */
  setAccessToken: (token: string) => void;
  /** Clear all auth state (logout). */
  logout: () => void;
  /** Set user info without tokens (e.g., after page load). */
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: getAccessToken(),
  isAuthenticated: !!getAccessToken(),
  role: null,

  setAuth: (user, accessToken, refreshToken) => {
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    set({
      user,
      accessToken,
      isAuthenticated: true,
      role: user.role,
    });
  },

  setAccessToken: (token) => {
    setAccessToken(token);
    set({ accessToken: token });
  },

  logout: () => {
    clearTokens();
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      role: null,
    });
  },

  setUser: (user) => {
    set({ user, role: user.role });
  },
}));
