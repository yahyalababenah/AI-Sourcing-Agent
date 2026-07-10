import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { API } from "@/constants/api";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { useAuthStore } from "@/stores/authStore";
import type { OrderStatus } from "@/components/ui/StatusPill";
import type { ClientProfile, User } from "@/types/auth";
import type { RFQ } from "@/types/intake";

export type ClientRfqStatus = "open" | "processing" | "quoted" | "closed";

// Same RFQ→StatusPill mapping used by ClientDashboard, so the profile page's
// "طلباتي النشطة" tab reads identically to the dashboard's order list.
export const STATUS_PILL: Record<ClientRfqStatus, OrderStatus> = {
  open: "pending",
  processing: "under_review",
  quoted: "negotiating",
  closed: "completed",
};

interface ClientProfileEditFields {
  company_name: string;
  preferred_port: string;
  contact_number: string;
  phone: string;
}

/** Shared data + edit wiring for the importer profile showcase — used by
 * both ClientProfileDesktop and ClientProfileMobile so neither file
 * duplicates the RFQ/quote fetch or the "تعديل الملف" mutation (mirrors
 * useClientDashboardData's role). */
export function useClientProfileData() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();
  const profile = user?.profile as ClientProfile | undefined;

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<ClientProfileEditFields>({
    company_name: profile?.company_name ?? "",
    preferred_port: profile?.preferred_port ?? "",
    contact_number: profile?.contact_number ?? "",
    phone: user?.phone ?? "",
  });

  const rfqsQuery = useQuery({
    queryKey: ["client-profile-rfqs"],
    queryFn: () => intakeService.list({ limit: 50 }),
    staleTime: 15_000,
  });
  const quotesQuery = useQuery({
    queryKey: ["client-profile-quotes"],
    queryFn: () => quotationService.list({ limit: 100 }),
    staleTime: 15_000,
  });

  const rfqs = rfqsQuery.data?.items ?? [];
  const quotes = quotesQuery.data?.items ?? [];

  const quotesByRfq = new Map<string, number>();
  for (const q of quotes) {
    if (!quotesByRfq.has(q.rfq_id)) quotesByRfq.set(q.rfq_id, q.grand_total);
  }

  const closedRfqs = rfqs.filter((r) => r.status === "closed");
  const completedDealsCount = closedRfqs.length;

  // Honest average order value: mean grand_total of closed RFQs that
  // actually have a quotation attached — no fabricated number when none do.
  const closedValues = closedRfqs
    .map((r) => quotesByRfq.get(r.id))
    .filter((v): v is number => v != null);
  const avgOrderValue =
    closedValues.length > 0
      ? `$${Math.round(closedValues.reduce((a, b) => a + b, 0) / closedValues.length).toLocaleString()}`
      : "—";

  const activeRfqs: RFQ[] = rfqs
    .filter((r) => r.status === "open" || r.status === "processing" || r.status === "quoted")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const startEditing = () => {
    setForm({
      company_name: profile?.company_name ?? "",
      preferred_port: profile?.preferred_port ?? "",
      contact_number: profile?.contact_number ?? "",
      phone: user?.phone ?? "",
    });
    setIsEditing(true);
  };
  const cancelEditing = () => setIsEditing(false);
  const updateField = (key: keyof ClientProfileEditFields, value: string) =>
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
    companyName: profile?.company_name || user?.full_name || "شركة غير مسمّاة",
    preferredPort: profile?.preferred_port || "—",
    contactNumber: profile?.contact_number || "—",
    avatarUrl: profile?.avatar_url || null,
    bannerUrl: profile?.banner_url || null,
    isActive: !!user?.is_active,
    completedDealsCount,
    avgOrderValue,
    activeRfqs,
    isLoading: rfqsQuery.isLoading,
    isEditing,
    form,
    startEditing,
    cancelEditing,
    updateField,
    save: () => saveMutation.mutate(),
    isSaving: saveMutation.isPending,
  };
}
