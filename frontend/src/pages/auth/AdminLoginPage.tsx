import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/constants/routes";

/**
 * Admin Portal Login Page — dedicated login for system administrators.
 *
 * Served at `/admin/login` with a distinct visual identity:
 * - Dark purple/violet gradient theme for admin distinction
 * - Pre-filled admin demo credentials
 * - Link back to the main login page for non-admin users
 */
export function AdminLoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ email, password });
    } catch {
      // Error toast is handled by useAuth
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-purple-950 to-gray-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/20">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">لوحة الإدارة</h1>
          <p className="mt-1 text-sm text-purple-300">Admin Control Panel</p>
        </div>

        {/* Info Banner */}
        <div className="mb-6 rounded-lg border border-purple-700/30 bg-purple-900/30 px-5 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-800/50 text-sm">
              🛡️
            </span>
            <div>
              <p className="text-sm font-medium text-purple-200">
                بوابة المديرين — صلاحيات كاملة وإشراف على النظام
              </p>
              <p className="mt-0.5 text-xs text-purple-400">
                🔑 بيانات الدخول التجريبية معبّأة مسبقاً
              </p>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-xl border border-purple-700/20 bg-white/5 p-8 shadow-xl backdrop-blur-sm">
          <h2 className="mb-6 text-xl font-semibold text-white">تسجيل الدخول</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="mb-1.5 block text-sm font-medium text-purple-200">
                البريد الإلكتروني
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-purple-700/30 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-purple-300/50 transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                placeholder="admin@example.com"
                dir="ltr"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-purple-200">
                كلمة المرور
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-purple-700/30 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-purple-300/50 transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-600/20 transition-all hover:from-purple-700 hover:to-violet-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري التحميل...
                </span>
              ) : (
                "تسجيل الدخول"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-purple-300">
              <Link
                to={ROUTES.AUTH.LOGIN}
                className="font-medium text-purple-400 underline-offset-2 hover:text-purple-300 hover:underline"
              >
                العودة إلى بوابة المستخدمين
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-purple-500">
          AI-Sourcing Hub &copy; {new Date().getFullYear()} — منصة التوريد الذكية
        </p>
      </div>
    </div>
  );
}
