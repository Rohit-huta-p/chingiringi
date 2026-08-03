import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Image, ActivityIndicator, Alert, Platform, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, Pencil, Trash2, Image as ImageIcon, Sparkles, Zap, Columns2,
  Coins, Gift, Rows3, ToggleLeft,
} from 'lucide-react-native';
import { Colors, Spacing, Gradient } from '../../constants/theme';
import { adminAPI } from '../../api/admin';
import {
  Banner, BannerDraft, BannerLinkType, BannerSlot, BannerType,
  BANNER_SLOTS, SLOT_INFO, SLOT_GRADIENTS, withDerivedSlot,
} from '../../api/banners';
import { ImageUploader } from '../../components/ImageUploader';
import { BannerPositionModal } from '../../components/BannerPositionModal';

// ─── Slot visuals ───────────────────────────────────────────────────────────
// Gradients come from SLOT_GRADIENTS (shared with home screens) so the
// admin preview matches production exactly. Icons stay local — they're
// admin-form-only chrome.

const SLOT_ICONS: Record<BannerSlot, any> = {
  hero:          Sparkles,
  'flash-strip': Zap,
  'dual-left':   Columns2,
  'dual-right':  Columns2,
  'earn-coins':  Coins,
  'refer-earn':  Gift,
  'inline-1':    Rows3,
  'inline-2':    Rows3,
};

const SLOT_VISUALS: Record<BannerSlot, { Icon: any; preview: [string, string] }> = Object.fromEntries(
  BANNER_SLOTS.map((slot) => [slot, { Icon: SLOT_ICONS[slot], preview: SLOT_GRADIENTS[slot] }]),
) as Record<BannerSlot, { Icon: any; preview: [string, string] }>;

// ─── Link Type Pill ─────────────────────────────────────────────────────────

function LinkTypePill({ type }: { type: BannerLinkType }) {
  const color = type === 'deal' ? '#2563eb' : type === 'category' ? '#0891b2' : '#7c3aed';
  const bg    = type === 'deal' ? '#eff6ff' : type === 'category' ? '#ecfeff' : '#f5f3ff';
  return (
    <View style={[styles.linkPill, { backgroundColor: bg }]}>
      <Text style={[styles.linkPillText, { color }]}>{type}</Text>
    </View>
  );
}

// ─── Banner Row (wide desktop card) ─────────────────────────────────────────

