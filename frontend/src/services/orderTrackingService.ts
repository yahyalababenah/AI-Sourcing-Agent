import { api } from "@/lib/api";
import { API } from "@/constants/api";
import type {
  TrackingStatusResponse,
  UpdateTrackingRequest,
} from "@/types/orders";

export const orderTrackingService = {
  /** Get tracking status and event history for an order. */
  getTracking: (quotationId: string) =>
    api
      .get<TrackingStatusResponse>(API.QUOTES.TRACKING(quotationId))
      .then((r) => r.data),

  /** Update tracking status (agent/admin only). */
  updateTracking: (quotationId: string, data: UpdateTrackingRequest) =>
    api
      .put<TrackingStatusResponse>(API.QUOTES.TRACKING(quotationId), data)
      .then((r) => r.data),
};
