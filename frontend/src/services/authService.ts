import { api } from "@/lib/api";
import type { User, UserCreate, UserLogin, TokenResponse } from "@/types/auth";
import { API } from "@/constants/api";

export const authService = {
  /** Register a new user. */
  register: (data: UserCreate) =>
    api.post<User>(API.AUTH.REGISTER, data).then((r) => r.data),

  /** Login and receive JWT tokens. */
  login: (data: UserLogin) =>
    api.post<TokenResponse>(API.AUTH.LOGIN, data).then((r) => r.data),

  /** Refresh the access token. */
  refresh: (refreshToken: string) =>
    api
      .post<TokenResponse>(API.AUTH.REFRESH, { refresh_token: refreshToken })
      .then((r) => r.data),

  /** Get the currently authenticated user's profile. */
  getMe: () => api.get<User>(API.AUTH.ME).then((r) => r.data),

  /** Logout (blacklist refresh token). */
  logout: (refreshToken: string) =>
    api.post(API.AUTH.LOGOUT, { refresh_token: refreshToken }),
};
