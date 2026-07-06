import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/constants/routes";

type RoleTab = "client" | "agent";

interface RoleConfig {
  role: RoleTab;
  label: string;
  labelEn: string;
  icon: string;
  description: string;
  color: string;
}

const ROLE_TABS: RoleConfig[] = [
  {
    role: "client",
    label: "مستورد",
    labelEn: "Importer",
    icon: "🛒",
    description: "أريد شراء المنتجات من الصين",
    color: "from-importer-500 to-importer-600",
  },
  {
    role: "agent",
    label: "مورد",
    labelEn: "Supplier",
    icon: "🤝",
    description: "أريد تقديم خدمات التوريد",
    color: "from-supplier-500 to-supplier-600",
  },
];

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<RoleTab>("agent");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [factoryName, setFactoryName] = useState("");
  const [locationInChina, setLocationInChina] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("يرجى إدخال الاسم الكامل");
      return;
    }
    if (!email.trim()) {
      setError("يرجى إدخال البريد الإلكتروني");
      return;
    }
    if (password.length < 8) {
      setError("كلمة المرور يجب أن تتكون من 8 أحرف على الأقل");
      return;
    }
    if (password !== confirmPassword) {
      setError("كلمة المرور وتأكيدها غير متطابقين");
      return;
    }
    if (activeTab === "client" && !companyName.trim()) {
      setError("يرجى إدخال اسم الشركة");
      return;
    }
    if (activeTab === "agent" && !factoryName.trim()) {
      setError("يرجى إدخال اسم المصنع");
      return;
    }
    if (activeTab === "agent" && !locationInChina.trim()) {
      setError("يرجى إدخال موقع المصنع في الصين");
      return;
    }

    setLoading(true);
    try {
      await register({
        email,
        password,
        full_name: fullName,
        phone: phone || undefined,
        role: activeTab,
        ...(activeTab === "client"
          ? { company_name: companyName }
          : { factory_name: factoryName, location_in_china: locationInChina }),
      });
      navigate(ROUTES.DASHBOARD);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "فشل إنشاء الحساب";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">AI-Sourcing Hub</h1>
          <p className="mt-1 text-sm text-gray-500">إنشاء حساب جديد</p>
        </div>

        {/* Role Tabs */}
        <div className="card mb-6 overflow-hidden border-0 p-0 shadow-sm">
          <div className="grid grid-cols-2 border-b border-gray-100">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.role}
                type="button"
                onClick={() => setActiveTab(tab.role)}
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
          <div className={`bg-gradient-to-r ${ROLE_TABS.find((t) => t.role === activeTab)?.color} px-5 py-3`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {ROLE_TABS.find((t) => t.role === activeTab)?.description}
                </p>
              </div>
              <span className="text-2xl">{ROLE_TABS.find((t) => t.role === activeTab)?.icon}</span>
            </div>
          </div>
        </div>

        {/* Register Card */}
        <div className="card border-0 p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">إنشاء حساب</h2>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* noValidate: this form has its own Arabic-language validation
              messages in handleSubmit — native browser constraint validation
              (triggered by the `required` attributes below) would otherwise
              intercept the submit event first and show a generic, non-Arabic
              validation bubble instead, silently preventing our messages from
              ever being seen. */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-gray-700">
                الاسم الكامل
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="أحمد محمد"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                البريد الإلكتروني
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="ahmed@example.com"
                dir="ltr"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-gray-700">
                رقم الهاتف <span className="text-gray-400">(اختياري)</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="+962 7 1234 5678"
                dir="ltr"
              />
            </div>

            {activeTab === "client" && (
              <div>
                <label htmlFor="companyName" className="mb-1.5 block text-sm font-medium text-gray-700">
                  اسم الشركة
                </label>
                <input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="شركة الاستيراد المتحدة"
                />
              </div>
            )}

            {activeTab === "agent" && (
              <>
                <div>
                  <label htmlFor="factoryName" className="mb-1.5 block text-sm font-medium text-gray-700">
                    اسم المصنع
                  </label>
                  <input
                    id="factoryName"
                    type="text"
                    value={factoryName}
                    onChange={(e) => setFactoryName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    placeholder="Future Factory Ltd"
                  />
                </div>

                <div>
                  <label htmlFor="locationInChina" className="mb-1.5 block text-sm font-medium text-gray-700">
                    موقع المصنع في الصين
                  </label>
                  <input
                    id="locationInChina"
                    type="text"
                    value={locationInChina}
                    onChange={(e) => setLocationInChina(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    placeholder="Guangzhou, Guangdong"
                  />
                </div>
              </>
            )}

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

            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-gray-700">
                تأكيد كلمة المرور
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !fullName || !password}
              className="w-full rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري إنشاء الحساب...
                </span>
              ) : (
                "إنشاء حساب"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
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
    </div>
  );
}