function BannerRow({
  banner, onToggle, onEdit, onDelete,
}: {
  banner: Banner;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const slot = banner.slot ?? 'hero';
  const visual = SLOT_VISUALS[slot];
  const SlotIcon = visual?.Icon ?? ImageIcon;
  const preview = visual?.preview ?? ['#cbd5e1', '#94a3b8'];

  const activeRange = banner.startsAt && banner.expiresAt
    ? `${banner.startsAt.slice(0, 10)} - ${banner.expiresAt.slice(0, 10)}`
    : banner.startsAt
      ? banner.startsAt.slice(0, 10)
      : banner.expiresAt
        ? `Until ${banner.expiresAt.slice(0, 10)}`
        : 'No schedule';

  return (
    <View style={styles.rowCard}>
      {/* Image (left) */}
      <View style={styles.imageWrap}>
        {banner.imageUrl ? (
          <Image source={{ uri: banner.imageUrl }} style={styles.rowImage} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={preview as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.placeholderBox}
          >
            <SlotIcon size={42} color="rgba(255,255,255,0.95)" strokeWidth={1.8} />
            <Text style={styles.placeholderText}>{SLOT_INFO[slot]?.label ?? slot}</Text>
          </LinearGradient>
        )}
      </View>

      {/* Details (right) */}
      <View style={styles.details}>
        <Text style={styles.bannerTitle}>{banner.title || 'Untitled Banner'}</Text>

        <View style={styles.metaLine}>
          <Text style={styles.metaLabel}>Slot:</Text>
          <View style={styles.slotPill}>
            <SlotIcon size={12} color="#4338ca" strokeWidth={2.2} />
            <Text style={styles.slotPillText}>{SLOT_INFO[slot]?.label ?? slot}</Text>
          </View>
          <Text style={styles.sortOrderText}>· Order {banner.sortOrder ?? 0}</Text>
        </View>

        <View style={styles.metaLine}>
          <Text style={styles.metaLabel}>Link Type:</Text>
          <LinkTypePill type={banner.linkType} />
        </View>

        <View style={styles.metaLine}>
          <Text style={styles.metaLabel}>Active:</Text>
          <Text style={styles.metaDate}>{activeRange}</Text>
        </View>

        {/* Actions row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.activePill, banner.isActive ? styles.activePillOn : styles.activePillOff]}
            onPress={onToggle}
          >
            <ToggleLeft
              size={18}
              color={banner.isActive ? '#16a34a' : '#94a3b8'}
              strokeWidth={2}
              style={banner.isActive ? { transform: [{ rotate: '180deg' }] } : undefined}
            />
            <Text style={[
              styles.activePillText,
              banner.isActive ? styles.activePillTextOn : styles.activePillTextOff,
            ]}>
              {banner.isActive ? 'Active' : 'Inactive'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtnEdit} onPress={onEdit} activeOpacity={0.8}>
            <Pencil size={16} color="#3b82f6" strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtnDelete} onPress={onDelete} activeOpacity={0.8}>
            <Trash2 size={16} color="#ef4444" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Banner Form Modal ──────────────────────────────────────────────────────

const EMPTY_DRAFT: BannerDraft = {
  title: '',
  subtitle: '',
  imageUrl: '',
  mobileImageUrl: '',
  linkType: 'url',
  linkValue: '',
  slot: 'hero',
  type: 'hero',
  rowIndex: 0,
  right: {},
  isActive: true,
  sortOrder: 1,
};

function BannerFormModal({
  visible, banner, allBanners, onClose, onSave,
}: {
  visible: boolean;
  banner: Banner | null;
  allBanners: Banner[];
  onClose: () => void;
  onSave: (draft: BannerDraft, otherMoves: { id: string; rowIndex: number }[]) => void;
}) {
  const isEdit = !!banner;
  const [draft, setDraft] = useState<BannerDraft>(EMPTY_DRAFT);
  const [showPosition, setShowPosition] = useState(false);
  const [pendingMoves, setPendingMoves] = useState<{ id: string; rowIndex: number }[]>([]);

  // Reset form on each open
  React.useEffect(() => {
    if (visible) {
      setDraft(banner ? {
        title: banner.title,
        subtitle: banner.subtitle,
        imageUrl: banner.imageUrl,
        mobileImageUrl: banner.mobileImageUrl,
        overlayImage: banner.overlayImage,
        linkType: banner.linkType,
        linkValue: banner.linkValue,
        ctaLabel: banner.ctaLabel,
        slot: banner.slot ?? 'hero',
        type: banner.type ?? 'hero',
        rowIndex: banner.rowIndex ?? 0,
        right: banner.right ?? {},
        gradientColors: banner.gradientColors,
        textColor: banner.textColor,
        badges: banner.badges,
        isActive: banner.isActive,
        sortOrder: banner.sortOrder ?? 1,
        startsAt: banner.startsAt,
        expiresAt: banner.expiresAt,
      } : EMPTY_DRAFT);
      setPendingMoves([]);
    }
  }, [visible, banner]);

  const handleSubmit = () => {
    if (!draft.title.trim()) {
      Alert.alert('Validation', 'Title is required');
      return;
    }
    onSave(draft, pendingMoves);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Banner' : 'Add Banner'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Type selector — Hero (full-width) or Dual (left + right) */}
            <Text style={styles.fieldLabel}>Type *</Text>
            <View style={styles.segmentRow}>
              {(['hero', 'dual'] as BannerType[]).map((t) => {
                const selected = draft.type === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.segmentBtn, selected && styles.segmentBtnSelected]}
                    onPress={() => setDraft({ ...draft, type: t })}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Placement — opens the home preview to drag/tap the banner's row */}
            <TouchableOpacity
              style={styles.positionBtn}
              onPress={() => setShowPosition(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.positionBtnText}>Preview & position on home</Text>
              <Text style={styles.positionBtnBadge}>Row {draft.rowIndex ?? 0}</Text>
            </TouchableOpacity>

            {draft.type === 'dual' ? (
              <View style={styles.sideDivider}>
                <Text style={styles.sideDividerText}>Left side</Text>
              </View>
            ) : null}

            {/* Title + subtitle */}
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="Summer Sale - Fashion"
              placeholderTextColor="#94a3b8"
              value={draft.title}
              onChangeText={(v) => setDraft({ ...draft, title: v })}
            />

            <Text style={styles.fieldLabel}>Subtitle</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              placeholder="Up to 50% off on fashion brands"
              placeholderTextColor="#94a3b8"
              multiline
              value={draft.subtitle}
              onChangeText={(v) => setDraft({ ...draft, subtitle: v })}
            />

            {/* Images — Cloudinary upload (web), URL fallback. Desktop + mobile
                render on their own home screens (MobileHomeScreen falls back to
                the desktop image when no mobile image is set). */}
            <Text style={styles.fieldLabel}>Desktop Image</Text>
            <ImageUploader
              value={draft.imageUrl}
              onChange={(url) => setDraft({ ...draft, imageUrl: url })}
              folder="chingiringi/banners"
            />
            <Text style={styles.fieldHint}>Recommended 2400 × 600 px or larger. Auto-cropped to fit — keep the key subject centered.</Text>

            <Text style={styles.fieldLabel}>Mobile Image</Text>
            <ImageUploader
              value={draft.mobileImageUrl || ''}
              onChange={(url) => setDraft({ ...draft, mobileImageUrl: url })}
              folder="chingiringi/banners"
            />
            <Text style={styles.fieldHint}>Recommended 1080 × 640 px or larger. Auto-cropped to fit.</Text>

            {/* CTA label */}
            <Text style={styles.fieldLabel}>CTA Label</Text>
            <TextInput
              style={styles.input}
              placeholder="Shop Now"
              placeholderTextColor="#94a3b8"
              value={draft.ctaLabel || ''}
              onChangeText={(v) => setDraft({ ...draft, ctaLabel: v })}
            />

            {/* Link type + value */}
            <Text style={styles.fieldLabel}>Link Type</Text>
            <View style={styles.segmentRow}>
              {(['deal', 'category', 'url'] as BannerLinkType[]).map((t) => {
                const selected = draft.linkType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.segmentBtn, selected && styles.segmentBtnSelected]}
                    onPress={() => setDraft({ ...draft, linkType: t })}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Link Value</Text>
            <TextInput
              style={styles.input}
              placeholder={draft.linkType === 'url' ? '/referral' : draft.linkType === 'deal' ? 'deal-id or slug' : 'category slug'}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              value={draft.linkValue}
              onChangeText={(v) => setDraft({ ...draft, linkValue: v })}
            />

            {/* Dual — right half (top-level fields above are the left half) */}
            {draft.type === 'dual' ? (
              <>
                <View style={styles.sideDivider}>
                  <Text style={styles.sideDividerText}>Right side</Text>
                </View>

                <Text style={styles.fieldLabel}>Right Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Right half title"
                  placeholderTextColor="#94a3b8"
                  value={draft.right?.title || ''}
                  onChangeText={(v) => setDraft({ ...draft, right: { ...(draft.right ?? {}), title: v } })}
                />

                <Text style={styles.fieldLabel}>Right Subtitle</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Right half subtitle"
                  placeholderTextColor="#94a3b8"
                  value={draft.right?.subtitle || ''}
                  onChangeText={(v) => setDraft({ ...draft, right: { ...(draft.right ?? {}), subtitle: v } })}
                />

                <Text style={styles.fieldLabel}>Right Desktop Image</Text>
                <ImageUploader
                  value={draft.right?.imageUrl || ''}
                  onChange={(url) => setDraft({ ...draft, right: { ...(draft.right ?? {}), imageUrl: url } })}
                  folder="chingiringi/banners"
                />
                <Text style={styles.fieldHint}>Recommended 1200 × 700 px (half-width) or larger. Auto-cropped to fit.</Text>

                <Text style={styles.fieldLabel}>Right Mobile Image</Text>
                <ImageUploader
                  value={draft.right?.mobileImageUrl || ''}
                  onChange={(url) => setDraft({ ...draft, right: { ...(draft.right ?? {}), mobileImageUrl: url } })}
                  folder="chingiringi/banners"
                />

                <Text style={styles.fieldLabel}>Right CTA Label</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Shop Now"
                  placeholderTextColor="#94a3b8"
                  value={draft.right?.ctaLabel || ''}
                  onChangeText={(v) => setDraft({ ...draft, right: { ...(draft.right ?? {}), ctaLabel: v } })}
                />

                <Text style={styles.fieldLabel}>Right Link Type</Text>
                <View style={styles.segmentRow}>
                  {(['deal', 'category', 'url'] as BannerLinkType[]).map((t) => {
                    const selected = (draft.right?.linkType ?? 'url') === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.segmentBtn, selected && styles.segmentBtnSelected]}
                        onPress={() => setDraft({ ...draft, right: { ...(draft.right ?? {}), linkType: t } })}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Right Link Value</Text>
                <TextInput
                  style={styles.input}
                  placeholder="category slug / deal-id / /referral"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  value={draft.right?.linkValue || ''}
                  onChangeText={(v) => setDraft({ ...draft, right: { ...(draft.right ?? {}), linkValue: v } })}
                />
              </>
            ) : null}

            {/* Order + dates */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Sort Order</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={String(draft.sortOrder ?? '')}
                  onChangeText={(v) => setDraft({ ...draft, sortOrder: parseInt(v, 10) || 0 })}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Starts At</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2026-04-01"
                  placeholderTextColor="#94a3b8"
                  value={draft.startsAt || ''}
                  onChangeText={(v) => setDraft({ ...draft, startsAt: v })}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Expires At</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-04-30 (optional)"
              placeholderTextColor="#94a3b8"
              value={draft.expiresAt || ''}
              onChangeText={(v) => setDraft({ ...draft, expiresAt: v })}
            />

            {/* Active */}
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Active</Text>
              <Switch
                value={draft.isActive}
                onValueChange={(v) => setDraft({ ...draft, isActive: v })}
                trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                thumbColor={draft.isActive ? '#16a34a' : '#f1f5f9'}
              />
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.85}>
              <Text style={styles.submitBtnText}>{isEdit ? 'Update Banner' : 'Create Banner'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <BannerPositionModal
            visible={showPosition}
            banners={allBanners}
            currentId={banner?._id}
            value={draft.rowIndex ?? 0}
            current={{
              type: draft.type,
              title: draft.title,
              imageUrl: draft.imageUrl,
              mobileImageUrl: draft.mobileImageUrl,
              right: draft.right,
            }}
            onArrange={(cur, moves) => {
              setDraft((d) => ({ ...d, rowIndex: cur }));
              setPendingMoves(moves);
            }}
            onClose={() => setShowPosition(false)}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export function AdminBannersScreen() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editBanner, setEditBanner] = useState<Banner | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: async () => {
      try {
        return await adminAPI.getBanners();
      } catch {
        return { banners: [] };
      }
    },
    staleTime: 60_000,
  });

  const banners: Banner[] = useMemo(() => {
    const raw: Banner[] =
      (data as any)?.data?.banners ??
      (data as any)?.banners ??
      (data as any)?.data ??
      (Array.isArray(data) ? (data as any) : []);
    const list = Array.isArray(raw) && raw.length > 0 ? raw : [];
    return withDerivedSlot(list);
  }, [data]);

  // Every banner mutation must invalidate BOTH the admin-only list AND the
  // user-facing key, otherwise mobile/desktop home pages stay stale after an
  // admin edit (cache key drift caused the "banner doesn't update on mobile"
  // bug). Mirrors MobileAdminBanners.tsx.
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
    queryClient.invalidateQueries({ queryKey: ['banners'] });
  };

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminAPI.updateBanner(id, { isActive }),
    onSuccess: invalidateAll,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteBanner(id),
    onSuccess: invalidateAll,
  });
  const createMutation = useMutation({
    mutationFn: (draft: BannerDraft) => adminAPI.createBanner(draft),
    onSuccess: () => {
      invalidateAll();
      setShowForm(false); setEditBanner(null);
    },
    onError: (e: any) =>
      Alert.alert('Could not create banner', e?.response?.data?.message || e?.message || 'Please try again.'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: BannerDraft }) =>
      adminAPI.updateBanner(id, draft),
    onSuccess: () => {
      invalidateAll();
      setShowForm(false); setEditBanner(null);
    },
    onError: (e: any) =>
      Alert.alert('Could not update banner', e?.response?.data?.message || e?.message || 'Please try again.'),
  });

  const handleSave = async (draft: BannerDraft, otherMoves: { id: string; rowIndex: number }[]) => {
    // Persist any OTHER banners the position board rearranged (rowIndex only),
    // then save the current banner. Only writes banners whose row actually moved.
    const changed = otherMoves.filter((m) => {
      const orig = banners.find((b) => b._id === m.id);
      return orig && (orig.rowIndex ?? 0) !== m.rowIndex;
    });
    if (changed.length) {
      try {
        await Promise.all(changed.map((m) => adminAPI.updateBanner(m.id, { rowIndex: m.rowIndex })));
      } catch {
        // Non-fatal: the current banner still saves; reorder can be retried.
      }
    }
    if (editBanner) updateMutation.mutate({ id: editBanner._id, draft });
    else createMutation.mutate(draft);
  };

  const handleDelete = (banner: Banner) => {
    const remove = () => deleteMutation.mutate(banner._id);
    const msg = `Delete "${banner.title}"?`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) remove();
    } else {
      Alert.alert('Delete Banner', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: remove },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.containerContent}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Banner Management</Text>
          <Text style={styles.pageSubtitle}>Manage home page banners</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { setEditBanner(null); setShowForm(true); }}
          style={styles.addBtnWrap}
        >
          <LinearGradient
            colors={Gradient.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addBtn}
          >
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add Banner</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.emptyText}>Loading banners…</Text>
        </View>
      ) : banners.length === 0 ? (
        <View style={styles.emptyState}>
          <ImageIcon size={48} color="#cbd5e1" strokeWidth={1.5} />
          <Text style={styles.emptyText}>No banners yet. Click "+ Add Banner" to create one.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {banners.map((b) => (
            <BannerRow
              key={b._id}
              banner={b}
              onToggle={() => toggleMutation.mutate({ id: b._id, isActive: !b.isActive })}
              onEdit={() => { setEditBanner(b); setShowForm(true); }}
              onDelete={() => handleDelete(b)}
            />
          ))}
        </View>
      )}

      <BannerFormModal
        visible={showForm}
        banner={editBanner}
        allBanners={banners}
        onClose={() => { setShowForm(false); setEditBanner(null); }}
        onSave={handleSave}
      />
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  containerContent: { padding: Spacing.lg, paddingBottom: 60 },

  // Page header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  addBtnWrap: { borderRadius: 22, overflow: 'hidden' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    gap: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // List
  list: { gap: 24 },

  // Row card
  rowCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    padding: 24,
    flexDirection: 'row',
    gap: 83,
  },
  imageWrap: {
    width: 401,
    height: 192,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  rowImage: { width: '100%', height: '100%' },
  placeholderBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  placeholderText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  details: { flex: 1, justifyContent: 'space-between' },
  bannerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#eef2ff',
  },
  slotPillText: { fontSize: 12, fontWeight: '700', color: '#4338ca' },
  sortOrderText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  metaLabel: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  metaDate: { fontSize: 13, color: '#16a34a', fontWeight: '600' },

  linkPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  linkPillText: { fontSize: 12, fontWeight: '600', textTransform: 'lowercase' },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },

  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  activePillOn: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  activePillOff: { backgroundColor: '#F0F4F8', borderColor: '#e2e8f0' },
  activePillText: { fontSize: 14, fontWeight: '600' },
  activePillTextOn: { color: '#16a34a' },
  activePillTextOff: { color: '#64748b' },

  iconBtnEdit: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnDelete: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: '#fef2f2',
    justifyContent: 'center', alignItems: 'center',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalBody: { padding: 20 },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: { color: Colors.text, fontWeight: '500', fontSize: 14 },

  // Form fields
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  fieldHint: { fontSize: 11, color: Colors.textSecondary, marginTop: 6 },
  sideDivider: { marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  sideDividerText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  positionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: '#eff6ff',
  },
  positionBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  positionBtnBadge: { fontSize: 12, fontWeight: '700', color: Colors.text },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  // Slot grid
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fff',
  },
  slotOptionSelected: { borderColor: Colors.primary, backgroundColor: '#eff6ff' },
  slotPreview: {
    width: 28, height: 28, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
  },
  slotLabel: { fontSize: 12, color: Colors.text, fontWeight: '500' },
  slotLabelSelected: { color: Colors.primary, fontWeight: '700' },

  // Segmented buttons (link type)
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  segmentBtnSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentText: { fontSize: 13, color: Colors.text, fontWeight: '500', textTransform: 'capitalize' },
  segmentTextSelected: { color: '#fff', fontWeight: '700' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16, marginBottom: 8,
  },
});
