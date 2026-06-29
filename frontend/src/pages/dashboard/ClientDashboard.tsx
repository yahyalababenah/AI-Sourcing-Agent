import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { ROUTES } from "@/constants/routes";
import {
  ClipboardList, Package, Upload, FileText, Search,
  ShoppingBag, TrendingUp, CheckCircle, Clock, ArrowLeft,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  open:        "bg-sky-50 text-sky-700 ring-1 ring-sky-200/60",
  processing:  "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
  quoted:      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  closed:      "bg-slate-100 text-slate-600",
  cancelled:   "bg-red-50 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  open:       "قيد المراجعة",
  processing: "قيد المعالجة",
  quoted:     "تم التسعير",
  closed:     "مغلق",
  cancelled:  "ملغي",
};

const QUOTE_STATUS_COLORS: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-600",
  sent:      "bg-sky-50 text-sky-700 ring-1 ring-sky-200/60",
  finalized: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  accepted:  "bg-emerald-100 text-emerald-800",
  rejected:  "bg-red-50 text-red-600",
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft:     "مسودة",
  sent:      "مرسل",
  finalized: "نهائي",
  accepted:  "مقبول",
  rejected:  "مرفوض",
};

export function ClientDashboard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [productName, setProductName]         = useState("");
  const [description, setDescription]         = useState("");
  const [quantity, setQuantity]               = useState<number>(1);
  const [destinationPort, setDestinationPort] = useState("");
  const [selectedFile, setSelectedFile]       = useState<File | null>(null);
  const fileInputRef                           = useRef<HTMLInputElement>(null);
  const [formError, setFormError]             = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      intakeService.create({
        client_name: user?.full_name || "",
        client_request_arabic:
          `المنتج: ${productName}\nالوصف: ${description}\nالكمية: ${quantity}${destinationPort ? `\nميناء الوصول: ${destinationPort}` : ""}`,
        destination_port: destinationPort || undefined,
        target_currency: "JOD",
      }),
    onSuccess: () => {
      setProductName(""); setDescription(""); setQuantity(1);
      setDestinationPort(""); setSelectedFile(null); setFormError(null);
      rfqQuery.refetch();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!productName.trim()) return setFormError("يرجى إدخال اسم المنتج");
    if (!description.trim()) return setFormError("يرجى إدخال الوصف");
    if (quantity < 1)        return setFormError("يرجى إدخال كمية صالحة");
    createMutation.mutate();
  };

  const rfqQuery = useQuery({
    queryKey: ["my-rfqs"],
    queryFn:  () => intakeService.list({ limit: 50 }),
    staleTime: 15_000,
  });

  const quotesQuery = useQuery({
    queryKey: ["my-quotes"],
    queryFn:  () => quotationService.list({ limit: 5 }),
    staleTime: 15_000,
  });

  const myRfqs   = rfqQuery.data;
  const myQuotes = quotesQuery.data;

  const totalRfqs   = myRfqs?.total ?? 0;
  const quotedRfqs  = myRfqs?.items.filter((r) => r.status === "quoted").length ?? 0;
  const openRfqs    = myRfqs?.items.filter((r) => r.status === "open").length ?? 0;
  const totalQuotes = myQuotes?.total ?? 0;

  const stats = [
    { label: "إجمالي طلباتي",  value: totalRfqs,   icon: ClipboardList, accent: "text-slate-600",   ring: "bg-slate-100" },
    { label: "بانتظار الرد",    value: openRfqs,    icon: Clock,          accent: "text-amber-600",   ring: "bg-amber-50" },
    { label: "تم التسعير",      value: quotedRfqs,  icon: CheckCircle,    accent: "text-emerald-600", ring: "bg-emerald-50" },
    { label: "عروض مستلمة",    value: totalQuotes, icon: TrendingUp,     accent: "text-sky-600",     ring: "bg-sky-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-white px-8 py-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          مرحباً، {user?.full_name || ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          ابحث عن المنتجات واعرف تكلفتها الكاملة قبل أي تواصل
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, accent, ring }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${ring}`}>
              <Icon className={`h-4.5 w-4.5 ${accent}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={() => navigate(ROUTES.CATALOG.MARKETPLACE)}
          className="group flex items-center gap-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-5 text-right transition-all hover:border-emerald-300 hover:shadow-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/25 group-hover:bg-emerald-700 transition-colors">
            <Search className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">تصفح المنتجات</p>
            <p className="text-xs text-slate-500">شاهد التكلفة الكاملة قبل الطلب</p>
          </div>
          <ArrowLeft className="ms-auto h-4 w-4 shrink-0 text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>

        <button
          onClick={() => navigate(ROUTES.QUOTES.LIST)}
          className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 text-right transition-all hover:border-slate-300 hover:shadow-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-slate-200 transition-colors">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">عروض الأسعار</p>
            <p className="text-xs text-slate-500">استعرض العروض المرسلة إليك</p>
          </div>
          <ArrowLeft className="ms-auto h-4 w-4 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* New RFQ Form */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Package className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">طلب عرض سعر جديد</h2>
              <p className="text-xs text-slate-500">أو تصفح السوق وابحث عن ما تريد</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                اسم المنتج <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="input"
                placeholder="مثال: مصابيح LED صناعية"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                الوصف والمواصفات <span className="text-red-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="input resize-none"
                placeholder="المواصفات التفصيلية..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  الكمية <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  ميناء الوصول
                </label>
                <input
                  type="text"
                  value={destinationPort}
                  onChange={(e) => setDestinationPort(e.target.value)}
                  className="input"
                  placeholder="العقبة"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                صورة توضيحية <span className="text-slate-400 text-xs">(اختياري)</span>
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 px-4 py-4 text-center text-xs text-slate-400 transition-colors hover:border-emerald-300 hover:text-emerald-600"
              >
                <Upload className="mx-auto mb-1.5 h-4 w-4" />
                {selectedFile ? selectedFile.name : "اضغط لاختيار صورة"}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            {formError && (
              <p className="rounded-xl bg-red-50 px-4 py-2.5 text-xs text-red-600 ring-1 ring-red-100">
                {formError}
              </p>
            )}
            {createMutation.isSuccess && (
              <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-xs text-emerald-700 ring-1 ring-emerald-100">
                ✓ تم إرسال الطلب بنجاح
              </p>
            )}

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary w-full"
            >
              {createMutation.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
            </button>
          </form>
        </div>

        {/* Recent RFQs */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">طلباتي الأخيرة</h2>
            </div>
            <button
              onClick={() => navigate(ROUTES.RFQ.LIST)}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              عرض الكل
            </button>
          </div>

          {rfqQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : myRfqs && myRfqs.items.length > 0 ? (
            <div className="space-y-2">
              {myRfqs.items.slice(0, 6).map((rfq) => (
                <div
                  key={rfq.id}
                  onClick={() => navigate(ROUTES.RFQ.DETAIL(rfq.id))}
                  className="cursor-pointer rounded-xl border border-slate-100 p-3.5 transition-all hover:border-slate-200 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium text-slate-800">
                      {rfq.client_request_arabic?.split("\n")[0]?.replace("المنتج: ", "") || "طلب"}
                    </p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[rfq.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABELS[rfq.status] ?? rfq.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(rfq.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
                    {rfq.destination_port && ` — ${rfq.destination_port}`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50">
                <FileText className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">لا توجد طلبات بعد</p>
              <button
                onClick={() => navigate(ROUTES.CATALOG.MARKETPLACE)}
                className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                تصفح المنتجات المتاحة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Received Quotes */}
      {myQuotes && myQuotes.items.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">عروض الأسعار المستلمة</h2>
            </div>
            <button
              onClick={() => navigate(ROUTES.QUOTES.LIST)}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              عرض الكل
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myQuotes.items.slice(0, 3).map((q) => (
              <div
                key={q.id}
                onClick={() => navigate(ROUTES.QUOTES.DETAIL(q.id))}
                className="cursor-pointer rounded-xl border border-slate-100 p-4 transition-all hover:border-slate-200 hover:shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-400">
                    #{q.quotation_number?.slice(-6)}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[q.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                  </span>
                </div>
                <p className="text-xl font-bold text-slate-900" dir="ltr">
                  {q.grand_total?.toLocaleString("en", { minimumFractionDigits: 2 })} {q.target_currency}
                </p>
                <p className="mt-1.5 text-xs text-slate-400">
                  {new Date(q.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
