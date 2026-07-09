import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { pricingService } from "@/services/pricingService";
import { quotationService } from "@/services/quotationService";
import { ROUTES } from "@/constants/routes";
import { calculateLocalFallback } from "./localPricingFallback";
import type {
  CalculatePriceResponse,
  CalculatePriceRequest,
  PriceProductInput,
  HSCodeFeeSchedule,
} from "@/types/pricing";

// ── Types ────────────────────────────────────────────────────────────────

export interface StandaloneProductInput {
  name: string;
  hsCode: string;
  quantity: number;
  unitPriceCny: number;
  weightKg: number;
  volumeCbm?: number;
  hasLicense: boolean;
}

export interface StandaloneCalculatorState {
  products: StandaloneProductInput[];
  hsCodeList: HSCodeFeeSchedule[];
  calculationResult: CalculatePriceResponse | null;
  quotationId: string | null;
  isLoading: boolean;
  error: string | null;
}

// Thrown for client-side validation problems — distinct from a failed
// network call so the hook knows not to trigger the local fallback.
class StandaloneValidationError extends Error {}

// Same currencies as the RFQ-tied calculator (see usePricingCalculator).
export const CURRENCIES = [
  { value: "JOD", label: "دينار أردني (JOD)" },
  { value: "USD", label: "دولار أمريكي (USD)" },
];

const DEFAULT_PRODUCT: StandaloneProductInput = {
  name: "",
  hsCode: "",
  quantity: 1,
  unitPriceCny: 0,
  weightKg: 0,
  volumeCbm: undefined,
  hasLicense: false,
};

/** Build a PriceProductInput[] from the StandaloneProductInput[] state,
 *  generating a unique placeholder product_id for each entry. */
function toPriceProducts(
  products: StandaloneProductInput[],
): PriceProductInput[] {
  return products.map((p, i) => ({
    product_id: `standalone-${i}`,
    name: p.name || `منتج ${i + 1}`,
    quantity: p.quantity,
    unit_price_cny: p.unitPriceCny,
    weight_kg: p.weightKg,
    hs_code: p.hsCode.trim() || undefined,
    has_license: p.hasLicense,
    volume_cbm: p.volumeCbm,
  }));
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useStandaloneCalculator() {
  const navigate = useNavigate();

  // ── Core state ──
  const [products, setProducts] = useState<StandaloneProductInput[]>([{ ...DEFAULT_PRODUCT }]);
  const [targetCurrency, setTargetCurrency] = useState("JOD");
  const [destinationPort, setDestinationPort] = useState("");
  const [result, setResult] = useState<CalculatePriceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotationId, setQuotationId] = useState<string | null>(null);

  // ── HS-Code list from the DB ──
  const { data: hsCodeData, isLoading: hsCodesLoading } = useQuery({
    queryKey: ["hs-codes"],
    queryFn: () => pricingService.listHsCodes(),
  });

  const hsCodeList = hsCodeData?.items ?? [];

  // ── Product CRUD ──

  const addProduct = useCallback(() => {
    setProducts((prev) => [...prev, { ...DEFAULT_PRODUCT }]);
  }, []);

  const removeProduct = useCallback((index: number) => {
    setProducts((prev) => {
      if (prev.length <= 1) return prev; // Keep at least one product row
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const updateProduct = useCallback(
    (index: number, field: keyof StandaloneProductInput, value: unknown) => {
      setProducts((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    [],
  );

  // ── Validation helper ──
  function validate(): StandaloneProductInput[] {
    if (!destinationPort.trim()) {
      throw new StandaloneValidationError("يرجى تعبئة ميناء الوصول");
    }
    const valid = products.filter((p) => p.name.trim() && p.unitPriceCny > 0);
    if (valid.length === 0) {
      throw new StandaloneValidationError("أضف منتجاً واحداً على الأقل مع اسم وسعر");
    }
    return valid;
  }

  // ── Calculate mutation ──
  const calculateMutation = useMutation({
    mutationFn: () => {
      const validProducts = validate();
      const allHasLicense = validProducts.length > 0 && validProducts.every((p) => p.hasLicense);
      const anyVolumeCbm = validProducts.find((p) => p.volumeCbm != null)?.volumeCbm;
      const globalVolumeCbm =
        anyVolumeCbm != null && validProducts.every((p) => p.volumeCbm === anyVolumeCbm)
          ? anyVolumeCbm
          : undefined;
      return pricingService.calculateStandalone({
        target_currency: targetCurrency,
        destination_port: destinationPort.trim(),
        products: toPriceProducts(validProducts),
        has_license: allHasLicense || undefined,
        volume_cbm: globalVolumeCbm,
      } as CalculatePriceRequest);
    },
    onSuccess: (data) => {
      setResult(data);
      setQuotationId(null);
      setError(null);
    },
    onError: (err: Error) => {
      if (err instanceof StandaloneValidationError) {
        setError(err.message);
        setResult(null);
        return;
      }
      // Backend unreachable — compute a local approximate estimate
      // so disconnecting the backend doesn't break the calculator.
      const validProducts = products.filter((p) => p.name.trim() && p.unitPriceCny > 0);
      if (validProducts.length > 0 && destinationPort.trim()) {
        setResult(
          calculateLocalFallback(
            toPriceProducts(validProducts),
            targetCurrency,
            destinationPort.trim(),
            "standalone",
          ),
        );
        setError(null);
      } else {
        setError(err.message);
        setResult(null);
      }
    },
  });

  // ── Create quotation mutation ──
  const createQuoteMutation = useMutation({
    mutationFn: () => {
      if (!result) throw new Error("ليس هناك نتائج للحساب");
      return quotationService.createStandalone({
        target_currency: result.target_currency,
        exchange_rate_used: result.exchange_rate_used,
        line_items: result.line_items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price_cny: item.unit_price_cny,
          unit_price_converted: item.unit_price_converted,
          exchange_rate: item.exchange_rate,
          freight_cost: item.freight_cost,
          customs_duty: item.customs_duty,
          commission: item.commission,
          subtotal: item.subtotal,
          discount: item.discount,
          total: item.total,
        })),
        subtotal: result.subtotal_before_vat,
        vat_total: result.vat,
        discount_total: result.discount_total,
        grand_total: result.grand_total,
      });
    },
    onSuccess: (quote) => {
      setQuotationId(quote.id);
      navigate(ROUTES.QUOTES.DETAIL(quote.id));
    },
  });

  // ── Reset ──
  const reset = useCallback(() => {
    setProducts([{ ...DEFAULT_PRODUCT }]);
    setResult(null);
    setError(null);
    setQuotationId(null);
    setTargetCurrency("JOD");
    setDestinationPort("");
  }, []);

  return {
    // State
    products,
    targetCurrency,
    setTargetCurrency,
    destinationPort,
    setDestinationPort,
    result,
    error,
    quotationId,
    hsCodeList,
    hsCodesLoading,

    // Product CRUD
    addProduct,
    removeProduct,
    updateProduct,

    // Mutations
    calculateMutation,
    createQuoteMutation,

    // Actions
    reset,
    navigate,
  };
}
