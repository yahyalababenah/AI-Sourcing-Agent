import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/constants/routes";
import type { UserCreate } from "@/types/auth";

export function RegisterPage() {
  const { register } = useAuth();
  const [formData, setFormData] = useState<UserCreate>({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    role: "agent",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof UserCreate, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين"); // Passwords do not match
      return;
    }

    setLoading(true);
    try {
      await register(formData);
    } catch {
      // Error toast is handled by useAuth
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary-700">
            AI-Sourcing Hub
          </h1>
          <p className="mt-2 text-gray-600">منصة التوريد الذكية</p>
        </div>

        {/* Register Card */}
        <div className="card p-8">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            إنشاء حساب جديد
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label
                htmlFor="full_name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                الاسم الكامل
              </label>
              <input
                id="full_name"
                type="text"
                value={formData.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="أحمد محمد"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                البريد الإلكتروني
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="ahmed@example.com"
                dir="ltr"
              />
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                رقم الهاتف
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone || ""}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="+966 5X XXX XXXX"
                dir="ltr"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                كلمة المرور
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                تأكيد كلمة المرور
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            {/* Role Selection */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                نوع الحساب
              </label>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm transition-colors hover:border-primary-400 has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                  <input
                    type="radio"
                    name="role"
                    value="agent"
                    checked={formData.role === "agent"}
                    onChange={(e) =>
                      handleChange("role", e.target.value as "agent" | "admin")
                    }
                    className="text-primary-600"
                  />
                  وكيل
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm transition-colors hover:border-primary-400 has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={formData.role === "admin"}
                    onChange={(e) =>
                      handleChange("role", e.target.value as "agent" | "admin")
                    }
                    className="text-primary-600"
                  />
                  مدير
                </label>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "جاري التحميل..." : "إنشاء حساب"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            لديك حساب بالفعل؟{" "}
            <Link
              to={ROUTES.AUTH.LOGIN}
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
