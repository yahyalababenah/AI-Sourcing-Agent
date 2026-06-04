/** Tracking pipeline stages in order. */
export const TRACKING_PIPELINE = [
  "awaiting_payment",
  "production",
  "inland_freight",
  "sea_freight",
  "customs",
  "delivered",
] as const;

export type TrackingStatus = (typeof TRACKING_PIPELINE)[number];

/** A single tracking status change event. */
export interface TrackingEvent {
  id: string;
  quotation_id: string;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  changed_by_id: string | null;
  created_at: string;
}

/** Full tracking status response from the API. */
export interface TrackingStatusResponse {
  quotation_id: string;
  quotation_number: string;
  current_status: string | null;
  events: TrackingEvent[];
}

/** Request body for updating tracking status. */
export interface UpdateTrackingRequest {
  status: string;
  notes?: string;
}
