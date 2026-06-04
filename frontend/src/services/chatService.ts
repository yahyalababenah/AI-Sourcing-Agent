import { api } from "@/lib/api";
import type {
  ChatRoom,
  ChatMessage,
  RoomListResponse,
  MessageListResponse,
  CreateRoomRequest,
  SendMessageRequest,
} from "@/types/chat";

/**
 * Chat API service — rooms and messages.
 * The chat router is mounted at /api/v1/chat.
 */
export const chatService = {
  /** Create a new chat room between current user and a supplier. */
  createRoom: (data: CreateRoomRequest) =>
    api.post<ChatRoom>("/v1/chat/rooms", data).then((r) => r.data),

  /** List all chat rooms for the current user (with last message preview). */
  listRooms: () =>
    api.get<RoomListResponse>("/v1/chat/rooms").then((r) => r.data),

  /** Get a single room by ID. */
  getRoom: (id: string) =>
    api.get<ChatRoom>(`/v1/chat/rooms/${id}`).then((r) => r.data),

  /** Get paginated messages for a room. */
  getMessages: (roomId: string, page = 1, pageSize = 50) =>
    api
      .get<MessageListResponse>(`/v1/chat/rooms/${roomId}/messages`, {
        params: { page, page_size: pageSize },
      })
      .then((r) => r.data),

  /** Send a message. */
  sendMessage: (roomId: string, data: SendMessageRequest) =>
    api
      .post<ChatMessage>(`/v1/chat/rooms/${roomId}/messages`, data)
      .then((r) => r.data),

  /**
   * Build the SSE stream URL for a room.
   * Used by the custom EventSource hook (headers not needed — token embedded via api interceptor falls back to cookie/param).
   */
  getStreamUrl: (roomId: string) => `/api/v1/chat/rooms/${roomId}/stream`,
};
