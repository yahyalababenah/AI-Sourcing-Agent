/** A single chat room between a client and a supplier. */
export interface ChatRoom {
  id: string;
  rfq_id: string | null;
  client_id: string;
  supplier_id: string;
  status: "active" | "closed";
  client_name: string;
  supplier_name: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

export interface RoomListResponse {
  items: ChatRoom[];
  total: number;
}

export interface CreateRoomRequest {
  supplier_id: string;
  rfq_id?: string;
}

/** A single message within a chat room. */
export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  original_content: string | null;
  source_lang: string;
  target_lang: string | null;
  is_translated: boolean;
  created_at: string;
  read_at: string | null;
}

export interface MessageListResponse {
  items: ChatMessage[];
  total: number;
  page: number;
  page_size: number;
}

export interface SendMessageRequest {
  content: string;
  source_lang?: string;
}
