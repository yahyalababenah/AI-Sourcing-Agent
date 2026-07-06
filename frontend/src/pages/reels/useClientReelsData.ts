import { useQuery } from "@tanstack/react-query";
import { catalogService } from "@/services/catalogService";

/** Shared catalog fetch for the consumer-facing reels feed — browses the
 * global marketplace (unlike useReelsStudioData, which scopes to the
 * logged-in supplier's own products) so importers discover clips across
 * factories. Used by both ClientReelsPageDesktop and ClientReelsPageMobile
 * so neither duplicates the fetch (mirrors useReelsStudioData's role). */
export function useClientReelsData() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reels-marketplace-feed"],
    queryFn: () => catalogService.search({ page_size: 24 }),
  });

  return {
    products: data?.items ?? [],
    isLoading,
    isError,
    refetch,
  };
}
