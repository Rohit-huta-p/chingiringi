import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Image, ScrollView,
} from 'react-native';
import {
  GestureHandlerRootView, Gesture, GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Check, GripVertical } from 'lucide-react-native';
import { Fonts } from '../constants/theme';
import { Banner, BannerSide, BannerType } from '../api/banners';

const MIN_ROWS = 5;
// Approx vertical distance between adjacent gaps, mapping a drag to a gap delta.
const SLOT_STEP = 88;
const NEW_KEY = '__new__';

type PreviewBanner = {
  type?: BannerType;
  title?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  right?: BannerSide;
};

function toPreview(b: Banner): PreviewBanner {
  return {
    type: b.type,
    title: b.title,
    imageUrl: b.imageUrl,
    mobileImageUrl: b.mobileImageUrl,
    right: b.right,
  };
}

// ─── Mock pieces ──────────────────────────────────────────────────────────────

function NavStub() {
  return (
    <View style={s.nav}>
      <View style={s.navSearch} />
      <View style={s.navAvatar} />
    </View>
  );
}

function DummyRow() {
  return (
    <View style={s.row}>
      {[0, 1, 2, 3].map((k) => (
        <View key={k} style={s.dummyCard} />
      ))}
    </View>
  );
}

function MiniFace({ side, style }: { side: PreviewBanner | BannerSide; style?: any }) {
  const image = (side as any).imageUrl || (side as any).mobileImageUrl;
  return (
    <View style={[s.mini, style]}>
      {image ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={['#4784E2', '#2E6BD0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <Text style={s.miniTxt} numberOfLines={1}>
        {(side as any).title || 'Banner'}
      </Text>
    </View>
  );
}

function MiniBanner({ banner }: { banner: PreviewBanner }) {
  if (banner.type === 'dual') {
    return (
      <View style={s.miniRow}>
        <MiniFace side={banner} style={s.flex1} />
        <MiniFace side={banner.right ?? {}} style={s.flex1} />
      </View>
    );
  }
  return <MiniFace side={banner} />;
}

// ─── Modal ──────────────────────────────────────────────────────────────────
//
// Arrangement board: every banner shows at its own gap; the one being edited is
// draggable. Dropping onto a gap another banner holds SWAPS them (one banner per
// gap). onArrange reports the current banner's gap plus every OTHER banner's gap
// so the form can persist the whole arrangement on Save.

export function BannerPositionModal({
  visible,
  banners,
  currentId,
  current,
  value,
  onArrange,
  onClose,
}: {
  visible: boolean;
  banners: Banner[];
  currentId?: string;
  current: PreviewBanner;
  value: number;
  onArrange: (currentRowIndex: number, otherMoves: { id: string; rowIndex: number }[]) => void;
  onClose: () => void;
}) {
  const others = banners.filter((b) => b._id !== currentId);
  const currentKey = currentId ?? NEW_KEY;
  const ROWS = Math.max(MIN_ROWS, others.length + 1);

  const [gapOf, setGapOf] = useState<Record<string, number>>({});
  const gapRef = useRef(gapOf);
  gapRef.current = gapOf;

  const report = (next: Record<string, number>) => {
    const moves = others.map((b) => ({ id: b._id, rowIndex: next[b._id] ?? 0 }));
    onArrange(next[currentKey] ?? 0, moves);
  };

  // On open: spread all banners into DISTINCT gaps, preferring each one's stored
  // rowIndex and bumping to the nearest free gap on collision. Report it so a
  // Save persists the normalized (one-per-gap) layout.
  useEffect(() => {
    if (!visible) return;
    const items = [
      ...others.map((b) => ({
        key: b._id,
        rowIndex: b.rowIndex ?? 0,
        sortOrder: b.sortOrder ?? 0,
        createdAt: b.createdAt ?? '',
      })),
      { key: currentKey, rowIndex: value, sortOrder: Number.MAX_SAFE_INTEGER, createdAt: '' },
    ].sort(
      (a, b) =>
        a.rowIndex - b.rowIndex ||
        a.sortOrder - b.sortOrder ||
        a.createdAt.localeCompare(b.createdAt),
    );
    const used = new Set<number>();
    const assign: Record<string, number> = {};
    for (const it of items) {
      let g = Math.max(0, Math.min(it.rowIndex, ROWS));
      if (used.has(g)) {
        for (let d = 1; d <= ROWS + 1; d++) {
          if (g + d <= ROWS && !used.has(g + d)) { g += d; break; }
          if (g - d >= 0 && !used.has(g - d)) { g -= d; break; }
        }
      }
      used.add(g);
      assign[it.key] = g;
    }
    setGapOf(assign);
    report(assign);
    // Seed once per open; `value` is intentionally excluded — onArrange feeds it
    // back, which would otherwise re-run this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, currentId, banners.length]);

  const placeCurrent = (i: number) => {
    const g = gapRef.current;
    const from = g[currentKey] ?? 0;
    const target = Math.max(0, Math.min(i, ROWS));
    if (target === from) return;
    const occupant = Object.keys(g).find((k) => g[k] === target && k !== currentKey);
    const next = { ...g, [currentKey]: target };
    if (occupant) next[occupant] = from; // swap
    setGapOf(next);
    report(next);
  };

  const translateY = useSharedValue(0);
  const active = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onStart(() => {
      active.value = 1;
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(placeCurrent)((gapRef.current[currentKey] ?? 0) + Math.round(e.translationY / SLOT_STEP));
      translateY.value = withSpring(0);
      active.value = 0;
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: 1 + active.value * 0.03 }],
    opacity: 1 - active.value * 0.1,
    zIndex: active.value ? 20 : 1,
  }));

  const keyAt = (i: number) => Object.keys(gapOf).find((k) => gapOf[k] === i);
  const previewFor = (key: string): PreviewBanner => {
    if (key === currentKey) return current;
    const b = others.find((o) => o._id === key);
    return b ? toPreview(b) : {};
  };
  const curGap = gapOf[currentKey] ?? 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Preview & Position</Text>
              <Text style={s.sub}>Drag your banner between rows, or tap a slot. Drop on another to swap. Position {curGap}.</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <GestureHandlerRootView style={s.ghRoot}>
            <ScrollView contentContainerStyle={s.mock} showsVerticalScrollIndicator={false}>
              <NavStub />
              {Array.from({ length: ROWS + 1 }).map((_, i) => {
                const key = keyAt(i);
                return (
                  <React.Fragment key={i}>
                    {key === currentKey ? (
                      <View style={s.gapActive}>
                        <GestureDetector gesture={pan}>
                          <Animated.View style={cardStyle}>
                            <View style={s.dragWrap}>
                              <MiniBanner banner={current} />
                              <View style={s.grip}>
                                <GripVertical size={14} color="#fff" strokeWidth={2.5} />
                              </View>
                            </View>
                          </Animated.View>
                        </GestureDetector>
                      </View>
                    ) : key ? (
                      <TouchableOpacity
                        style={s.gapOther}
                        onPress={() => placeCurrent(i)}
                        activeOpacity={0.8}
                      >
                        <View style={s.otherWrap}>
                          <MiniBanner banner={previewFor(key)} />
                          <View style={s.otherTag}>
                            <Text style={s.otherTagTxt}>tap to swap</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={s.gapEmpty}
                        onPress={() => placeCurrent(i)}
                        activeOpacity={0.7}
                      >
                        <Text style={s.gapEmptyTxt}>Place here</Text>
                      </TouchableOpacity>
                    )}
                    {i < ROWS ? <DummyRow /> : null}
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </GestureHandlerRootView>

          <TouchableOpacity style={s.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Check size={16} color="#fff" strokeWidth={2.5} />
            <Text style={s.doneTxt}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  title: { fontSize: 16, fontFamily: Fonts.bold, color: '#0f172a' },
  sub: { fontSize: 12, fontFamily: Fonts.regular, color: '#64748b', marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center',
  },

  ghRoot: { flexShrink: 1 },
  mock: { padding: 14, backgroundColor: '#F0F4F8' },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  navSearch: { flex: 1, height: 22, borderRadius: 11, backgroundColor: '#e2e8f0' },
  navAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#cbd5e1' },

  row: { flexDirection: 'row', gap: 8, height: 44, marginVertical: 4 },
  dummyCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },

  gapEmpty: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  gapEmptyTxt: { fontSize: 11, fontFamily: Fonts.semiBold, color: '#3b82f6' },

  gapActive: { marginVertical: 4 },
  gapOther: { marginVertical: 4 },
  otherWrap: { position: 'relative', opacity: 0.72 },
  otherTag: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  otherTagTxt: { fontSize: 9, fontFamily: Fonts.bold, color: '#fff', letterSpacing: 0.3 },

  dragWrap: { position: 'relative' },
  grip: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  mini: {
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#4784E2',
  },
  miniRow: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  miniTxt: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },

  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    paddingVertical: 13,
    margin: 14,
    borderRadius: 10,
  },
  doneTxt: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
});

export default BannerPositionModal;
