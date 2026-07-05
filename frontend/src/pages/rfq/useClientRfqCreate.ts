import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ROUTES } from "@/constants/routes";
import { intakeService } from "@/services/intakeService";
import { useAuthStore } from "@/stores/authStore";
import { calculateLocalFallback } from "@/pages/pricing/localPricingFallback";
import type { RFQCreate } from "@/types/intake";
import type { CalculatePriceResponse } from "@/types/pricing";

export const CURRENCIES = [
  { value: "USD", label: "دولار أمريكي (USD)" },
  { value: "JOD", label: "دينار أردني (JOD)" },
];

/** Shared form/estimate/submit logic behind the client's structured RFQ
 * form (T8.1) — used by both RFQCreatePageDesktop and RFQCreatePageMobile so
 * the two layouts never duplicate business logic (same convention as
 * usePricingCalculator/useClientDashboardData in earlier phases).
 *
 * Backend contract (RFQCreate, see src/types/intake.ts) only accepts a
 * free-text Arabic description, not structured product/quantity/spec
 * fields — the AI intake pipeline extracts those server-side afterward.
 * So the structured inputs here are composed into that description text
 * (and also carried verbatim in extracted_entities) rather than requiring
 * a backend change. */
export function useClientRfqCreate() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [productName, setProductName] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [quantity, setQuantity] = useState("");
  const [targetPriceCny, setTargetPriceCny] = useState("");
  const [destinationPort, setDestinationPort] = useState("");
  const [targetCurrency, setTargetCurrency] = useState("USD");
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const quantityNum = Number(quantity);
  const priceNum = Number(targetPriceCny);
  const hasValidQuantity = quantity.trim() !== "" && quantityNum > 0;
  const hasEstimateInputs = hasValidQuantity && priceNum > 0;

  // No saved RFQ/product exists yet at this point in the flow, so the real
  // pricingService.calculate (which requires an rfq_id) can't be called —
  // this reuses the same local approximate engine the calculator falls back
  // to when the backend is unreachable (see localPricingFallback.ts).
  const estimate: CalculatePriceResponse | null = useMemo(() => {
    if (!hasEstimateInputs) return null;
    return calculateLocalFallback(
      [
        {
          product_id: "preview",
          name: productName.trim() || "المنتج",
          quantity: quantityNum,
          unit_price_cny: priceNum,
        },
      ],
      targetCurrency,
      destinationPort,
      "preview",
    );
  }, [hasEstimateInputs, productName, quantityNum, priceNum, targetCurrency, destinationPort]);

  const createMutation = useMutation({
    mutationFn: (data: RFQCreate) => intakeService.create(data),
    onSuccess: (rfq) => {
      navigate(ROUTES.RFQ.DETAIL(rfq.id));
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleImagesChange = (files: FileList | null) => {
    setImages(files ? Array.from(files) : []);
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const buildRequestText = () => {
    const lines = [`المنتج: ${productName.trim()}`, `الكمية: ${quantityNum.toLocaleString()} وحدة`];
    if (specifications.trim()) lines.push(`المواصفات: ${specifications.trim()}`);
    if (priceNum > 0) lines.push(`السعر المستهدف للوحدة: ${priceNum} يوان صيني`);
    return lines.join("\n");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!productName.trim()) {
      setError("يرجى إدخال اسم المنتج");
      return;
    }
    if (!hasValidQuantity) {
      setError("يرجى إدخال كمية صحيحة");
      return;
    }

    const payload: RFQCreate = {
      client_name: user?.full_name ?? "",
      client_phone: user?.phone,
      client_request_arabic: buildRequestText(),
      destination_port: destinationPort.trim() || undefined,
      target_currency: targetCurrency,
      extracted_entities: {
        product_name: productName.trim(),
        quantity: quantityNum,
        ...(specifications.trim() ? { specifications: specifications.trim() } : {}),
        ...(priceNum > 0 ? { target_price_cny: priceNum } : {}),
      },
    };

    createMutation.mutate(payload);
  };

  return {
    productName,
    setProductName,
    specifications,
    setSpecifications,
    quantity,
    setQuantity,
    targetPriceCny,
    setTargetPriceCny,
    destinationPort,
    setDestinationPort,
    targetCurrency,
    setTargetCurrency,
    images,
    handleImagesChange,
    handleRemoveImage,
    estimate,
    error,
    handleSubmit,
    isPending: createMutation.isPending,
    navigate,
  };
}
