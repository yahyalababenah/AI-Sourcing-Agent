import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { monitoringService } from "@/services/monitoringService";
import type { UserListItem, UpdateVerificationPayload } from "@/services/monitoringService";
import { ShieldCheck, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";

type FilterTab = "all" | "pending" | "verified" | "rejected";

const STATUS_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "pending", label: "قيد الانتظار" },
  { key: "verified", label: "موثَّق" },
  { key: "rejected", label: "مرفوض" },
];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  verified: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد الانتظار",
  verified: "موثَّق",
  rejected: "مرفوض",
};

export function AdminVerificationPage() {
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const queryClient = useQueryClient();

  // Fetch suppliers (agent role) with optional verification_status filter
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users", "agent", filter],
    queryFn: () =>
      monitoringService.listUsers({
        role: "agent",
        verification_status: filter === "all" ? undefined : filter,
      }),
  });

  // Filter to only suppliers with a profile
  const suppliers: UserListItem[] =
    data?.items.filter((u) => u.profile && "verification_status" in u.profile) ?? [];

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: UpdateVerificationPayload;
    }) => monitoringService.updateVerificationStatus(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setRejectingId(null);
      setRejectionReason("");
    },
  });

  const handleVerify = (userId: string) => {
    verifyMutation.mutate({
      userId,
      payload: { verification_status: "verified" },
    });
  };

  const handleReject = (userId: string) => {
    if (!rejectionReason.trim()) return;
    verifyMutation.mutate({
      userId,
      payload: { verification_status: "rejected", rejection_reason: rejectionReason.trim() },
    });
  };

  const handleReset = (userId: string) => {
    verifyMutation.mutate({
      userId,
      payload: { verification_status: "pending" },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">توثيق الموردين</h1>
          <p className="mt-1 text-sm text-gray-500">
            مراجعة طلبات تسجيل الموردين والموافقة عليها أو رفضها
          </p>
        </div>
        <ShieldCheck className="h-10 w-10 text-primary-600" />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-primary-100 text-primary-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <span className="mr-3 text-gray-500">جاري التحميل...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card p-8 text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-4 text-gray-600">حدث خطأ أثناء تحميل بيانات الموردين</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && suppliers.length === 0 && (
        <div className="card p-12 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-lg font-medium text-gray-900">
            {filter === "pending"
              ? "لا يوجد موردون بانتظار التوثيق"
              : filter === "verified"
              ? "لا يوجد موردون موثَّقون"
              : filter === "rejected"
              ? "لا يوجد موردون مرفوضون"
              : "لا يوجد موردون"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {filter === "pending"
              ? "عندما يسجل مورد جديد، سيظهر هنا للمراجعة"
              : ""}
          </p>
        </div>
      )}

      {/* Supplier Cards */}
      {!isLoading && !error && suppliers.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((supplier) => {
            const profile = supplier.profile as any;
            const status = profile?.verification_status ?? "pending";
            const isLoadingAction =
              verifyMutation.isPending &&
              verifyMutation.variables?.userId === supplier.id;

            return (
              <div
                key={supplier.id}
                className="card flex flex-col gap-4 p-6 transition-shadow hover:shadow-md"
              >
                {/* Header: Name + Status */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {supplier.full_name}
                    </h3>
                    <p className="text-sm text-gray-500">{supplier.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      STATUS_BADGE[status] ?? "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {STATUS_LABEL[status] ?? status}
                  </span>
                </div>

                {/* Factory Info */}
                {profile && (
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      <span className="font-medium text-gray-800">المصنع:</span>{" "}
                      {profile.factory_name}
                    </p>
                    <p>
                      <span className="font-medium text-gray-800">الموقع:</span>{" "}
                      {profile.location_in_china}
                    </p>
                    {profile.specialty && (
                      <p>
                        <span className="font-medium text-gray-800">الاختصاص:</span>{" "}
                        {profile.specialty}
                      </p>
                    )}
                    {profile.business_registration_number && (
                      <p>
                        <span className="font-medium text-gray-800">رقم التسجيل:</span>{" "}
                        {profile.business_registration_number}
                      </p>
                    )}
                    {profile.factory_address && (
                      <p>
                        <span className="font-medium text-gray-800">العنوان:</span>{" "}
                        {profile.factory_address}
                      </p>
                    )}
                    {profile.business_license_url && (
                      <a
                        href={profile.business_license_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>الرخصة التجارية</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto flex gap-2 border-t border-gray-100 pt-4">
                  {status === "pending" && (
                    <>
                      <button
                        onClick={() => handleVerify(supplier.id)}
                        disabled={isLoadingAction}
                        className="btn btn-primary flex flex-1 items-center justify-center gap-2"
                      >
                        {isLoadingAction ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        توثيق
                      </button>
                      <button
                        onClick={() => setRejectingId(supplier.id)}
                        disabled={isLoadingAction}
                        className="btn flex flex-1 items-center justify-center gap-2 border border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4" />
                        رفض
                      </button>
                    </>
                  )}
                  {status === "verified" && (
                    <button
                      onClick={() => handleReset(supplier.id)}
                      disabled={isLoadingAction}
                      className="btn flex flex-1 items-center justify-center gap-2 border border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                    >
                      إعادة إلى قيد الانتظار
                    </button>
                  )}
                  {status === "rejected" && (
                    <button
                      onClick={() => handleReset(supplier.id)}
                      disabled={isLoadingAction}
                      className="btn flex flex-1 items-center justify-center gap-2 border border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                    >
                      إعادة إلى قيد الانتظار
                    </button>
                  )}
                </div>

                {/* Rejection Reason Input */}
                {rejectingId === supplier.id && (
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    <label className="block text-sm font-medium text-gray-700">
                      سبب الرفض
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary-500 focus:outline-none"
                      placeholder="اذكر سبب الرفض..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(supplier.id)}
                        disabled={!rejectionReason.trim() || isLoadingAction}
                        className="btn flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        تأكيد الرفض
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectionReason("");
                        }}
                        className="btn border border-gray-300 text-gray-700"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
