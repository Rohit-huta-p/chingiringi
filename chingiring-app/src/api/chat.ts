/**
 * api/chat.ts — Buyer ⇄ seller messaging endpoints.
 *
 * Backend module: backend/src/modules/chat. Responses use the standard
 * { status, data: { … } } envelope, so payloads live at res.data.data.
 */
import apiClient from './client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatOtherParty {
  /** 'store' when the caller is the buyer; 'user' (the buyer) when the caller is the seller. */
  kind: 'store' | 'user';
  id: string;
  name: string;
  avatarUrl?: string;
  /** Present when kind==='store' — lets a buyer tap through to the store profile. */
  storeId?: string;
}

export interface Conversation {
  _id: string;
  /** The CALLER's side in this thread. */
  role: 'buyer' | 'seller';
  otherParty: ChatOtherParty;
  storeId: string;
  lastMessage: string;
  lastMessageAt: string | null;
  lastSenderId: string | null;
  /** The caller's own unread count. */
  unread: number;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'buyer' | 'seller';
  text: string;
  createdAt: string;
  readAt: string | null;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/** GET /api/chat/conversations — the caller's inbox, newest activity first. */
export async function getConversations(): Promise<Conversation[]> {
  try {
    const res = await apiClient.get('/api/chat/conversations');
    return res.data?.data?.conversations ?? [];
  } catch {
    return []; // graceful — empty inbox on failure
  }
}

/**
 * POST /api/chat/conversations — buyer opens (or reuses) a thread with a store.
 * Throws on failure so the caller can surface "couldn't start chat".
 */
export async function getOrCreateConversation(storeId: string): Promise<Conversation | null> {
  const res = await apiClient.post('/api/chat/conversations', { storeId });
  return res.data?.data?.conversation ?? null;
}

/** GET /api/chat/conversations/:id/messages — thread history (oldest → newest). */
export async function getMessages(conversationId: string, limit = 50): Promise<ChatMessage[]> {
  try {
    const res = await apiClient.get(`/api/chat/conversations/${conversationId}/messages`, {
      params: { limit },
    });
    return res.data?.data?.messages ?? [];
  } catch {
    return [];
  }
}

/**
 * POST /api/chat/conversations/:id/messages — send. Throws on failure so the
 * composer can keep the text and show an error.
 */
export async function sendMessage(conversationId: string, text: string): Promise<ChatMessage | null> {
  const res = await apiClient.post(`/api/chat/conversations/${conversationId}/messages`, { text });
  return res.data?.data?.message ?? null;
}

/**
 * POST /api/chat/conversations/:id/read — clear the caller's unread. Best-effort;
 * used when a message lands while the thread is already open.
 */
export async function markConversationRead(conversationId: string): Promise<void> {
  try {
    await apiClient.post(`/api/chat/conversations/${conversationId}/read`);
  } catch {
    // non-fatal — the next getMessages() will reconcile
  }
}

/** GET /api/chat/unread — total unread across all threads (header badge). */
export async function getUnreadTotal(): Promise<number> {
  try {
    const res = await apiClient.get('/api/chat/unread');
    return res.data?.data?.count ?? 0;
  } catch {
    return 0;
  }
}
