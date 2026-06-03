import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

/**
 * Axios instance configured for the AI-Sourcing Hub API.
 * Includes JWT interceptor for automatic token refresh.
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: "application/json",
  },
  timeout: 30_000,
});

// ---------------------------------------------------------------------------
// Request interceptor — attach access token to every request
// ---------------------------------------------------------------------------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — catch 401, attempt token refresh, retry
// ---------------------------------------------------------------------------
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt refresh on 401 and if we haven't already retried
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      // No refresh token — force logout
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/auth/login";
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${API_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const newAccessToken = data.access_token;
      localStorage.setItem("access_token", newAccessToken);

      processQueue(null, newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/auth/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
