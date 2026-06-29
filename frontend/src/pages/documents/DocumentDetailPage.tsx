import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ROUTES } from "@/constants/routes";
import { documentService } from "@/services/documentService";
import { useState } from "react";

/**
 * Confirmation dialog component before destructive actions.
 */
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "جاري الحذف..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Field label translations ────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  // Identity
  product_name:       "اسم المنتج",
  name:               "الاسم",
  item_name:          "اسم الصنف",
  model_number:       "الموديل",
  model:              "الموديل",
  sku:                "كود المنتج",
  code:               "الكود",
  reference:          "المرجع",
  ref:                "المرجع",
  article:            "المادة",
  barcode:            "الباركود",

  // Pricing
  unit_price_rmb:     "السعر (¥)",
  unit_price:         "سعر الوحدة",
  price:              "السعر",
  wholesale_price:    "سعر الجملة",
  retail_price:       "سعر التجزئة",
  cost:               "التكلفة",
  msrp:               "السعر المقترح",

  // Ordering
  moq:                "الحد الأدنى للطلب",
  min_order:          "الحد الأدنى",
  quantity:           "الكمية",
  stock:              "المخزون",
  lead_time:          "وقت التسليم",

  // Physical
  weight_kg:          "الوزن (kg)",
  weight:             "الوزن",
  dimensions:         "الأبعاد",
  size:               "المقاس / الحجم",
  length:             "الطول",
  width:              "العرض",
  height:             "الارتفاع",
  volume:             "الحجم",
  packaging:          "التعبئة",
  package:            "التعبئة",

  // Material / Composition
  material:           "المادة / الخامة",
  fabric_composition: "تركيب القماش",
  composition:        "التركيب",
  fabric:             "القماش",

  // Classification
  category:           "الفئة",
  type:               "النوع",
  brand:              "العلامة التجارية",
  origin:             "بلد المنشأ",
  manufacturer:       "الشركة المصنعة",
  supplier:           "المورد",

  // Attributes (apparel / general)
  color:              "اللون",
  colour:             "اللون",
  size_range:         "نطاق المقاسات",
  gender:             "الجنس",
  age_group:          "الفئة العمرية",
  season:             "الموسم",
  style:              "الستايل",
  pattern:            "النقشة",

  // Technical / Electronics
  voltage:            "الجهد",
  wattage:            "القدرة (واط)",
  power:              "الطاقة",
  capacity:           "السعة",
  frequency:          "التردد",
  certification:      "الشهادة",

  // Food / FMCG
  shelf_life:         "مدة الصلاحية",
  expiry:             "تاريخ الانتهاء",
  ingredients:        "المكونات",
  net_weight:         "الوزن الصافي",
  gross_weight:       "الوزن الإجمالي",
  flavor:             "النكهة",

  // General
  description:        "الوصف",
  notes:              "ملاحظات",
  specs:              "المواصفات",
  specification:      "المواصفات",
  specifications:     "المواصفات",
  features:           "المميزات",
  image:              "الصورة",
  url:                "الرابط",
};

function formatFieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(" / ");
  if (typeof value === "object") return JSON.stringify(value);
  const str = String(value);
  const num = Number(value);
  if (key.includes("price") || key.includes("rmb") || key === "cost" || key === "msrp") {
    if (!isNaN(num)) return num.toLocaleString();
  }
  if (key.includes("weight") || key === "net_weight" || key === "gross_weight") {
    if (!isNaN(num)) return `${num} kg`;
  }
  if (key === "moq" || key === "min_order") {
    if (!isNaN(num)) return `${num.toLocaleString()} وحدة`;
  }
  if (key === "wattage" || key === "power") {
    if (!isNaN(num)) return `${num} W`;
  }
  return str;
}

