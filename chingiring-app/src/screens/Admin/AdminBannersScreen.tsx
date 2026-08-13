import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Image, ActivityIndicator, Alert, Platform, Switch, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, Pencil, Trash2, Image as ImageIcon, Sparkles, Zap, Columns2,
  Coins, Gift, Rows3, ToggleLeft, Type as TypeIcon, Link2, Calendar, Layers, MapPin,
} from 'lucide-react-native';
import { Colors, Spacing, Gradient } from '../../constants/theme';
import { adminAPI } from '../../api/admin';
import {
  Banner, BannerDraft, BannerLinkType, BannerSlot, BannerType,
  BANNER_SLOTS, SLOT_INFO, SLOT_GRADIENTS, withDerivedSlot,
} from '../../api/banners';
import { ImageUploader } from '../../components/ImageUploader';
import { BannerPreview } from '../../components/BannerPreview';
import { categoriesAPI, Category } from '../../api/deals';

// Small section wrapper: an icon chip + title with a divider, fields below.
function FormSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}><Icon size={13} color={Colors.primary} strokeWidth={2.4} /></View>
        <Text style={styles.sectionHeadText}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

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
  afterCategory: '',
  right: {},
  isActive: true,
  sortOrder: 1,
};

function BannerFormModal({
  visible, banner, categories, onClose, onSave,
}: {
  visible: boolean;
  banner: Banner | null;
  categories: string[];
  onClose: () => void;
  onSave: (draft: BannerDraft) => void;
}) {
  const isEdit = !!banner;
  const { width } = useWindowDimensions();
  const twoCol = width >= 880; // side-by-side form + live preview on desktop
  const [draft, setDraft] = useState<BannerDraft>(EMPTY_DRAFT);

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
        afterCategory: banner.afterCategory ?? '',
        right: banner.right ?? {},
        gradientColors: banner.gradientColors,
        textColor: banner.textColor,
        badges: banner.badges,
        isActive: banner.isActive,
        sortOrder: banner.sortOrder ?? 1,
        startsAt: banner.startsAt,
        expiresAt: banner.expiresAt,
      } : EMPTY_DRAFT);
    }
  }, [visible, banner]);

  const handleSubmit = () => {
    if (!draft.title.trim()) {
      Alert.alert('Validation', 'Title is required');
      return;
    }
    onSave(draft);
  };

  // "Show after" picker — Top of page + one chip per category, bound to
  // draft.afterCategory. Replaces the old drag-to-position modal.
  const placementPicker = (
    <View style={styles.placeCard}>
      <View style={styles.placeHead}>
        <MapPin size={15} color={Colors.primary} strokeWidth={2.2} />
        <Text style={styles.placeTitle}>Show banner after</Text>
      </View>
      <View style={styles.placeChips}>
        {[{ key: '', label: 'Top of page' }, ...categories.map((c) => ({ key: c, label: c }))].map((opt) => {
          const on = (draft.afterCategory ?? '') === opt.key;
          return (
            <TouchableOpacity
              key={opt.key || '__top__'}
              style={[styles.placeChip, on && styles.placeChipOn]}
              onPress={() => setDraft({ ...draft, afterCategory: opt.key })}
              activeOpacity={0.8}
            >
              <Text style={[styles.placeChipTxt, on && styles.placeChipTxtOn]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, twoCol && styles.modalCardWide]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.headerBadge}>
                <ImageIcon size={16} color="#fff" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{isEdit ? 'Edit banner' : 'New banner'}</Text>
                <Text style={styles.modalSubtitle}>
                  {isEdit ? 'Update its look and where it sits' : 'Design a banner and place it on the home screen'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Body: live preview + sectioned form (side-by-side on desktop) */}
          <View style={twoCol ? styles.bodyRow : styles.bodyCol}>
            {twoCol ? (
              <View style={styles.previewPane}>
                <BannerPreview banner={draft} />
                {placementPicker}
              </View>
            ) : null}

            <ScrollView style={styles.formPane} contentContainerStyle={styles.formPaneContent} showsVerticalScrollIndicator={false}>
              {!twoCol ? (
                <View>
                  <BannerPreview banner={draft} />
                  <View style={{ marginTop: 12 }}>{placementPicker}</View>
                </View>
              ) : null}

              {/* Type */}
              <FormSection icon={Layers} title="Banner type">
                <View style={styles.typeRow}>
                  {(['hero', 'dual'] as BannerType[]).map((t) => {
                    const on = draft.type === t;
                    const Icon = t === 'hero' ? Sparkles : Columns2;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeCard, on && styles.typeCardOn]}
                        onPress={() => setDraft({ ...draft, type: t })}
                        activeOpacity={0.85}
                      >
                        <Icon size={18} color={on ? Colors.primary : '#64748b'} strokeWidth={2.2} />
                        <Text style={[styles.typeCardTitle, on && styles.typeCardTitleOn]}>{t === 'hero' ? 'Hero' : 'Dual'}</Text>
                        <Text style={styles.typeCardSub}>{t === 'hero' ? 'Full-width banner' : 'Two halves side by side'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </FormSection>

              {/* Content */}
              <FormSection icon={TypeIcon} title={draft.type === 'dual' ? 'Left content' : 'Content'}>
                <Text style={styles.fieldLabel}>Title <Text style={styles.req}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="Summer Sale — Fashion"
                  placeholderTextColor="#94a3b8"
                  value={draft.title}
                  onChangeText={(v) => setDraft({ ...draft, title: v })}
                />
                <Text style={styles.fieldLabel}>Subtitle</Text>
                <TextInput
                  style={[styles.input, styles.inputArea]}
                  placeholder="Up to 50% off on fashion brands"
                  placeholderTextColor="#94a3b8"
                  multiline
                  value={draft.subtitle}
                  onChangeText={(v) => setDraft({ ...draft, subtitle: v })}
                />
              </FormSection>

              {/* Images */}
              <FormSection icon={ImageIcon} title={draft.type === 'dual' ? 'Left images' : 'Images'}>
                <Text style={styles.fieldLabel}>Desktop image</Text>
                <ImageUploader
                  value={draft.imageUrl}
                  onChange={(url) => setDraft({ ...draft, imageUrl: url })}
                  folder="chingiringi/banners"
                />
                <Text style={styles.fieldHint}>Recommended 2400 × 600 px or larger. Auto-cropped to fit — keep the key subject centered.</Text>
                <Text style={styles.fieldLabel}>Mobile image</Text>
                <ImageUploader
                  value={draft.mobileImageUrl || ''}
                  onChange={(url) => setDraft({ ...draft, mobileImageUrl: url })}
                  folder="chingiringi/banners"
                />
                <Text style={styles.fieldHint}>Recommended 1080 × 640 px or larger. Auto-cropped to fit.</Text>
              </FormSection>

              {/* CTA & link */}
              <FormSection icon={Link2} title={draft.type === 'dual' ? 'Left CTA & link' : 'Call to action & link'}>
                <Text style={styles.fieldLabel}>CTA label</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Shop Now"
                  placeholderTextColor="#94a3b8"
                  value={draft.ctaLabel || ''}
                  onChangeText={(v) => setDraft({ ...draft, ctaLabel: v })}
                />
                <Text style={styles.fieldLabel}>Link type</Text>
                <View style={styles.segmentRow}>
                  {(['deal', 'category', 'url'] as BannerLinkType[]).map((t) => {
                    const on = draft.linkType === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.segmentBtn, on && styles.segmentBtnSelected]}
                        onPress={() => setDraft({ ...draft, linkType: t })}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.segmentText, on && styles.segmentTextSelected]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.fieldLabel}>Link value</Text>
                <TextInput
                  style={styles.input}
                  placeholder={draft.linkType === 'url' ? 'https://… or /referral' : draft.linkType === 'deal' ? 'deal-id or slug' : 'category slug'}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  value={draft.linkValue}
                  onChangeText={(v) => setDraft({ ...draft, linkValue: v })}
                />
              </FormSection>

              {/* Dual — right half (fields above are the left half) */}
              {draft.type === 'dual' ? (
                <View style={styles.rightGroup}>
                  <FormSection icon={Columns2} title="Right side">
                    <Text style={styles.fieldLabel}>Right title</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Right half title"
                      placeholderTextColor="#94a3b8"
                      value={draft.right?.title || ''}
                      onChangeText={(v) => setDraft({ ...draft, right: { ...(draft.right ?? {}), title: v } })}
                    />
                    <Text style={styles.fieldLabel}>Right subtitle</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Right half subtitle"
                      placeholderTextColor="#94a3b8"
                      value={draft.right?.subtitle || ''}
                      onChangeText={(v) => setDraft({ ...draft, right: { ...(draft.right ?? {}), subtitle: v } })}
                    />
                    <Text style={styles.fieldLabel}>Right desktop image</Text>
                    <ImageUploader
                      value={draft.right?.imageUrl || ''}
                      onChange={(url) => setDraft({ ...draft, right: { ...(draft.right ?? {}), imageUrl: url } })}
                      folder="chingiringi/banners"
                    />
                    <Text style={styles.fieldHint}>Recommended 1200 × 700 px (half-width) or larger.</Text>
                    <Text style={styles.fieldLabel}>Right mobile image</Text>
                    <ImageUploader
                      value={draft.right?.mobileImageUrl || ''}
                      onChange={(url) => setDraft({ ...draft, right: { ...(draft.right ?? {}), mobileImageUrl: url } })}
                      folder="chingiringi/banners"
                    />
                    <Text style={styles.fieldLabel}>Right CTA label</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Shop Now"
                      placeholderTextColor="#94a3b8"
                      value={draft.right?.ctaLabel || ''}
                      onChangeText={(v) => setDraft({ ...draft, right: { ...(draft.right ?? {}), ctaLabel: v } })}
                    />
                    <Text style={styles.fieldLabel}>Right link type</Text>
                    <View style={styles.segmentRow}>
                      {(['deal', 'category', 'url'] as BannerLinkType[]).map((t) => {
                        const on = (draft.right?.linkType ?? 'url') === t;
                        return (
                          <TouchableOpacity
                            key={t}
                            style={[styles.segmentBtn, on && styles.segmentBtnSelected]}
                            onPress={() => setDraft({ ...draft, right: { ...(draft.right ?? {}), linkType: t } })}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.segmentText, on && styles.segmentTextSelected]}>{t}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={styles.fieldLabel}>Right link value</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="category slug / deal-id / https://…"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="none"
                      value={draft.right?.linkValue || ''}
                      onChangeText={(v) => setDraft({ ...draft, right: { ...(draft.right ?? {}), linkValue: v } })}
                    />
                  </FormSection>
                </View>
              ) : null}

              {/* Schedule & status */}
              <FormSection icon={Calendar} title="Schedule & status">
                <View style={styles.fieldRow}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>Sort order</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="1"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={String(draft.sortOrder ?? '')}
                      onChangeText={(v) => setDraft({ ...draft, sortOrder: parseInt(v, 10) || 0 })}
                    />
                    <Text style={styles.fieldHint}>Tie-break within a row</Text>
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>Starts at</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94a3b8"
                      value={draft.startsAt || ''}
                      onChangeText={(v) => setDraft({ ...draft, startsAt: v })}
                    />
                    <Text style={styles.fieldHint}>Blank = now</Text>
                  </View>
                </View>
                <Text style={styles.fieldLabel}>Expires at</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD (blank = never)"
                  placeholderTextColor="#94a3b8"
                  value={draft.expiresAt || ''}
                  onChangeText={(v) => setDraft({ ...draft, expiresAt: v })}
                />
                <View style={styles.activeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeLabel}>Active</Text>
                    <Text style={styles.activeHint}>Show this banner to users</Text>
                  </View>
                  <Switch
                    value={draft.isActive}
                    onValueChange={(v) => setDraft({ ...draft, isActive: v })}
                    trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                    thumbColor={draft.isActive ? '#16a34a' : '#f1f5f9'}
                  />
                </View>
              </FormSection>
            </ScrollView>
          </View>

          {/* Footer */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtnWrap} onPress={handleSubmit} activeOpacity={0.9}>
              <LinearGradient colors={Gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>{isEdit ? 'Update banner' : 'Create banner'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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

  // Category names for the banner's "Show after" placement picker.
  const { data: categoriesRes } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getCategories(),
    staleTime: 5 * 60_000,
  });
  const categoryNames: string[] = useMemo(() => {
    const cats: Category[] =
      (categoriesRes as any)?.data?.categories ?? (categoriesRes as any)?.categories ?? [];
    return cats.filter((c) => c.isActive !== false).map((c) => c.name);
  }, [categoriesRes]);

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

  const handleSave = (draft: BannerDraft) => {
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
        categories={categoryNames}
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
    borderRadius: 16,
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 10,
  },
  modalCardWide: { maxWidth: 960 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerBadge: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, letterSpacing: -0.2 },
  modalSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center',
  },
  modalBody: { padding: 20 },

  // Body panes (form + live preview)
  bodyRow: { flexDirection: 'row', flex: 1, minHeight: 0 },
  bodyCol: { flex: 1, minHeight: 0 },
  previewPane: {
    width: 372,
    padding: 20,
    gap: 14,
    borderRightWidth: 1,
    borderRightColor: '#eef2f7',
    backgroundColor: '#fbfcfe',
  },
  formPane: { flex: 1 },
  formPaneContent: { padding: 20, paddingTop: 6 },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitBtnWrap: { flex: 2, borderRadius: 10, overflow: 'hidden' },
  submitBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
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
  // "Show after" placement picker
  placeCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  placeHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  placeTitle: { fontSize: 13, fontWeight: '800', color: Colors.text },
  placeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  placeChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  placeChipOn: { borderColor: Colors.primary, backgroundColor: '#eff6ff' },
  placeChipTxt: { fontSize: 12.5, fontWeight: '600', color: Colors.textSecondary },
  placeChipTxtOn: { color: Colors.primary, fontWeight: '700' },

  // Section headers
  section: { marginTop: 18 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 2, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  sectionIcon: {
    width: 24, height: 24, borderRadius: 7,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  sectionHeadText: { fontSize: 13, fontWeight: '800', color: Colors.text, letterSpacing: 0.2 },

  // Type cards
  typeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  typeCard: {
    flex: 1, gap: 2,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: '#fff',
  },
  typeCardOn: { borderColor: Colors.primary, backgroundColor: '#eff6ff' },
  typeCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 4 },
  typeCardTitleOn: { color: Colors.primary },
  typeCardSub: { fontSize: 11, color: Colors.textSecondary },

  // Right-side group (dual)
  rightGroup: {
    marginTop: 10,
    backgroundColor: '#faf9ff',
    borderRadius: 14, borderWidth: 1, borderColor: '#ece7fb',
    paddingHorizontal: 12, paddingBottom: 6,
  },

  // Active row
  activeRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc', borderRadius: 12,
    padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: '#eef2f7',
  },
  activeLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  activeHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  inputArea: { height: 64, textAlignVertical: 'top', paddingTop: 10 },
  req: { color: '#ef4444' },
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
