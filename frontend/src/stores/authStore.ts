import { create } from "zustand";
import type { User, UserRole } from "@/types/auth";
import { getAccessToken, setAccessToken, setRefreshToken, clearTokens } from "@/lib/auth";
import { getDevUser } from "@/lib/devAuth";

// Dev-only: a fake user seeded from .env.local so role-protected pages are
// reachable without a backend. Always null in production builds (lib/devAuth.ts).
const devUser = getDevUser();

interface AuthState {
  /** The currently authenticated user, or null. */
  user: User | null;
  /** Access token string, or null. */
  accessToken: string | null;
  /** Whether the user is authenticated. */
  isAuthenticated: boolean;
  /** The user's role. */
  role: UserRole | null;

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
  user: devUser,
  accessToken: getAccessToken(),
  isAuthenticated: !!devUser || !!getAccessToken(),
  role: devUser?.role ?? null,

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
