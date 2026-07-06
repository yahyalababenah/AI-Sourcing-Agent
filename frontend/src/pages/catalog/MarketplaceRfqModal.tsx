import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { intakeService } from "@/services/intakeService";
import { pricingService } from "@/services/pricingService";
import { useAuthStore } from "@/stores/authStore";
import type { QuickEstimateResponse } from "@/types/pricing";
import type { CatalogProduct } from "@/types/catalog";
import type { RFQCreate } from "@/types/intake";

const formatPrice = (price: number | null): string => {
  if (price === null || price === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

interface MarketplaceRfqModalProps {
  product: CatalogProduct;
  open: boolean;
  onClose: () => void;
}

/** "طلب عرض سعر" modal — shared between MarketplacePageDesktop and
 * MarketplacePageMobile. Same real logic as before this split (live
 * pricingService.estimate + intakeService.create), only recolored from the
 * old CSS-variable/raw-hex theme to Tailwind/brand tokens per CLAUDE.md
 * (no hand-written hex outside lib/tokens.ts). */
export function MarketplaceRfqModal({ product, open, onClose }: MarketplaceRfqModalProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [quantity, setQuantity] = useState<number>(product.moq ?? 1);
  const [destinationPort, setDestinationPort] = useState("Aqaba");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuantity(product.moq ?? 1);
      setDestinationPort("Aqaba");
      setError(null);
    }
  }, [open, product.moq]);

  const { data: estimate, isLoading: estimateLoading } = useQuery<QuickEstimateResponse>({
    queryKey: ["estimate", product.id, quantity, destinationPort],
    queryFn: () =>
      pricingService.estimate({
        unit_price_cny: product.unit_price_rmb ?? 0,
        quantity,
        destination_port: destinationPort || "Aqaba",
        weight_kg: product.weight_kg ?? 0,
        hs_code: product.hs_code ?? undefined,
        has_license: true,
      }),
    enabled: open && !!product.unit_price_rmb && quantity > 0,
    retry: false,
    staleTime: 60_000,
  });

  const createRfqMutation = useMutation({
    mutationFn: (data: RFQCreate) => intakeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      toast.success("تم إرسال طلب عرض السعر بنجاح");
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!quantity || quantity < 1) {
      setError("يرجى إدخال كمية صالحة");
      return;
    }

    const payload: RFQCreate = {
      client_name: user?.full_name ?? "",
      client_phone: user?.phone ?? "",
      client_request_arabic: [
        `طلب شراء: ${product.product_name ?? "منتج"}`,
        product.model_number ? `الموديل: ${product.model_number}` : null,
        `الكمية: ${quantity}`,
        product.moq ? `الحد الأدنى للطلب: ${product.moq}` : null,
        `المورد: ${product.supplier_name}`,
        product.factory_name ? `المصنع: ${product.factory_name}` : null,
        destinationPort ? `ميناء الوصول: ${destinationPort}` : null,
      ]
        .filter(Boolean)
        .join(" — "),
      extracted_entities: {
        product_name: product.product_name ?? "",
        model_number: product.model_number ?? "",
        quantity: String(quantity),
        unit_price_rmb: String(product.unit_price_rmb ?? ""),
        supplier_name: product.supplier_name,
        supplier_id: product.supplier_id,
        document_id: product.document_id,
      },
      destination_port: destinationPort || undefined,
      target_currency: "USD",
    };

    createRfqMutation.mutate(payload);
  };

  if (!open) return null;

  const isPending = createRfqMutation.isPending;
  const isSuccess = createRfqMutation.isSuccess;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">طلب عرض سعر</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 active:scale-[0.98]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 rounded-xl bg-slate-50 p-4">
          <h3 className="font-semibold text-slate-900">{product.product_name ?? "منتج غير معروف"}</h3>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {product.model_number && (
              <p>
                الموديل: <span className="font-medium text-slate-900" dir="ltr">{product.model_number}</span>
              </p>
            )}
            <p>
              السعر الأساسي: <span className="font-medium text-slate-900">{formatPrice(product.unit_price_rmb)}</span>
            </p>
            {product.moq && (
              <p>
                الحد الأدنى للطلب: <span className="font-medium text-slate-900">{product.moq}</span>
              </p>
            )}
            <p className="text-xs text-slate-400">
              المورد: {product.supplier_name}
              {product.factory_name && ` — ${product.factory_name}`}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                الكمية <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">ميناء الوصول</label>
              <input
                type="text"
                value={destinationPort}
                onChange={(e) => setDestinationPort(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="Aqaba"
              />
            </div>
          </div>

          {product.unit_price_rmb && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600">التكلفة التقديرية</p>
              {estimateLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                  جاري الحساب...
                </div>
              ) : estimate ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>السعر الأساسي × {estimate.quantity}</span>
                    <span dir="ltr">
                      {(estimate.unit_price_converted * estimate.quantity).toFixed(2)} {estimate.target_currency}
                    </span>
                  </div>
                  {estimate.insurance_cost > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>التأمين</span>
                      <span dir="ltr">{estimate.insurance_cost.toFixed(2)} {estimate.target_currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>الجمارك والرسوم</span>
                    <span dir="ltr">{estimate.customs_duty.toFixed(2)} {estimate.target_currency}</span>
                  </div>
                  {estimate.clearance_fee > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>رسوم التخليص</span>
                      <span dir="ltr">{estimate.clearance_fee.toFixed(2)} {estimate.target_currency}</span>
                    </div>
                  )}
                  {estimate.vat > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>ضريبة القيمة المضافة</span>
                      <span dir="ltr">{estimate.vat.toFixed(2)} {estimate.target_currency}</span>
                    </div>
                  )}
                  <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 font-semibold text-brand-600">
                    <span>المجموع التقديري</span>
                    <span dir="ltr">{estimate.estimated_total.toFixed(2)} {estimate.target_currency}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{estimate.note}</p>
                  <p className="text-xs text-slate-400">
                    سعر الصرف: 1 CNY = {estimate.exchange_rate.toFixed(4)} {estimate.target_currency}
                  </p>
                  {product.hs_code && !estimate.hs_code_matched && (
                    <p className="text-xs text-amber-600">
                      ⚠️ رمز HS {product.hs_code} غير موجود في الجدول — طُبّق رسم عام تقديري 5٪
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">تعذّر حساب التكلفة التقديرية</p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending || isSuccess}
              className="flex-1 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-600 active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? "جاري الإرسال..." : "إرسال طلب عرض السعر"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98]"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
