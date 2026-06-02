export interface DocumentUploadResponse {
  id: string;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
  status: string;
  created_at: string;
}

export interface Document {
  id: string;
  rfq_id: string;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
  status: string;
  media_type: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  items: Document[];
  total: number;
}

export interface DocumentStatusResponse {
  id: string;
  status: string;
  error_message?: string;
  processing_started_at?: string;
  processing_completed_at?: string;
}

export interface ProductItem {
  product_name: string;
  model_number?: string;
  unit_price_rmb?: number;
  moq?: number;
  weight_kg?: number;
  dimensions?: string;
  material?: string;
}

export interface ItemsUpdateRequest {
  items: ProductItem[];
}

export interface ItemsUpdateResponse {
  id: string;
  items: ProductItem[];
  updated_at: string;
}