function DynamicProductTable({ items }: { items: Record<string, unknown>[] }) {
  // Collect all unique keys across all products, product_name first
  const allKeys = Array.from(
    items.reduce((acc, item) => {
      Object.keys(item).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>())
  ).sort((a, b) => {
    const order = ["product_name", "model_number", "model", "category",
                   "unit_price_rmb", "unit_price", "price", "moq",
                   "weight_kg", "weight", "dimensions", "size", "material",
                   "voltage", "capacity", "specs", "specification", "package", "description"];
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-right text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-xs font-medium text-gray-400 w-8">#</th>
            {allKeys.map((key) => (
              <th key={key} className="px-3 py-2 text-xs font-medium text-gray-600 whitespace-nowrap">
                {formatFieldLabel(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((item, i) => (
            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
              {allKeys.map((key) => (
                <td key={key} className="px-3 py-2 text-gray-800 whitespace-nowrap">
                  {formatFieldValue(key, item[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-gray-100 text-gray-700",
  processing: "bg-yellow-100 text-yellow-700",
  extracted: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: "مرفوع",
  processing: "قيد المعالجة",
  extracted: "تم الاستخراج",
  failed: "فشل",
};

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: doc, isLoading, error } = useQuery({
    queryKey: ["document", id],
    queryFn: () => documentService.get(id!),
    enabled: !!id,
  });

  const { data: statusData } = useQuery({
    queryKey: ["document-status", id],
    queryFn: () => documentService.getStatus(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "processing" ? 3000 : false;
    },
  });

  const { data: itemsData } = useQuery({
    queryKey: ["document-items", id],
    queryFn: () => documentService.getItems(id!),
    enabled: !!id && statusData?.status === "extracted",
  });

  const processMutation = useMutation({
    mutationFn: () => documentService.process(id!),
    onSuccess: () => {
      setProcessing(false);
      queryClient.invalidateQueries({ queryKey: ["document-status", id] });
    },
    onError: () => setProcessing(false),
  });

  const deleteMutation = useMutation({
    mutationFn: () => documentService.delete(id!),
    onSuccess: () => {
      navigate(ROUTES.RFQ.LIST);
    },
  });

  const handleProcess = () => {
    setProcessing(true);
    processMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="card p-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        <p className="mt-4 text-sm text-gray-500">جاري تحميل تفاصيل المستند...</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="card p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-medium text-gray-600">خطأ في تحميل التفاصيل</h3>
        <p className="mt-2 text-sm text-red-500">{(error as Error)?.message || "لم يتم العثور على المستند"}</p>
      </div>
    );
  }

  const currentStatus = statusData?.status || doc.status;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(ROUTES.RFQ.LIST)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            → العودة
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">تفاصيل المستند</h1>
            <p className="mt-1 text-sm text-gray-500">{doc.file_name}</p>
          </div>
        </div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
            STATUS_COLORS[currentStatus] || "bg-gray-100 text-gray-700"
          }`}
        >
          {STATUS_LABELS[currentStatus] || currentStatus}
        </span>
      </div>

      {/* Document Info */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">معلومات المستند</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">اسم الملف</p>
            <p className="font-medium text-gray-900" dir="ltr">{doc.file_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">نوع المحتوى</p>
            <p className="font-medium text-gray-900">{doc.content_type}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">الحجم</p>
            <p className="font-medium text-gray-900">
              {(doc.file_size_bytes / 1024).toFixed(1)} KB
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">RFQ</p>
            <button
              onClick={() => navigate(ROUTES.RFQ.DETAIL(doc.rfq_id))}
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              عرض طلب عرض السعر
            </button>
          </div>
          <div>
            <p className="text-sm text-gray-500">تاريخ الرفع</p>
            <p className="font-medium text-gray-900">
              {new Date(doc.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
            </p>
          </div>
        </div>
      </div>

      {/* Processing Status */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">حالة المعالجة</h2>
        {currentStatus === "uploaded" && (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">لم تتم معالجة المستند بعد</p>
            <button
              onClick={handleProcess}
              disabled={processing}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {processing ? "جاري المعالجة..." : "بدء معالجة المستند"}
            </button>
          </div>
        )}
        {currentStatus === "processing" && (
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-yellow-200 border-t-yellow-600" />
            <p className="mt-4 text-sm text-yellow-600">جاري معالجة المستند باستخدام الذكاء الاصطناعي...</p>
          </div>
        )}
        {currentStatus === "extracted" && itemsData && (
          <div>
            <p className="text-sm text-green-600 mb-4">
              تم استخراج البيانات بنجاح ✓ &nbsp;
              <span className="text-gray-400">({itemsData.items.length} منتج)</span>
            </p>
            {itemsData.items.length > 0 ? (
              <DynamicProductTable items={itemsData.items} />
            ) : (
              <p className="text-sm text-gray-400">لم يتم استخراج أي منتجات من هذا المستند</p>
            )}
          </div>
        )}
        {currentStatus === "failed" && (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="mt-4 text-sm text-red-600">
              {statusData?.error_message || "فشلت معالجة المستند"}
            </p>
            <button
              onClick={handleProcess}
              disabled={processing}
              className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              إعادة المحاولة
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleteMutation.isPending}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          {deleteMutation.isPending ? "جاري الحذف..." : "حذف المستند"}
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="حذف المستند"
        message={`هل أنت متأكد من حذف المستند "${doc.file_name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="نعم، احذف المستند"
        onConfirm={() => {
          deleteMutation.mutate();
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
