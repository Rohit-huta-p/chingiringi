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
import type { StreamProductLite } from '../api/streams';

// ── Public types ────────────────────────────────────────────────────────────

export interface LiveChatMsg {
  /** Client-generated unique key (safe for FlatList keyExtractor). */
  id: string;
  user: { name: string; avatarUrl?: string } | null;
  text: string;
  timestamp: string;
  /** True when the sender is the stream's broadcaster (shows an "Author" badge). */
  isAuthor?: boolean;
}

/** The broadcaster's pinned message, or null when nothing is pinned. */
export interface PinnedMsg {
  text: string;
  userName?: string | null;
  avatarUrl?: string | null;
  isAuthor?: boolean;
}

export interface UseSocketOptions {
  /** The stream to join. Passing null/undefined suspends the connection. */
  streamId: string | null | undefined;
  onViewerCount?: (count: number) => void;
  onHeartBurst?: (count: number) => void;
  onNewChat?: (msg: LiveChatMsg) => void;
  onStreamEnded?: () => void;
  /** The broadcaster changed the featured set — refresh the live shelf. */
  onProductsUpdated?: (products: StreamProductLite[]) => void;
  /** The broadcaster pinned a message (null = unpinned). */
  onPinned?: (pinned: PinnedMsg | null) => void;
  /** The broadcaster spotlighted a product ("Show"), or null when cleared. */
  onSpotlight?: (productId: string | null) => void;
  /** False for the broadcaster's own connection so it isn't counted as a viewer. Default true. */
  countAsViewer?: boolean;
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
  onProductsUpdated,
  onPinned,
  onSpotlight,
  countAsViewer = true,
}: UseSocketOptions): {
  sendHeart: () => void;
  sendChat: (text: string) => void;
  pinMessage: (m: LiveChatMsg) => void;
  unpinMessage: () => void;
  setSpotlight: (productId: string | null) => void;
} {
  const socketRef = useRef<Socket | null>(null);

  // Stable callback refs — updated every render so callers never stale-close,
  // but changes do NOT re-trigger the socket effect.
  const cbRef = useRef({ onViewerCount, onHeartBurst, onNewChat, onStreamEnded, onProductsUpdated, onPinned, onSpotlight });
  useEffect(() => {
    cbRef.current = { onViewerCount, onHeartBurst, onNewChat, onStreamEnded, onProductsUpdated, onPinned, onSpotlight };
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

      console.log('[socket] connecting →', `${baseURL}/stream`, '| hasToken=', !!token);
      socket = io(`${baseURL}/stream`, {
        // Allow polling fallback — websocket-only silently fails to connect
        // through some tunnels/proxies (e.g. Cloudflare), which killed the
        // viewer count.
        transports: ['websocket', 'polling'],
        auth: token ? { token } : {},
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      // Join stream room as soon as the socket is connected (or reconnected).
      socket.on('connect', () => {
        console.log('[socket] connected', socket!.id, '→ join_stream', streamId, '| countAsViewer=', countAsViewer, '| transport=', socket!.io?.engine?.transport?.name);
        socket!.emit('join_stream', { streamId, countAsViewer });
      });

      // ── Diagnostics: surface WHY real-time events may not arrive on-device ──
      socket.on('connect_error', (err: any) => {
        console.log('[socket] connect_error:', err?.message);
      });
      socket.on('disconnect', (reason) => {
        console.log('[socket] disconnect:', reason);
      });
      socket.io.on('reconnect', (n) => {
        console.log('[socket] reconnected after', n, 'attempt(s) — re-joining on connect');
      });
      socket.io.on('reconnect_failed', () => {
        console.log('[socket] reconnect_failed — real-time events will stop arriving');
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
        (msg: { streamId: string; user: { name?: string; avatarUrl?: string } | null; text: string; timestamp: string; isAuthor?: boolean }) => {
          const displayName =
            msg.user?.name ?? 'Guest';
          cbRef.current.onNewChat?.({
            // Use a composite key: timestamp + random suffix ensures uniqueness
            // even when the same message arrives in back-to-back frames.
            id: `${msg.timestamp}-${Math.random().toString(36).slice(2, 7)}`,
            user: msg.user ? { name: displayName, avatarUrl: msg.user.avatarUrl } : null,
            text: msg.text,
            timestamp: msg.timestamp,
            isAuthor: !!msg.isAuthor,
          });
        },
      );

      socket.on('stream_ended', () => {
        cbRef.current.onStreamEnded?.();
      });

      socket.on(
        'stream_products_updated',
        ({ products }: { streamId: string; products: StreamProductLite[] }) => {
          cbRef.current.onProductsUpdated?.(products ?? []);
        },
      );

      socket.on(
        'message_pinned',
        ({ pinned }: { streamId: string; pinned: PinnedMsg | null }) => {
          cbRef.current.onPinned?.(pinned ?? null);
        },
      );
      socket.on('message_unpinned', () => {
        cbRef.current.onPinned?.(null);
      });

      socket.on(
        'stream_spotlight',
        ({ productId }: { streamId: string; productId: string | null }) => {
          cbRef.current.onSpotlight?.(productId ?? null);
        },
      );
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

  /** Broadcaster: pin a message for everyone (the server ignores non-hosts). */
  const pinMessage = useCallback(
    (m: LiveChatMsg) => {
      if (streamId) {
        socketRef.current?.emit('pin_message', {
          streamId,
          message: { text: m.text, user: m.user, isAuthor: m.isAuthor },
        });
      }
    },
    [streamId],
  );

  /** Broadcaster: clear the pinned message. */
  const unpinMessage = useCallback(() => {
    if (streamId) socketRef.current?.emit('unpin_message', { streamId });
  }, [streamId]);

  /** Broadcaster: spotlight a product live (null clears it). */
  const setSpotlight = useCallback(
    (productId: string | null) => {
      if (streamId) socketRef.current?.emit('set_spotlight', { streamId, productId });
    },
    [streamId],
  );

  return { sendHeart, sendChat, pinMessage, unpinMessage, setSpotlight };
}
