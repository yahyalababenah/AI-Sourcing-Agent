import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/constants/routes";
import { Zap, ShoppingCart, Handshake, ShieldCheck, Eye, EyeOff } from "lucide-react";

type RoleTab = "client" | "agent" | "admin";

interface RoleConfig {
  role: RoleTab;
  label: string;
  labelEn: string;
  email: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
  dot: string;
}

const ROLE_TABS: RoleConfig[] = [
  {
    role: "client",
    label: "عميل",
    labelEn: "Client",
    email: "client@example.com",
    icon: ShoppingCart,
    description: "إنشاء طلبات شراء ومتابعة عروض الأسعار",
    color: "ring-emerald-500 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  {
    role: "agent",
    label: "وكيل",
    labelEn: "Agent",
    email: "agent@example.com",
    icon: Handshake,
    description: "إدارة التوريد والمستندات وعروض الأسعار",
    color: "ring-sky-500 bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
  },
  {
    role: "admin",
    label: "مدير النظام",
    labelEn: "Admin",
    email: "admin@example.com",
    icon: ShieldCheck,
    description: "إشراف كامل وإدارة النظام والتقارير",
    color: "ring-violet-500 bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<RoleTab | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleTabSelect = (tab: RoleTab) => {
    setActiveTab(tab);
    const config = ROLE_TABS.find((t) => t.role === tab);
    if (config) setEmail(config.email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ email, password });
    } catch {
      // Error handled by useAuth toast
    } finally {
      setLoading(false);
    }
  };

  const activeConfig = ROLE_TABS.find((t) => t.role === activeTab);

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      {/* Left brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between bg-[#0f172a] p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
            <Zap className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-base font-semibold text-white tracking-tight">AI-Sourcing Hub</span>
        </div>

        <div>
          <p className="text-3xl font-bold text-white leading-snug tracking-tight">
            منصة الاستيراد
            <br />
            <span className="text-emerald-400">الأذكى في المنطقة</span>
          </p>
          <p className="mt-4 text-sm text-slate-400 leading-relaxed">
            ربط المستوردين بالموردين العالميين مع تسعير شفاف
            وتتبع مباشر لكل شحنة.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { label: "عروض أسعار فورية", sub: "مقارنة أسعار الموردين في لحظات" },
              { label: "تتبع الشحنات",      sub: "من المصنع إلى ميناء العقبة مباشرة" },
              { label: "مستندات ذكية",      sub: "OCR تلقائي وتحليل بالذكاء الاصطناعي" },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-slate-200">{f.label}</p>
                  <p className="text-xs text-slate-500">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-600">
          © 2026 AI-Sourcing Hub · جميع الحقوق محفوظة
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold text-slate-900">AI-Sourcing Hub</span>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">تسجيل الدخول</h1>
          <p className="mt-1.5 text-sm text-slate-500">اختر نوع حسابك للمتابعة</p>

          {/* Role selector */}
          <div className="mt-6 grid grid-cols-3 gap-2">
            {ROLE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.role;
              return (
                <button
                  key={tab.role}
                  type="button"
                  onClick={() => handleTabSelect(tab.role)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center text-xs font-medium transition-all ${
                    isActive
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                  <span className={isActive ? "text-emerald-800" : ""}>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeConfig && (
            <div className="mt-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">{activeConfig.description}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                بريد الاختبار: <span className="font-mono text-slate-600">{activeConfig.email}</span>
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
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
                dir="ltr"
                placeholder="you@example.com"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  dir="ltr"
                  placeholder="••••••••"
                  className="input pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 end-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>جاري الدخول...</span>
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            ليس لديك حساب؟{" "}
            <Link to={ROUTES.AUTH.REGISTER} className="font-medium text-emerald-600 hover:text-emerald-700">
              إنشاء حساب
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
