import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/constants/routes";

type RoleTab = "client" | "agent" | "admin";

interface RoleConfig {
  role: RoleTab;
  label: string;
  labelEn: string;
  email: string;
  icon: string;
  description: string;
  color: string;
}

const ROLE_TABS: RoleConfig[] = [
  {
    role: "client",
    label: "عميل",
    labelEn: "Client",
    email: "client@example.com",
    icon: "🛒",
    description: "إنشاء طلبات شراء ومتابعة عروض الأسعار",
    color: "from-emerald-500 to-teal-600",
  },
  {
    role: "agent",
    label: "وكيل",
    labelEn: "Agent",
    email: "agent@example.com",
    icon: "🤝",
    description: "إدارة التوريد والمستندات وعروض الأسعار",
    color: "from-blue-500 to-indigo-600",
  },
  {
    role: "admin",
    label: "مدير النظام",
    labelEn: "Admin",
    email: "admin@example.com",
    icon: "🛡️",
    description: "إشراف كامل وإدارة النظام والتقارير",
    color: "from-purple-500 to-violet-600",
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<RoleTab | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);

  const handleTabSelect = (tab: RoleTab) => {
    setActiveTab(tab);
    const config = ROLE_TABS.find((t) => t.role === tab);
    if (config) {
      setEmail(config.email);
    }
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">AI-Sourcing Hub</h1>
          <p className="mt-1 text-sm text-gray-500">منصة التوريد الذكية</p>
        </div>

        {/* Role Tabs */}
        <div className="card mb-6 overflow-hidden border-0 p-0 shadow-sm">
          <div className="grid grid-cols-3 border-b border-gray-100">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.role}
                type="button"
                onClick={() => handleTabSelect(tab.role)}
                className={`relative flex flex-col items-center gap-1 px-2 py-4 text-center text-xs font-medium transition-all ${
                  activeTab === tab.role
                    ? "bg-white text-gray-900"
                    : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                }`}
              >
                {activeTab === tab.role && (
                  <span
                    className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${tab.color}`}
                  />
                )}
                <span className="text-xl">{tab.icon}</span>
                <span className="font-semibold">{tab.label}</span>
                <span className="text-[10px] text-gray-400">{tab.labelEn}</span>
              </button>
            ))}
          </div>

          {/* Active Tab Info */}
          {activeTab && (
            <div className={`bg-gradient-to-r ${ROLE_TABS.find((t) => t.role === activeTab)?.color} px-5 py-3`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {ROLE_TABS.find((t) => t.role === activeTab)?.description}
                  </p>
                  <p className="mt-0.5 text-xs text-white/70">
                    🔑 كلمة المرور: password123
                  </p>
                </div>
                <span className="text-2xl">{ROLE_TABS.find((t) => t.role === activeTab)?.icon}</span>
              </div>
            </div>
          )}
        </div>

        {/* Login Card */}
        <div className="card border-0 p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">تسجيل الدخول</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                البريد الإلكتروني
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (activeTab && e.target.value !== ROLE_TABS.find((t) => t.role === activeTab)?.email) {
                    setActiveTab(null);
                  }
                }}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="admin@example.com"
                dir="ltr"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                كلمة المرور
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
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
            <p className="text-sm text-gray-500">
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
    </div>
  );
}
