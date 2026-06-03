import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { intakeService } from "@/services/intakeService";
import { ROUTES } from "@/constants/routes";
import { ClipboardList, Package, Upload, FileText } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  processing: "bg-yellow-100 text-yellow-700",
  quoted: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  open: "قيد المراجعة",
  processing: "قيد المعالجة",
  quoted: "تم التسعير",
  closed: "مغلق",
  cancelled: "ملغي",
};

/**
 * Client Dashboard — RFQ Creation & Status View
 *
 * Clients can:
 * 1. Create a new RFQ with Product Name, Description, Quantity, Destination Port, optional image
 * 2. View the status of their own RFQs
 */
export function ClientDashboard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  // ── RFQ Creation Form ──
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [destinationPort, setDestinationPort] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: {
      productName: string;
      description: string;
      quantity: number;
      destinationPort: string;
    }) =>
      intakeService.create({
        client_name: user?.full_name || "",
        client_request_arabic: `المنتج: ${data.productName}\nالوصف: ${data.description}\nالكمية: ${data.quantity}\nميناء الوصول: ${data.destinationPort}`,
        destination_port: data.destinationPort,
        target_currency: "JOD",
      }),
    onSuccess: () => {
      setProductName("");
      setDescription("");
      setQuantity(1);
      setDestinationPort("");
      setSelectedFile(null);
      setFormError(null);
      refetch();
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const handleCreateRfq = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!productName.trim()) {
      setFormError("يرجى إدخال اسم المنتج");
      return;
    }
    if (!description.trim()) {
      setFormError("يرجى إدخال وصف المنتج");
      return;
    }
    if (quantity < 1) {
      setFormError("يرجى إدخال كمية صالحة");
      return;
    }

    createMutation.mutate({
      productName: productName.trim(),
      description: description.trim(),
      quantity,
      destinationPort: destinationPort.trim(),
    });
  };

  // ── My RFQs List ──
  const { data: myRfqs, isLoading, refetch } = useQuery({
    queryKey: ["my-rfqs"],
    queryFn: () => intakeService.list({ limit: 50 }),
    staleTime: 15_000,
  });

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="card p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          مرحباً {user?.full_name || ""} 👋
        </h1>
        <p className="mt-2 text-gray-600">
          مرحباً بك في منصة AI-Sourcing Hub. يمكنك تقديم طلبات عروض أسعار ومتابعة حالتها.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* ── New RFQ Form ── */}
        <div className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">طلب عرض سعر جديد</h2>
              <p className="text-sm text-gray-500">أدخل تفاصيل المنتج الذي تبحث عنه</p>
            </div>
          </div>

          <form onSubmit={handleCreateRfq} className="space-y-4">
            {/* Product Name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                اسم المنتج <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="مثال: صابون زيت زيتون"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                الوصف والمواصفات <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="اذكر مواصفات المنتج بالتفصيل..."
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                الكمية المطلوبة <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Destination Port */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ميناء الوصول
              </label>
              <input
                type="text"
                value={destinationPort}
                onChange={(e) => setDestinationPort(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="مثال: ميناء العقبة، الأردن"
              />
            </div>

            {/* Optional Image Upload */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                صورة توضيحية (اختياري)
              </label>
              <div className="mt-1 flex justify-center rounded-lg border-2 border-dashed border-gray-300 px-4 py-6">
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-300" />
                  <div className="mt-2 flex text-sm text-gray-600">
                    <label className="relative cursor-pointer rounded-md bg-white font-medium text-primary-600 hover:text-primary-500">
                      <span>اختر صورة</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="sr-only"
                        accept="image/*"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <p className="mr-1">أو اسحب وأفلت</p>
                  </div>
                  <p className="text-xs text-gray-400">JPG, PNG (اختياري)</p>
                  {selectedFile && (
                    <p className="mt-2 text-sm font-medium text-primary-700">
                      {selectedFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{formError}</div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "جاري الإرسال..." : "إرسال طلب عرض السعر"}
            </button>
          </form>
        </div>

        {/* ── My RFQs List ── */}
        <div className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">طلباتي</h2>
              <p className="text-sm text-gray-500">حالة طلبات عروض الأسعار الخاصة بك</p>
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="py-8 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
              <p className="mt-3 text-sm text-gray-500">جاري تحميل الطلبات...</p>
            </div>
          )}

          {/* Empty State */}
          {myRfqs && myRfqs.items.length === 0 && !isLoading && (
            <div className="py-8 text-center">
              <FileText className="mx-auto h-10 w-10 text-gray-300" />
              <h3 className="mt-3 text-sm font-medium text-gray-600">لا توجد طلبات بعد</h3>
              <p className="mt-1 text-xs text-gray-400">
                قم بإنشاء طلب عرض سعر جديد وسيظهر هنا
              </p>
            </div>
          )}

          {/* RFQs List */}
          {myRfqs && myRfqs.items.length > 0 && (
            <div className="space-y-3">
              {myRfqs.items.map((rfq) => (
                <div
                  key={rfq.id}
                  onClick={() => navigate(ROUTES.RFQ.DETAIL(rfq.id))}
                  className="cursor-pointer rounded-lg border border-gray-200 p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {rfq.client_request_arabic?.slice(0, 80) || "طلب عرض سعر"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(rfq.created_at).toLocaleDateString("ar-SA")}
                        {rfq.destination_port && ` — ${rfq.destination_port}`}
                      </p>
                    </div>
                    <span
                      className={`mr-3 shrink-0 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[rfq.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[rfq.status] || rfq.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
