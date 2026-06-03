import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { documentService } from "@/services/documentService";
import { intakeService } from "@/services/intakeService";
import { ROUTES } from "@/constants/routes";

export function DocumentUploadPage() {
  const navigate = useNavigate();
  const [selectedRfqId, setSelectedRfqId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: rfqsData, isLoading: rfqsLoading } = useQuery({
    queryKey: ["rfqs-for-upload"],
    queryFn: () => intakeService.list({ limit: 50 }),
  });

  const rfqs = rfqsData?.items ?? [];

  const uploadMutation = useMutation({
    mutationFn: ({ rfqId, file }: { rfqId: string; file: File }) =>
      documentService.upload(rfqId, file),
    onSuccess: (doc) => {
      navigate(ROUTES.DOCUMENTS.DETAIL(doc.id));
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedRfqId) {
      setError("يرجى اختيار طلب عرض السعر");
      return;
    }
    if (!selectedFile) {
      setError("يرجى اختيار ملف للرفع");
      return;
    }

    uploadMutation.mutate({ rfqId: selectedRfqId, file: selectedFile });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">رفع مستند</h1>
        <p className="mt-1 text-sm text-gray-500">
          رفع فاتورة، كتالوج، أو أي مستند لاستخراج بيانات المنتجات منه
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        {/* RFQ Selection */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            طلب عرض السعر <span className="text-red-500">*</span>
          </label>

          {rfqsLoading ? (
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
              جاري تحميل طلبات عرض السعر...
            </div>
          ) : rfqs.length === 0 ? (
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
              <p className="mb-2 font-medium">لا توجد طلبات عرض سعر متاحة</p>
              <p>
                يرجى{" "}
                <Link
                  to={ROUTES.RFQ.CREATE}
                  className="font-medium text-amber-800 underline hover:text-amber-900"
                >
                  إنشاء طلب عرض سعر جديد
                </Link>{" "}
                أولاً ثم العودة لرفع المستندات
              </p>
            </div>
          ) : (
            <select
              value={selectedRfqId}
              onChange={(e) => setSelectedRfqId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">-- اختر طلب عرض سعر --</option>
              {rfqs.map((rfq) => (
                <option key={rfq.id} value={rfq.id}>
                  {rfq.client_name} — {(rfq.client_request_arabic || "").slice(0, 50)}...
                </option>
              ))}
            </select>
          )}
        </div>

        {/* File Upload */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            الملف <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 flex justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10">
            <div className="text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mx-auto h-12 w-12 text-gray-300"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6h.1a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div className="mt-4 flex text-sm text-gray-600">
                <label className="relative cursor-pointer rounded-md bg-white font-medium text-primary-600 hover:text-primary-500">
                  <span>اختر ملف</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </label>
                <p className="mr-1">أو اسحب وأفلت</p>
              </div>
              <p className="text-xs text-gray-400">PDF, JPG, PNG, TIFF</p>
              {selectedFile && (
                <p className="mt-2 text-sm font-medium text-primary-700">
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={uploadMutation.isPending}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {uploadMutation.isPending ? "جاري الرفع..." : "رفع المستند"}
        </button>
      </form>
    </div>
  );
}
