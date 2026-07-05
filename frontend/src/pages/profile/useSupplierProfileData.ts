import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { API } from "@/constants/api";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { useAuthStore } from "@/stores/authStore";
import { useReelsStudioData } from "@/pages/reels/useReelsStudioData";
import type { SupplierProfile, User } from "@/types/auth";

interface SupplierProfileEditFields {
  factory_name: string;
  location_in_china: string;
  specialty: string;
  factory_address: string;
  phone: string;
}

/** Shared data + edit wiring for the supplier profile showcase — used by
 * both SupplierProfileDesktop and SupplierProfileMobile so neither file
 * duplicates the RFQ/quote fetch, the catalog fetch (reused from
 * useReelsStudioData — same "my products" query the reels studio uses), or
 * the "تعديل الملف" mutation. Mirrors useClientProfileData's role. */
export function useSupplierProfileData() {
  const { products, isLoading: productsLoading, factoryName, isVerified } = useReelsStudioData();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();
  const profile = user?.profile as SupplierProfile | undefined;

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<SupplierProfileEditFields>({
    factory_name: profile?.factory_name ?? "",
    location_in_china: profile?.location_in_china ?? "",
    specialty: profile?.specialty ?? "",
    factory_address: profile?.factory_address ?? "",
    phone: user?.phone ?? "",
  });

  const rfqsQuery = useQuery({
    queryKey: ["supplier-profile-rfqs"],
    queryFn: () => intakeService.list({ limit: 100 }),
    staleTime: 15_000,
  });
  const quotesQuery = useQuery({
    queryKey: ["supplier-profile-quotes"],
    queryFn: () => quotationService.list({ limit: 100 }),
    staleTime: 15_000,
  });

  const rfqs = rfqsQuery.data?.items ?? [];
  const quotes = quotesQuery.data?.items ?? [];

  const closedDealsCount = rfqs.filter((r) => r.status === "closed").length;

  const firstQuoteAtByRfq = new Map<string, string>();
  for (const q of quotes) {
    const existing = firstQuoteAtByRfq.get(q.rfq_id);
    if (!existing || new Date(q.created_at) < new Date(existing)) {
      firstQuoteAtByRfq.set(q.rfq_id, q.created_at);
    }
  }

  // Honest average response time: hours between an RFQ's creation and this
  // supplier's first quote on it, averaged over RFQs that actually got one
  // — same "no fabricated number" stance as useClientDashboardData.
  const responseHours = rfqs
    .map((r) => {
      const quotedAt = firstQuoteAtByRfq.get(r.id);
      if (!quotedAt) return null;
      const hours = (new Date(quotedAt).getTime() - new Date(r.created_at).getTime()) / 3_600_000;
      return hours > 0 ? hours : null;
    })
    .filter((h): h is number => h != null);
  const avgResponseHours =
    responseHours.length > 0 ? Math.round(responseHours.reduce((a, b) => a + b, 0) / responseHours.length) : null;

  const startEditing = () => {
    setForm({
      factory_name: profile?.factory_name ?? "",
      location_in_china: profile?.location_in_china ?? "",
      specialty: profile?.specialty ?? "",
      factory_address: profile?.factory_address ?? "",
      phone: user?.phone ?? "",
    });
    setIsEditing(true);
  };
  const cancelEditing = () => setIsEditing(false);
  const updateField = (key: keyof SupplierProfileEditFields, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: () => api.patch<User>(API.AUTH.ME, form).then((r) => r.data),
    onSuccess: (updated) => {
      setUser(updated);
      qc.invalidateQueries({ queryKey: ["profile-me"] });
      toast.success("تم حفظ التغييرات");
      setIsEditing(false);
    },
    onError: () => toast.error("تعذّر حفظ التغييرات — حاول مجدداً"),
  });

  return {
    user,
    factoryName,
    isVerified,
    products,
    productsLoading,
    location: profile?.location_in_china || "—",
    specialty: profile?.specialty || "—",
    factoryAddress: profile?.factory_address || "—",
    closedDealsCount,
    avgResponseLabel: avgResponseHours != null ? `${avgResponseHours}h` : "—",
    isEditing,
    form,
    startEditing,
    cancelEditing,
    updateField,
    save: () => saveMutation.mutate(),
    isSaving: saveMutation.isPending,
  };
}
