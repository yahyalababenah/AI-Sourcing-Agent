import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/constants/routes";

const DEMO_ACCOUNTS = [
  {
    role: "client" as const,
    label: "عميل",
    email: "client@example.com",
    icon: "🛒",
    description: "إنشاء طلبات عرض سعر ومتابعتها",
  },
  {
    role: "agent" as const,
    label: "وكيل",
    email: "agent@example.com",
    icon: "🤝",
    description: "إدارة الطلبات والمستندات وعروض الأسعار",
  },
  {
    role: "admin" as const,
    label: "مدير النظام",
    email: "admin@example.com",
    icon: "🛡️",
    description: "إشراف كامل على النظام والتقارير",
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleRoleSelect = (demoEmail: string, role: string) => {
    setEmail(demoEmail);
    setSelectedRole(role);
  };

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary-700">
            AI-Sourcing Hub
          </h1>
          <p className="mt-2 text-gray-600">منصة التوريد الذكية</p>
        </div>

        {/* Demo Account Selector */}
        <div className="card mb-6 p-5">
          <h3 className="mb-3 text-center text-sm font-semibold text-gray-700">
            اختر حساب تجريبي
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.role}
                type="button"
                onClick={() => handleRoleSelect(account.email, account.role)}
                className={`flex flex-col items-center rounded-xl border-2 p-3 text-center transition-all ${
                  selectedRole === account.role
                    ? "border-primary-500 bg-primary-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-primary-300 hover:bg-gray-50"
                }`}
              >
                <span className="text-2xl">{account.icon}</span>
                <span className="mt-1 text-sm font-bold text-gray-900">
                  {account.label}
                </span>
                <span className="mt-0.5 text-[10px] leading-tight text-gray-500">
                  {account.description}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-gray-400">
            🔑 كلمة المرور لجميع الحسابات: password123
          </p>
        </div>

        {/* Login Card */}
        <div className="card p-8">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            تسجيل الدخول
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSelectedRole(null);
                }}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="admin@example.com"
                dir="ltr"
              />
            </div>

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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "جاري التحميل..." : "تسجيل الدخول"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            ليس لديك حساب؟{" "}
            <Link
              to={ROUTES.AUTH.REGISTER}
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              إنشاء حساب
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
