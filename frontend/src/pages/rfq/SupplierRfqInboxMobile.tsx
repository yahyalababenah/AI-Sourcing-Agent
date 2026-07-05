import { AlertCircle, Globe, RefreshCw, Zap } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSupplierRfqInboxData } from "./useSupplierRfqInboxData";
import { MatchCard, PublicRfqCard } from "./SupplierInboxCards";

function CardSkeletonStack({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-3 p-5">
          <Skeleton className="h-5 w-3/4 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-9 w-full rounded" />
        </div>
      ))}
    </div>
  );
}

function ErrorRetry({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  return (
    <div className="card p-8 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{error instanceof Error ? error.message : "يرجى المحاولة مرة أخرى"}</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-supplier-500 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-supplier-600 active:scale-[0.98]"
      >
        <RefreshCw className="h-4 w-4" />
        إعادة المحاولة
      </button>
    </div>
  );
}

// Same shared hook/cards as SupplierRfqInboxDesktop, stacked in a single
// column: a full-width segmented tab control, then the list. TopBar/
// BottomNav/Drawer come from AgentLayout.
export function SupplierRfqInboxMobile() {
  const {
    activeTab,
    setActiveTab,
    now,
    matches,
    matchesLoading,
    matchesError,
    matchesErrorObj,
    refetchMatches,
    matchRfqMap,
    matchProductsMap,
    loadingMatchDetails,
    claimMutation,
    publicRfqs,
    publicLoading,
    publicError,
    publicErrorObj,
    refetchPublic,
    publicProductsMap,
    loadingPublicProducts,
    handleQuote,
    handleRefreshAll,
  } = useSupplierRfqInboxData();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">صندوق وارد طلبات التسعير</h1>
        <button
          onClick={handleRefreshAll}
          aria-label="تحديث"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          onClick={() => setActiveTab("exclusive")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 active:scale-[0.98] ${
            activeTab === "exclusive" ? "bg-white text-supplier-600 shadow-sm" : "text-slate-500"
          }`}
        >
          <Zap className="h-4 w-4" />
          الحصرية
        </button>
        <button
          onClick={() => setActiveTab("public")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 active:scale-[0.98] ${
            activeTab === "public" ? "bg-white text-supplier-600 shadow-sm" : "text-slate-500"
          }`}
        >
          <Globe className="h-4 w-4" />
          السوق العام
        </button>
      </div>

      {activeTab === "exclusive" ? (
        matchesLoading ? (
          <CardSkeletonStack count={3} />
        ) : matchesError ? (
          <ErrorRetry title="حدث خطأ أثناء تحميل المباريات" error={matchesErrorObj} onRetry={refetchMatches} />
        ) : matches.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="لا توجد مباريات حصرية حالياً"
            description="سيتم إشعارك عند وجود طلبات تسعير مطابقة لتخصصك"
          />
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                rfq={matchRfqMap[match.rfq_id]}
                products={matchProductsMap[match.rfq_id] ?? []}
                loadingDetails={loadingMatchDetails}
                now={now}
                onQuote={() => handleQuote(match.rfq_id)}
                onClaim={(action) => claimMutation.mutate({ matchId: match.id, action })}
                isPending={claimMutation.isPending}
              />
            ))}
          </div>
        )
      ) : publicLoading ? (
        <CardSkeletonStack count={3} />
      ) : publicError ? (
        <ErrorRetry title="حدث خطأ أثناء تحميل الطلبات العامة" error={publicErrorObj} onRetry={refetchPublic} />
      ) : publicRfqs.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="لا توجد طلبات في السوق العام حالياً"
          description="ستظهر هنا الطلبات التي انتهت مهلة المطابقة الحصرية لها"
        />
      ) : (
        <div className="space-y-4">
          {publicRfqs.map((rfq) => (
            <PublicRfqCard
              key={rfq.id}
              rfq={rfq}
              products={publicProductsMap[rfq.id] ?? []}
              loadingProducts={loadingPublicProducts}
              now={now}
              onQuote={() => handleQuote(rfq.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
