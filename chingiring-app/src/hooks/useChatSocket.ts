/**
 * useChatSocket — Socket.io connection to the /chat namespace for one thread.
 *
 * Mirrors useSocket (streams): async token read before connect, auto join/leave
 * the conversation, stable callback refs so re-renders don't reconnect. Message
 * *sending* goes through the REST endpoint (api/chat.sendMessage); this hook
 * only receives new_message / typing / read events and relays typing.
 *
 * Dedupe note: the backend echoes new_message to the sender's own room too, so
 * the ChatScreen must dedupe appended messages by _id.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import type { ChatMessage, ChatOffer } from '../api/chat';

export interface UseChatSocketOptions {
  /** The conversation to join. null/undefined suspends the connection. */
  conversationId: string | null | undefined;
  onNewMessage?: (msg: ChatMessage) => void;
  onTyping?: () => void;
  onStopTyping?: () => void;
  onMessagesRead?: (info: { readerRole: 'buyer' | 'seller'; at: number }) => void;
  /** A pending offer was accepted/declined — patch that message's offer.status. */
  onOfferUpdated?: (info: { messageId: string; offer: ChatOffer }) => void;
}

async function readAccessToken(): Promise<string | null> {
  try {
    if (Platform.OS !== 'web') {
      return await SecureStore.getItemAsync('accessToken');
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('accessToken');
    }
  } catch {
    // SecureStore may throw on first boot or in tests — treat as no token.
  }
  return null;
}

export function useChatSocket({
  conversationId,
  onNewMessage,
  onTyping,
  onStopTyping,
  onMessagesRead,
  onOfferUpdated,
}: UseChatSocketOptions): {
  sendTyping: () => void;
  sendStopTyping: () => void;
} {
  const socketRef = useRef<Socket | null>(null);

  // Stable callback refs — updated every render so callers never stale-close,
  // but changes do NOT re-trigger the socket effect.
  const cbRef = useRef({ onNewMessage, onTyping, onStopTyping, onMessagesRead, onOfferUpdated });
  useEffect(() => {
    cbRef.current = { onNewMessage, onTyping, onStopTyping, onMessagesRead, onOfferUpdated };
  });

  useEffect(() => {
    if (!conversationId) return;

    let mounted = true;
    let socket: Socket | null = null;

    const baseURL: string = (apiClient.defaults.baseURL as string) ?? 'http://localhost:8000';

    (async () => {
      const token = await readAccessToken();
      if (!mounted) return;

      socket = io(`${baseURL}/chat`, {
        transports: ['websocket'],
        auth: token ? { token } : {},
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket!.emit('join_conversation', { conversationId });
      });

      socket.on(
        'new_message',
        (payload: { conversationId: string; message: ChatMessage }) => {
          if (payload?.conversationId === conversationId) {
            cbRef.current.onNewMessage?.(payload.message);
          }
        },
      );

      socket.on('typing', ({ conversationId: cid }: { conversationId: string }) => {
        if (cid === conversationId) cbRef.current.onTyping?.();
      });
      socket.on('stop_typing', ({ conversationId: cid }: { conversationId: string }) => {
        if (cid === conversationId) cbRef.current.onStopTyping?.();
      });

      socket.on(
        'messages_read',
        (info: { conversationId: string; readerRole: 'buyer' | 'seller'; at: number }) => {
          if (info?.conversationId === conversationId) {
            cbRef.current.onMessagesRead?.({ readerRole: info.readerRole, at: info.at });
          }
        },
      );

      socket.on(
        'offer_updated',
        (info: { conversationId: string; messageId: string; offer: ChatOffer }) => {
          if (info?.conversationId === conversationId && info.offer) {
            cbRef.current.onOfferUpdated?.({ messageId: info.messageId, offer: info.offer });
          }
        },
      );
    })();

    return () => {
      mounted = false;
      if (socket) {
        socket.emit('leave_conversation', { conversationId });
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [conversationId]);

  const sendTyping = useCallback(() => {
    if (conversationId) socketRef.current?.emit('typing', { conversationId });
  }, [conversationId]);

  const sendStopTyping = useCallback(() => {
    if (conversationId) socketRef.current?.emit('stop_typing', { conversationId });
  }, [conversationId]);

  return { sendTyping, sendStopTyping };
}
