import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { intakeService } from "@/services/intakeService";
import { pricingService } from "@/services/pricingService";
import { quotationService } from "@/services/quotationService";
import { ROUTES } from "@/constants/routes";
import { calculateLocalFallback } from "./localPricingFallback";
import type { CalculatePriceResponse, PriceProductInput } from "@/types/pricing";

// Thrown for client-side input problems (no RFQ/port/products) — distinct
// from a failed network call so onError knows not to fall back for these.
class PricingValidationError extends Error {}

// Only JOD/USD are actually supported by the pricing engine — any other
// currency silently falls back to JOD math (see engine.py's currency branch).
export const CURRENCIES = [
  { value: "JOD", label: "دينار أردني (JOD)" },
  { value: "USD", label: "دولار أمريكي (USD)" },
];

export type ProductInput = {
  quantity: number;
  unit_price_cny: number;
  weight_kg: number;
  hs_code: string;
  has_license: boolean;
};

/** Shared react-query/state wiring for the pricing calculator — used by both
 * PricingCalcPageDesktop and PricingCalcPageMobile so the two files never
 * duplicate the RFQ→products→calculate→quote flow (mirrors useAgentDashboardData's role). */
export function usePricingCalculator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedRfqId, setSelectedRfqId] = useState(searchParams.get("rfq_id") ?? "");
  const [targetCurrency, setTargetCurrency] = useState("JOD");
  const [destinationPort, setDestinationPort] = useState("");
  const [productInputs, setProductInputs] = useState<Record<string, ProductInput>>({});
  const [result, setResult] = useState<CalculatePriceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: rfqsData, isLoading: rfqsLoading } = useQuery({
    queryKey: ["rfqs", "all", 1],
    queryFn: () => intakeService.list({ limit: 100 }),
  });

  // Auto-select RFQ from URL param when data loads
  const rfqFromUrl = searchParams.get("rfq_id");
  useEffect(() => {
    if (rfqFromUrl && rfqsData?.items && !selectedRfqId && rfqsData.items.some((r) => r.id === rfqFromUrl)) {
      setSelectedRfqId(rfqFromUrl);
    }
  }, [rfqFromUrl, rfqsData, selectedRfqId]);

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["rfq-products", selectedRfqId],
    queryFn: () => intakeService.listProducts(selectedRfqId),
    enabled: !!selectedRfqId,
  });

  const handleRfqChange = (rfqId: string) => {
    setSelectedRfqId(rfqId);
    setProductInputs({});
    setResult(null);
    setError(null);
  };

  // Populate inputs whenever products data changes
  if (products && Object.keys(productInputs).length === 0 && selectedRfqId) {
    const inputs: Record<string, ProductInput> = {};
    for (const p of products) {
      inputs[p.id] = {
        quantity: p.quantity ?? 1,
        unit_price_cny: 0,
        weight_kg: p.weight_kg ?? 0,
        hs_code: "",
        has_license: false,
      };
    }
    if (JSON.stringify(productInputs) !== JSON.stringify(inputs)) {
      // Defer to avoid setState during render
      setTimeout(() => setProductInputs(inputs), 0);
    }
  }

  const buildProductsPayload = (): PriceProductInput[] =>
    Object.entries(productInputs).map(([productId, vals]) => {
      const prod = products?.find((p) => p.id === productId);
      return {
        product_id: productId,
        name: prod?.name || productId,
        quantity: vals.quantity,
        unit_price_cny: vals.unit_price_cny,
        weight_kg: vals.weight_kg,
        hs_code: vals.hs_code.trim() || undefined,
        has_license: vals.has_license,
      };
    });

  const calculateMutation = useMutation({
    mutationFn: () => {
      if (!selectedRfqId || !destinationPort.trim()) {
        throw new PricingValidationError("يرجى اختيار طلب عرض السعر وتعبئة ميناء الوصول");
      }
      const productsPayload = buildProductsPayload();
      if (productsPayload.length === 0) {
        throw new PricingValidationError("لا توجد منتجات للحساب");
      }
      return pricingService.calculate({
        rfq_id: selectedRfqId,
        target_currency: targetCurrency,
        destination_port: destinationPort.trim(),
        products: productsPayload,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (err: Error) => {
      if (err instanceof PricingValidationError) {
        setError(err.message);
        setResult(null);
        return;
      }
      // Backend unreachable/failed — compute a local approximate estimate
      // instead of just erroring, so disconnecting the backend doesn't break
      // the calculator (see localPricingFallback.ts).
      const productsPayload = buildProductsPayload();
      if (productsPayload.length > 0 && destinationPort.trim()) {
        setResult(calculateLocalFallback(productsPayload, targetCurrency, destinationPort.trim(), selectedRfqId));
        setError(null);
      } else {
        setError(err.message);
        setResult(null);
      }
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: () => {
      if (!result) throw new Error("ليس هناك نتائج للحساب");
      return quotationService.create({
        rfq_id: result.rfq_id,
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
      navigate(ROUTES.QUOTES.DETAIL(quote.id));
    },
  });

  const selectedRfq = rfqsData?.items?.find((r) => r.id === selectedRfqId);
  const hasProducts = !!products && products.length > 0;

  return {
    selectedRfqId,
    setSelectedRfqId,
    targetCurrency,
    setTargetCurrency,
    destinationPort,
    setDestinationPort,
    productInputs,
    setProductInputs,
    result,
    error,
    rfqsData,
    rfqsLoading,
    products,
    productsLoading,
    handleRfqChange,
    calculateMutation,
    createQuoteMutation,
    selectedRfq,
    hasProducts,
    navigate,
  };
}
