/** A single product listing in the global B2B marketplace catalog. */
export interface CatalogProduct {
  id: string;
  product_name: string | null;
  model_number: string | null;
  unit_price_rmb: number | null;
  moq: number | null;
  weight_kg: number | null;
  dimensions: string | null;
  material: string | null;
  category: string | null;

  /** Supplier (agent) who owns this product. */
  supplier_id: string | null;
  supplier_name: string | null;
  factory_name: string | null;
  location_in_china: string | null;

  /** Source document reference. */
  document_id: string | null;
  document_file_name: string | null;
  extracted_at: string | null;

  review_status?: "pending" | "approved" | "rejected" | null;
}

/** Paginated catalog listing response. */
export interface CatalogListResponse {
  items: CatalogProduct[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
