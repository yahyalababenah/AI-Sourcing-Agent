import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { authService } from "@/services/authService";
import type { UserLogin, UserCreate } from "@/types/auth";
import { ROUTES } from "@/constants/routes";
import toast from "react-hot-toast";

/**
 * Custom hook wrapping auth operations.
 * Provides login, register, logout, and fetchMe with integrated toast notifications.
 */
export function useAuth() {
  const navigate = useNavigate();
  const { setAuth, logout: clearAuth, setUser, user, isAuthenticated, role } = useAuthStore();

  const login = useCallback(
    async (data: UserLogin) => {
      try {
        const tokens = await authService.login(data);
        // Step 1: Persist tokens so getMe() can authenticate
        useAuthStore.getState().setAuth(
          { id: "", email: "", full_name: "", role: "agent", phone: null, is_active: true, created_at: "" } as any,
          tokens.access_token,
          tokens.refresh_token,
        );
        // Step 2: Fetch the actual user profile
        const me = await authService.getMe();
        // Step 3: Overwrite with the real user object
        useAuthStore.getState().setAuth(me, tokens.access_token, tokens.refresh_token);
        toast.success("تم تسجيل الدخول بنجاح"); // Login successful
        navigate(ROUTES.DASHBOARD);
      } catch (error: any) {
        const message =
          error?.response?.data?.detail || "فشل تسجيل الدخول"; // Login failed
        toast.error(message);
        throw error;
      }
    },
    [navigate]
  );

  const register = useCallback(
    async (data: UserCreate) => {
      try {
        const user = await authService.register(data);
        toast.success("تم إنشاء الحساب بنجاح"); // Account created
        navigate(ROUTES.AUTH.LOGIN);
        return user;
      } catch (error: any) {
        const message =
          error?.response?.data?.detail || "فشل إنشاء الحساب"; // Registration failed
        toast.error(message);
        throw error;
      }
    },
    [navigate]
  );

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // Even if logout API fails, clear local state
    } finally {
      clearAuth();
      toast.success("تم تسجيل الخروج"); // Logged out
      navigate(ROUTES.AUTH.LOGIN);
    }
  }, [navigate, clearAuth]);

  const fetchMe = useCallback(async () => {
    try {
      const me = await authService.getMe();
      setUser(me);
      return me;
    } catch {
      clearAuth();
      return null;
    }
  }, [setUser, clearAuth]);

  return {
    user,
    isAuthenticated,
    role,
    login,
    register,
    logout,
    fetchMe,
  };
}
