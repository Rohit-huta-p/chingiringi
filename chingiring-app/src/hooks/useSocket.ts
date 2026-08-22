/**
 * useSocket — manages a Socket.io connection to the /stream namespace.
 *
 * Used by ViewerScreen (and later BroadcasterScreen) for real-time events.
 *
 * Features
 * ─────────
 * • Async token retrieval before connecting (Bearer auth; guests allowed with
 *   no token — backend falls back to 'Guest' for chat display name).
 * • Auto-join the given streamId as soon as the socket connects; auto-leave
 *   and disconnect on unmount or when streamId changes.
 * • Stable callback refs — parent can update callbacks on every render without
 *   triggering a socket reconnect.
 * • sendHeart / sendChat action functions (stable, safe to put in dep arrays).
 *
 * Usage
 * ─────
 *   const { sendHeart, sendChat } = useSocket({
 *     streamId,
 *     onViewerCount: (n) => setViewerCount(n),
 *     onHeartBurst:  (n) => spawnHearts(n),
 *     onNewChat:     (msg) => setMessages(prev => [...prev, msg]),
 *     onStreamEnded: () => setEnded(true),
 *   });
 */

import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';

// ── Public types ────────────────────────────────────────────────────────────

export interface LiveChatMsg {
  /** Client-generated unique key (safe for FlatList keyExtractor). */
  id: string;
  user: { name: string; avatarUrl?: string } | null;
  text: string;
  timestamp: string;
}

export interface UseSocketOptions {
  /** The stream to join. Passing null/undefined suspends the connection. */
  streamId: string | null | undefined;
  onViewerCount?: (count: number) => void;
  onHeartBurst?: (count: number) => void;
  onNewChat?: (msg: LiveChatMsg) => void;
  onStreamEnded?: () => void;
}

// ── Token helper (cross-platform) ──────────────────────────────────────────

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

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSocket({
  streamId,
  onViewerCount,
  onHeartBurst,
  onNewChat,
  onStreamEnded,
}: UseSocketOptions): {
  sendHeart: () => void;
  sendChat: (text: string) => void;
} {
  const socketRef = useRef<Socket | null>(null);

  // Stable callback refs — updated every render so callers never stale-close,
  // but changes do NOT re-trigger the socket effect.
  const cbRef = useRef({ onViewerCount, onHeartBurst, onNewChat, onStreamEnded });
  useEffect(() => {
    cbRef.current = { onViewerCount, onHeartBurst, onNewChat, onStreamEnded };
  });

  // Connect / disconnect effect — re-runs only when streamId changes.
  useEffect(() => {
    if (!streamId) return;

    let mounted = true;
    let socket: Socket | null = null;

    const baseURL: string = (apiClient.defaults.baseURL as string) ?? 'http://localhost:8000';

    // Async setup — read token before connecting so auth is attached from
    // the very first socket.io handshake (avoids a re-auth round-trip).
    (async () => {
      const token = await readAccessToken();
      if (!mounted) return; // component unmounted while we were reading the token

      socket = io(`${baseURL}/stream`, {
        transports: ['websocket'],
        auth: token ? { token } : {},
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      // Join stream room as soon as the socket is connected (or reconnected).
      socket.on('connect', () => {
        socket!.emit('join_stream', { streamId });
      });

      // ── Server → client events ──────────────────────────────────────────

      socket.on(
        'viewer_count_update',
        ({ count }: { streamId: string; count: number }) => {
          cbRef.current.onViewerCount?.(count);
        },
      );

      socket.on(
        'heart_burst',
        ({ count }: { streamId: string; count: number }) => {
          cbRef.current.onHeartBurst?.(count);
        },
      );

      socket.on(
        'new_chat',
        (msg: { streamId: string; user: { name?: string; username?: string; avatarUrl?: string } | null; text: string; timestamp: string }) => {
          const displayName =
            msg.user?.name ?? msg.user?.username ?? 'Guest';
          cbRef.current.onNewChat?.({
            // Use a composite key: timestamp + random suffix ensures uniqueness
            // even when the same message arrives in back-to-back frames.
            id: `${msg.timestamp}-${Math.random().toString(36).slice(2, 7)}`,
            user: msg.user ? { name: displayName, avatarUrl: msg.user.avatarUrl } : null,
            text: msg.text,
            timestamp: msg.timestamp,
          });
        },
      );

      socket.on('stream_ended', () => {
        cbRef.current.onStreamEnded?.();
      });
    })();

    return () => {
      mounted = false;
      if (socket) {
        // Politely leave before disconnecting — the server will also clean up
        // on disconnect, but emitting leave lets it flush the viewer count
        // atomically rather than relying on the disconnect timeout.
        socket.emit('leave_stream', { streamId });
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [streamId]); // reconnect only if streamId changes

  // ── Client → server actions ─────────────────────────────────────────────

  /** Emit a heart reaction. Ignored if the socket is not connected. */
  const sendHeart = useCallback(() => {
    if (streamId) {
      socketRef.current?.emit('heart_reaction', { streamId });
    }
  }, [streamId]);

  /** Emit a chat message. Ignored if the socket is not connected. */
  const sendChat = useCallback(
    (text: string) => {
      if (streamId && text.trim()) {
        socketRef.current?.emit('chat_message', { streamId, text: text.trim() });
      }
    },
    [streamId],
  );

  return { sendHeart, sendChat };
}
