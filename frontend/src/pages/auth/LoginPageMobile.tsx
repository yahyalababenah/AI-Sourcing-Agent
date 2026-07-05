import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { AppLogo } from "@/components/AppLogo";
import { ROLE_TABS, SUBMIT_BUTTON_CLASSES, useLoginForm } from "./useLoginForm";

const VALUE_PROPS = [
  { title: "0.82% دقة", sub: "تقدير التكلفة" },
  { title: "48 ساعة", sub: "نافذة عطاء حصرية" },
  { title: "240+ مورّد", sub: "صيني مُعتمَد" },
];

// Mobile-only layout — CLAUDE.md's mandatory two-file screen pattern.
// The desktop brand panel collapses into a compact strip above the form
// (logo + tagline + 3 horizontally-scrollable value cards).
// See LoginPageDesktop.tsx for the two-column desktop counterpart.
export function LoginPageMobile() {
  const {
    activeRole, handleRoleSelect, email, setEmail, password, setPassword,
    loading, showPw, setShowPw, handleSubmit,
  } = useLoginForm();

  return (
    <div className="min-h-screen bg-white" dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      {/* ── Compact trust strip ── */}
      <div className="bg-brand-900 px-5 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-3">
          <AppLogo size={32} />
          <div>
            <div className="text-base font-extrabold text-white">مركز التوريد الذكي</div>
            <div className="text-[8px] text-white/45 tracking-widest" dir="ltr">AI SOURCING HUB</div>
          </div>
        </div>
        <p className="text-[12px] text-white/65 leading-relaxed mb-3">
          التوريد الذكي بدقة الذكاء الاصطناعي
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {VALUE_PROPS.map((vp) => (
            <div
              key={vp.title}
              className="shrink-0 px-3 py-2 rounded-lg min-w-[110px]"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              <div className="text-[12px] font-bold text-white">{vp.title}</div>
              <div className="text-[10px] text-white/50">{vp.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form ── */}
      <div className="px-5 py-6">
        <h2 className="text-[18px] font-bold text-[#1a2433] mb-1">مرحباً بعودتك</h2>
        <p className="text-[13px] text-[#6b7a8d] mb-5">سجّل دخولك لإدارة عمليات التوريد</p>

        <div className="flex rounded-md p-[3px] gap-0.5 mb-5" style={{ background: "#f0f2f5" }}>
          {ROLE_TABS.map(({ role, label }) => (
            <button
              key={role}
              type="button"
              onClick={() => handleRoleSelect(role)}
              className="flex-1 py-2 text-[12px] font-medium rounded transition-all duration-150 active:scale-[0.98]"
              style={
                activeRole === role
                  ? { background: "#fff", color: "#059669", fontWeight: 700, boxShadow: "0 1px 2px rgba(0,0,0,0.07)" }
                  : { background: "transparent", color: "#8a9aaa" }
              }
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#3a4a5a] mb-1.5">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              placeholder="ahmed@alnowar.jo"
              className="w-full px-3 py-2.5 text-[13px] text-[#1a2433] border border-[#dde2ea] rounded-md outline-none transition-colors focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/20"
              style={{ background: "#f7f9fc" }}
            />
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <a href="#" className="text-[12px] text-[#059669] font-medium">نسيت كلمة المرور؟</a>
              <label className="text-[12px] font-semibold text-[#3a4a5a]">كلمة المرور</label>
            </div>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
                placeholder="••••••••"
                className="w-full px-3 py-2.5 text-[13px] text-[#1a2433] border border-[#dde2ea] rounded-md outline-none transition-colors focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/20 pe-10"
                style={{ background: "#f7f9fc", letterSpacing: "0.1em" }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-[#8a9aaa] hover:text-[#3a4a5a] transition-colors duration-150"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 text-[14px] font-bold text-white rounded-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-60 ${SUBMIT_BUTTON_CLASSES[activeRole]}`}
          >
            {loading ? "جاري الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <p className="mt-5 text-center text-[12px] text-[#8a9aaa]">
          ليس لديك حساب؟{" "}
          <Link to={ROUTES.AUTH.REGISTER} className="font-semibold text-[#059669]">
            إنشاء حساب جديد
          </Link>
        </p>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L10 3V6C10 8.5 8 10.5 6 11C4 10.5 2 8.5 2 6V3L6 1Z" stroke="#8a9aaa" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <span className="text-[11px] text-[#8a9aaa]">اتصال مشفّر · SSL/TLS</span>
        </div>
      </div>
    </div>
  );
}
