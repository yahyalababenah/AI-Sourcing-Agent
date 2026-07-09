import { GlossaryTerm } from "@/components/ui/GlossaryTerm";
import { AlertCircle, Globe, RefreshCw, Zap } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSupplierRfqInboxData } from "./useSupplierRfqInboxData";
import { MatchCard, PublicRfqCard } from "./SupplierInboxCards";

function CardSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
    <div className="card p-12 text-center">
      <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
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

// Desktop layout (T8.2): tabs + refresh in the header row, cards in a
// responsive grid (grid-cols-1/2/3) — same shared hook/card components as
// SupplierRfqInboxMobile, which instead stacks a single column under
// TopBar/BottomNav. No supplier-rfq-inbox-*.html reference exists (same
// gap as T6.3/T7.x) — built from CLAUDE.md's role-color/RTL rules and this
// page's existing (recolored) production logic.
export function SupplierRfqInboxDesktop() {
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
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">صندوق وارد طلبات التسعير</h1>
            <p className="mt-1 text-slate-500">تصفح طلبات العروض الحصرية والعامة وقدّم عرض سعر فوري</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => setActiveTab("exclusive")}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 active:scale-[0.98] ${
                  activeTab === "exclusive" ? "bg-white text-supplier-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Zap className="h-4 w-4" />
                <GlossaryTerm term="Exclusive Match">المباريات الحصرية</GlossaryTerm>
              </button>
              <button
                onClick={() => setActiveTab("public")}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 active:scale-[0.98] ${
                  activeTab === "public" ? "bg-white text-supplier-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Globe className="h-4 w-4" />
                <GlossaryTerm term="Public Market">السوق العام</GlossaryTerm>
              </button>
            </div>
            <button
              onClick={handleRefreshAll}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" />
              تحديث
            </button>
          </div>
        </div>
      </div>

      {activeTab === "exclusive" ? (
        matchesLoading ? (
          <CardSkeletonGrid count={4} />
        ) : matchesError ? (
          <ErrorRetry title="حدث خطأ أثناء تحميل المباريات" error={matchesErrorObj} onRetry={refetchMatches} />
        ) : matches.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="لا توجد مباريات حصرية حالياً"
            description="سيتم إشعارك عند وجود طلبات تسعير مطابقة لتخصصك"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        <CardSkeletonGrid count={6} />
      ) : publicError ? (
        <ErrorRetry title="حدث خطأ أثناء تحميل الطلبات العامة" error={publicErrorObj} onRetry={refetchPublic} />
      ) : publicRfqs.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="لا توجد طلبات في السوق العام حالياً"
          description="ستظهر هنا الطلبات التي انتهت مهلة المطابقة الحصرية لها"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
