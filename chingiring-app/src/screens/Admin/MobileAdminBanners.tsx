import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Inbox,
  LayoutDashboard,
  Tag,
  CreditCard,
  Users,
  Package,
  Image as ImageIcon,
 Ticket,
  Grid3X3,
  Link2,
  MapPin,
  MonitorPlay,
  X,
  SlidersHorizontal,
  Hash,
  Calendar,
  ExternalLink,
  Palette,
  Sparkles as SparklesIcon,
  Zap,
  Coins,
  Gift,
  Rows3,
  Columns2,
  Layers,
  Type as TypeIcon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { adminAPI } from '../../api/admin';
import {
  Banner,
  BannerBadge,
  BannerDraft,
  BannerLinkType,
  BannerSide,
  BannerSlot,
  BannerType,
  BANNER_SLOTS,
  SLOT_INFO,
  withDerivedSlot,
} from '../../api/banners';
import { Fonts, Gradient } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { BannerPositionModal } from '../../components/BannerPositionModal';
import { ImageUploader } from '../../components/ImageUploader';
import { BannerPreview } from '../../components/BannerPreview';

function userInitials(name?: string | null): string {
  if (!name) return 'A';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ─── Shared Admin Nav ───────────────────────────────────────────────

const NAV_ITEMS = [
  { key: 'AdminDashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'AdminDeals', label: 'Deals', icon: Tag },
  { key: 'AdminWithdrawals', label: 'Payouts', icon: CreditCard },
  { key: 'AdminUsers', label: 'Users', icon: Users },
  { key: 'AdminAllProducts', label: 'Products', icon: Package },
  { key: 'AdminBanners', label: 'Banners', icon: ImageIcon },
  { key: 'AdminCoupons', label: 'Coupons', icon: Ticket },
];

// ─── Slot metadata ──────────────────────────────────────────────────

// Icon + preview colors for each slot (admin UI affordance)
const SLOT_VISUALS: Record<BannerSlot, { Icon: any; preview: [string, string] }> = {
  hero:           { Icon: SparklesIcon, preview: ['#4A7A32', '#FDE68A'] },
  'flash-strip':  { Icon: Zap,          preview: ['#0C1021', '#4784E2'] },
  'dual-left':    { Icon: Columns2,     preview: ['#C084FC', '#F0ABFC'] },
  'dual-right':   { Icon: Columns2,     preview: ['#FBCFE8', '#F9A8D4'] },
  'earn-coins':   { Icon: Coins,        preview: ['#F59E0B', '#FDE68A'] },
  'refer-earn':   { Icon: Gift,         preview: ['#0C1021', '#4784E2'] },
  'inline-1':     { Icon: Rows3,        preview: ['#64748b', '#94a3b8'] },
  'inline-2':     { Icon: Rows3,        preview: ['#64748b', '#94a3b8'] },
};


const LINK_LABEL: Record<BannerLinkType, string> = {
  deal: 'Deal',
  category: 'Category',
  url: 'URL',
};

// ─── Banner Card ─────────────────────────────────────────────────────

function BannerCard({
  banner,
  onToggle,
  onEdit,
  onDelete,
}: {
  banner: Banner;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const slot = banner.slot ?? 'hero';
  const info = SLOT_INFO[slot];
  const visual = SLOT_VISUALS[slot];
  const SlotIcon = visual?.Icon ?? MapPin;
  const preview = visual?.preview ?? ['#cbd5e1', '#94a3b8'];

  return (
    <View style={s.card}>
      {/* Image preview */}
      <View style={s.cardImageArea}>
        {banner.imageUrl ? (
          <Image source={{ uri: banner.imageUrl }} style={s.cardImage} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={preview as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.cardImagePlaceholder}
          >
            <SlotIcon size={36} color="rgba(255,255,255,0.95)" strokeWidth={1.8} />
            <Text style={s.placeholderTxt}>{info?.label ?? slot}</Text>
          </LinearGradient>
        )}
        {/* Status badge overlaid */}
        <View style={[s.overlayBadge, banner.isActive ? s.overlayActive : s.overlayInactive]}>
          <Text style={[s.overlayBadgeText, banner.isActive ? s.overlayActiveText : s.overlayInactiveText]}>
            {banner.isActive ? '● Active' : '◉ Inactive'}
          </Text>
        </View>
        {/* Sort order */}
        {banner.sortOrder !== undefined && (
          <View style={s.sortBadge}>
            <Text style={s.sortBadgeText}>#{banner.sortOrder}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={1}>{banner.title}</Text>
        <Text style={s.cardSubtitle} numberOfLines={1}>{banner.subtitle || '—'}</Text>

        {/* Pills */}
        <View style={s.tagsRow}>
          <View style={s.slotPill}>
            <SlotIcon size={11} color="#3b82f6" strokeWidth={2.2} />
            <Text style={s.slotPillText}>{info?.label ?? slot}</Text>
          </View>
          <View style={s.pillNeutral}>
            <Link2 size={10} color="#64748b" strokeWidth={2} />
            <Text style={s.pillNeutralText} numberOfLines={1}>
              {LINK_LABEL[banner.linkType]}: {banner.linkValue || '—'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actionsRow}>
          <TouchableOpacity style={s.toggleBtn} onPress={onToggle} activeOpacity={0.8}>
            <Text style={s.toggleBtnText}>{banner.isActive ? 'Deactivate' : 'Activate'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={onEdit}>
            <Pencil size={16} color="#eab308" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={onDelete}>
            <Trash2 size={16} color="#ef4444" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Section header: an icon chip + title with a hairline divider.
function MSectionHead({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <View style={m.sectionRow}>
      <View style={m.sectionIcon}><Icon size={13} color="#3b82f6" strokeWidth={2.4} /></View>
      <Text style={m.sectionTitle}>{title}</Text>
    </View>
  );
}

// ─── Banner Form Modal ───────────────────────────────────────────────

interface BannerFormState {
  title: string;
  subtitle: string;
  imageUrl: string;
  mobileImageUrl: string;
  overlayImage: string;
  linkType: BannerLinkType;
  linkValue: string;
  ctaLabel: string;
  slot: BannerSlot;
  type: BannerType;
  rowIndex: number;
  right: BannerSide;
  gradientColors: string; // comma-separated hex, edited as text
  textColor: string;
  badges: BannerBadge[];
  sortOrder: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

const EMPTY_FORM: BannerFormState = {
  title: '',
  subtitle: '',
  imageUrl: '',
  mobileImageUrl: '',
  overlayImage: '',
  linkType: 'url',
  linkValue: '',
  ctaLabel: '',
  slot: 'hero',
  type: 'hero',
  rowIndex: 0,
  right: {},
  gradientColors: '',
  textColor: '',
  badges: [],
  sortOrder: '',
  startsAt: '',
  expiresAt: '',
  isActive: true,
};

function BannerModal({
  visible,
  onClose,
  onSubmit,
  submitting,
  initialData,
  allBanners,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: BannerDraft, otherMoves: { id: string; rowIndex: number }[]) => void;
  submitting: boolean;
  initialData?: Banner | null;
  allBanners: Banner[];
}) {
  const isEdit = !!initialData;
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [errMsg, setErrMsg] = useState('');
  const [showPosition, setShowPosition] = useState(false);
  const [pendingMoves, setPendingMoves] = useState<{ id: string; rowIndex: number }[]>([]);

  useEffect(() => {
    if (!visible) return;
    if (initialData) {
      setForm({
        title: initialData.title ?? '',
        subtitle: initialData.subtitle ?? '',
        imageUrl: initialData.imageUrl ?? '',
        mobileImageUrl: initialData.mobileImageUrl ?? '',
        overlayImage: initialData.overlayImage ?? '',
        linkType: initialData.linkType ?? 'url',
        linkValue: initialData.linkValue ?? '',
        ctaLabel: initialData.ctaLabel ?? '',
        slot: initialData.slot ?? 'hero',
        type: initialData.type ?? 'hero',
        rowIndex: initialData.rowIndex ?? 0,
        right: initialData.right ?? {},
        gradientColors: (initialData.gradientColors ?? []).join(', '),
        textColor: initialData.textColor ?? '',
        badges: initialData.badges ?? [],
        sortOrder: initialData.sortOrder != null ? String(initialData.sortOrder) : '',
        startsAt: initialData.startsAt ? initialData.startsAt.slice(0, 10) : '',
        expiresAt: initialData.expiresAt ? initialData.expiresAt.slice(0, 10) : '',
        isActive: !!initialData.isActive,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrMsg('');
    setPendingMoves([]);
  }, [visible, initialData]);

  const update = <K extends keyof BannerFormState>(k: K, v: BannerFormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // Slots are retired; the form always shows the same content fields. Overlay,
  // gradient, and badges are hidden (BannerBlock doesn't render them for hero/dual).
  const fields = {
    showImage: true,
    showOverlayImage: false,
    showGradient: false,
    showBadges: false,
    showCta: true,
    showSubtitle: true,
  };

  // Live preview banner built from the current form state (gradientColors is a
  // comma string in this form → parse to the array BannerBlock expects).
  const previewBanner = {
    type: form.type,
    title: form.title,
    subtitle: form.subtitle,
    imageUrl: form.imageUrl,
    mobileImageUrl: form.mobileImageUrl,
    ctaLabel: form.ctaLabel,
    right: form.right,
    slot: form.slot,
    gradientColors: form.gradientColors
      ? form.gradientColors.split(',').map((c) => c.trim()).filter(Boolean)
      : [],
  } as Partial<Banner>;

  const handleSubmit = () => {
    if (!form.title.trim()) return setErrMsg('Banner title is required');

    // Parse gradient colors
    const gradient = form.gradientColors
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    setErrMsg('');
    onSubmit({
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      imageUrl: form.imageUrl.trim(),
      mobileImageUrl: form.mobileImageUrl.trim(),
      overlayImage: form.overlayImage.trim(),
      linkType: form.linkType,
      linkValue: form.linkValue.trim(),
      ctaLabel: form.ctaLabel.trim(),
      slot: form.slot,
      type: form.type,
      rowIndex: form.rowIndex,
      right: {
        imageUrl: (form.right.imageUrl ?? '').trim(),
        mobileImageUrl: (form.right.mobileImageUrl ?? '').trim(),
        title: (form.right.title ?? '').trim(),
        subtitle: (form.right.subtitle ?? '').trim(),
        ctaLabel: (form.right.ctaLabel ?? '').trim(),
        linkType: form.right.linkType ?? 'url',
        linkValue: (form.right.linkValue ?? '').trim(),
      },
      gradientColors: gradient,
      textColor: form.textColor.trim(),
      badges: form.badges.filter((b) => b.label.trim().length > 0),
      sortOrder: form.sortOrder ? Number(form.sortOrder) : 0,
      startsAt: form.startsAt || undefined,
      expiresAt: form.expiresAt || undefined,
      isActive: form.isActive,
    }, pendingMoves);
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setErrMsg('');
    onClose();
  };

  // Badge editor helpers
  const addBadge = () =>
    update('badges', [...form.badges, { label: '', color: '#16a34a' }]);
  const updateBadge = (i: number, next: Partial<BannerBadge>) =>
    update(
      'badges',
      form.badges.map((b, idx) => (idx === i ? { ...b, ...next } : b)),
    );
  const removeBadge = (i: number) =>
    update('badges', form.badges.filter((_, idx) => idx !== i));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={m.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={m.sheet}>
          {/* Header */}
          <View style={m.header}>
            <View>
              <Text style={m.title}>{isEdit ? 'Edit Banner' : 'Add Banner'}</Text>
              <Text style={m.subtitle}>
                {isEdit ? 'Update this banner' : 'Create a new banner'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={m.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={22} color="#64748b" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">

            {/* Live preview + placement */}
            <BannerPreview banner={previewBanner} />
            <TouchableOpacity
              style={[m.positionBtn, { marginTop: 12 }]}
              onPress={() => setShowPosition(true)}
              activeOpacity={0.85}
            >
              <View style={m.positionBtnMain}>
                <MapPin size={15} color="#3b82f6" strokeWidth={2.2} />
                <Text style={m.positionBtnText}>Preview & position on home</Text>
              </View>
              <View style={m.positionBtnBadge}>
                <Text style={m.positionBtnBadgeTxt}>Row {form.rowIndex}</Text>
              </View>
            </TouchableOpacity>

            {/* Type */}
            <MSectionHead icon={Layers} title="Banner type" />
            <View style={m.threeToggle}>
              {(['hero', 'dual'] as BannerType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[m.typeBtn, form.type === t && m.typeBtnActive]}
                  onPress={() => update('type', t)}
                >
                  <Text style={[m.typeBtnTxt, form.type === t && m.typeBtnTxtActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Content */}
            <MSectionHead icon={TypeIcon} title={form.type === 'dual' ? 'Left content' : 'Content'} />

            {/* Title */}
            <Text style={m.label}>Banner Title <Text style={m.req}>*</Text></Text>
            <View style={m.inputRow}>
              <MonitorPlay size={16} color="#94a3b8" strokeWidth={2} />
              <TextInput
                style={m.inputTxt}
                placeholder="e.g. Mega Sale — Up to 50% Off"
                placeholderTextColor="#9ca3af"
                value={form.title}
                onChangeText={(v) => update('title', v)}
              />
            </View>

            {/* Subtitle */}
            {fields.showSubtitle && (
              <>
                <Text style={m.label}>Subtitle</Text>
                <View style={m.inputRow}>
                  <TextInput
                    style={m.inputTxt}
                    placeholder="Short description shown below title"
                    placeholderTextColor="#9ca3af"
                    value={form.subtitle}
                    onChangeText={(v) => update('subtitle', v)}
                  />
                </View>
              </>
            )}

            {/* Images */}
            <MSectionHead icon={ImageIcon} title={form.type === 'dual' ? 'Left images' : 'Images'} />
            {fields.showImage && (
              <>
                <Text style={m.label}>Desktop Image</Text>
                <ImageUploader
                  value={form.imageUrl}
                  onChange={(url) => update('imageUrl', url)}
                  folder="chingiringi/banners"
                />
                <Text style={m.hint}>Recommended 2400 × 600 px or larger. Auto-cropped to fit — keep the key subject centered.</Text>

                <Text style={m.label}>Mobile Image</Text>
                <ImageUploader
                  value={form.mobileImageUrl}
                  onChange={(url) => update('mobileImageUrl', url)}
                  folder="chingiringi/banners"
                />
                <Text style={m.hint}>Recommended 1080 × 640 px or larger. Auto-cropped to fit.</Text>
              </>
            )}

            {/* Overlay Image */}
            {fields.showOverlayImage && (
              <>
                <Text style={m.label}>Overlay / Foreground Image</Text>
                <View style={m.inputRow}>
                  <ImageIcon size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="Optional foreground image (product / mascot)"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    keyboardType="url"
                    value={form.overlayImage}
                    onChangeText={(v) => update('overlayImage', v)}
                  />
                </View>
              </>
            )}

            {/* Gradient colors */}
            {fields.showGradient && (
              <>
                <Text style={m.label}>
                  Gradient Colors
                  <Text style={m.labelHint}> (comma-separated hex)</Text>
                </Text>
                <View style={m.inputRow}>
                  <Palette size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="#0C1021, #1A2744, #4784E2"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    value={form.gradientColors}
                    onChangeText={(v) => update('gradientColors', v)}
                  />
                </View>
                <Text style={m.hint}>Leave blank to use the slot default.</Text>
              </>
            )}

            {/* Badges */}
            {fields.showBadges && (
              <>
                <Text style={m.label}>Badges</Text>
                {form.badges.map((badge, i) => (
                  <View key={i} style={m.badgeRow}>
                    <TextInput
                      style={[m.inputTxt, m.badgeLabelInput, { color: '#fff', backgroundColor: badge.color }]}
                      placeholder="Label"
                      placeholderTextColor="rgba(255,255,255,0.7)"
                      value={badge.label}
                      onChangeText={(v) => updateBadge(i, { label: v })}
                    />
                    <TextInput
                      style={m.badgeColorInput}
                      placeholder="#hex"
                      placeholderTextColor="#9ca3af"
                      autoCapitalize="none"
                      value={badge.color}
                      onChangeText={(v) => updateBadge(i, { color: v })}
                    />
                    <TouchableOpacity onPress={() => removeBadge(i)} style={m.badgeRemove}>
                      <X size={14} color="#ef4444" strokeWidth={2.2} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity onPress={addBadge} style={m.addBadgeBtn} activeOpacity={0.85}>
                  <Plus size={14} color="#3b82f6" strokeWidth={2.2} />
                  <Text style={m.addBadgeBtnTxt}>Add Badge</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Call to action & link */}
            <MSectionHead icon={Link2} title={form.type === 'dual' ? 'Left CTA & link' : 'Call to action & link'} />
            <Text style={m.label}>Link Type</Text>
            <View style={m.threeToggle}>
              {(['url', 'category', 'deal'] as BannerLinkType[]).map((lt) => (
                <TouchableOpacity
                  key={lt}
                  style={[m.typeBtn, form.linkType === lt && m.typeBtnActive]}
                  onPress={() => update('linkType', lt)}
                >
                  <Text style={[m.typeBtnTxt, form.linkType === lt && m.typeBtnTxtActive]}>
                    {lt.charAt(0).toUpperCase() + lt.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Link Value */}
            <Text style={m.label}>
              Link Value
              <Text style={m.labelHint}>
                {form.linkType === 'url'
                  ? ' (full URL)'
                  : form.linkType === 'category'
                  ? ' (category slug)'
                  : ' (deal ID)'}
              </Text>
            </Text>
            <View style={m.inputRow}>
              <ExternalLink size={16} color="#94a3b8" strokeWidth={2} />
              <TextInput
                style={m.inputTxt}
                placeholder={
                  form.linkType === 'url'
                    ? 'https://...'
                    : form.linkType === 'category'
                    ? 'electronics'
                    : 'deal-id'
                }
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                value={form.linkValue}
                onChangeText={(v) => update('linkValue', v)}
              />
            </View>

            {/* CTA label */}
            {fields.showCta && (
              <>
                <Text style={m.label}>CTA Button Label</Text>
                <View style={m.inputRow}>
                  <TextInput
                    style={m.inputTxt}
                    placeholder="e.g. Shop Now"
                    placeholderTextColor="#9ca3af"
                    value={form.ctaLabel}
                    onChangeText={(v) => update('ctaLabel', v)}
                  />
                </View>
              </>
            )}

            {/* Dual — right half (fields above are the left half) */}
            {form.type === 'dual' && (
              <>
                <MSectionHead icon={Columns2} title="Right side" />

                <Text style={m.label}>Right Title</Text>
                <View style={m.inputRow}>
                  <MonitorPlay size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="Right half title"
                    placeholderTextColor="#9ca3af"
                    value={form.right.title ?? ''}
                    onChangeText={(v) => update('right', { ...form.right, title: v })}
                  />
                </View>

                <Text style={m.label}>Right Subtitle</Text>
                <View style={m.inputRow}>
                  <TextInput
                    style={m.inputTxt}
                    placeholder="Right half subtitle"
                    placeholderTextColor="#9ca3af"
                    value={form.right.subtitle ?? ''}
                    onChangeText={(v) => update('right', { ...form.right, subtitle: v })}
                  />
                </View>

                <Text style={m.label}>Right Desktop Image</Text>
                <ImageUploader
                  value={form.right.imageUrl ?? ''}
                  onChange={(url) => update('right', { ...form.right, imageUrl: url })}
                  folder="chingiringi/banners"
                />

                <Text style={m.label}>Right Mobile Image</Text>
                <ImageUploader
                  value={form.right.mobileImageUrl ?? ''}
                  onChange={(url) => update('right', { ...form.right, mobileImageUrl: url })}
                  folder="chingiringi/banners"
                />

                <Text style={m.label}>Right CTA Button Label</Text>
                <View style={m.inputRow}>
                  <TextInput
                    style={m.inputTxt}
                    placeholder="e.g. Shop Now"
                    placeholderTextColor="#9ca3af"
                    value={form.right.ctaLabel ?? ''}
                    onChangeText={(v) => update('right', { ...form.right, ctaLabel: v })}
                  />
                </View>

                <Text style={m.label}>Right Link Type</Text>
                <View style={m.threeToggle}>
                  {(['url', 'category', 'deal'] as BannerLinkType[]).map((lt) => (
                    <TouchableOpacity
                      key={lt}
                      style={[m.typeBtn, (form.right.linkType ?? 'url') === lt && m.typeBtnActive]}
                      onPress={() => update('right', { ...form.right, linkType: lt })}
                    >
                      <Text style={[m.typeBtnTxt, (form.right.linkType ?? 'url') === lt && m.typeBtnTxtActive]}>
                        {lt.charAt(0).toUpperCase() + lt.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={m.label}>Right Link Value</Text>
                <View style={m.inputRow}>
                  <ExternalLink size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="category slug / deal-id / /referral"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    value={form.right.linkValue ?? ''}
                    onChangeText={(v) => update('right', { ...form.right, linkValue: v })}
                  />
                </View>
              </>
            )}

            {/* Schedule & status */}
            <MSectionHead icon={Calendar} title="Schedule & status" />
            <View style={m.twoCol}>
              <View style={m.col}>
                <Text style={m.label}>Sort Order</Text>
                <View style={m.inputRow}>
                  <Hash size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="1"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    value={form.sortOrder}
                    onChangeText={(v) => update('sortOrder', v)}
                  />
                </View>
                <Text style={m.hint}>Lower = shown first</Text>
              </View>
              <View style={m.col}>
                <Text style={m.label}>Starts At</Text>
                <View style={m.inputRow}>
                  <Calendar size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9ca3af"
                    value={form.startsAt}
                    onChangeText={(v) => update('startsAt', v)}
                  />
                </View>
                <Text style={m.hint}>Blank = now</Text>
              </View>
            </View>

            {/* Expires At */}
            <Text style={m.label}>Expires At</Text>
            <View style={m.inputRow}>
              <Calendar size={16} color="#94a3b8" strokeWidth={2} />
              <TextInput
                style={m.inputTxt}
                placeholder="YYYY-MM-DD (blank = never)"
                placeholderTextColor="#9ca3af"
                value={form.expiresAt}
                onChangeText={(v) => update('expiresAt', v)}
              />
            </View>

            {/* Active toggle */}
            <View style={m.activeRow}>
              <View>
                <Text style={m.activeLabel}>{isEdit ? 'Active' : 'Active on creation'}</Text>
                <Text style={m.activeHint}>Banner will appear to users immediately</Text>
              </View>
              <Switch
                value={form.isActive}
                onValueChange={(v) => update('isActive', v)}
                trackColor={{ false: '#e2e8f0', true: '#86efac' }}
                thumbColor={form.isActive ? '#22c55e' : '#F0F4F8'}
              />
            </View>

            {errMsg ? <Text style={m.errTxt}>{errMsg}</Text> : null}

            {/* Buttons */}
            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={handleClose} activeOpacity={0.8}>
                <Text style={m.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.submitBtnWrap, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={Gradient.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={m.submitBtn}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={m.submitTxt}>{isEdit ? 'Update Banner' : 'Add Banner'}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <BannerPositionModal
            visible={showPosition}
            banners={allBanners}
            currentId={initialData?._id}
            value={form.rowIndex}
            current={{
              type: form.type,
              title: form.title,
              imageUrl: form.imageUrl,
              mobileImageUrl: form.mobileImageUrl,
              right: form.right,
            }}
            onArrange={(cur, moves) => {
              update('rowIndex', cur);
              setPendingMoves(moves);
            }}
            onClose={() => setShowPosition(false)}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main ───────────────────────────────────────────────────────────

export const MobileAdminBanners = () => {
  const nav = useNavigation<any>();
  const userName = useAuthStore((st) => st.user?.name);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [slotFilter, setSlotFilter] = useState<BannerSlot | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => adminAPI.getBanners(),
  });

  const rawBanners: Banner[] =
    res?.data?.banners ?? res?.banners ?? res?.data ?? [];
  const banners: Banner[] = withDerivedSlot(rawBanners);

  const openCreate = () => {
    setEditingBanner(null);
    setModalOpen(true);
  };
  const openEdit = (b: Banner) => {
    setEditingBanner(b);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditingBanner(null);
  };

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminAPI.updateBanner(id, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
    onError: () => Alert.alert('Error', 'Failed to update banner status.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteBanner(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
    onError: () => Alert.alert('Error', 'Failed to delete banner.'),
  });

  const createMutation = useMutation({
    mutationFn: (data: BannerDraft) => adminAPI.createBanner(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-banners'] });
      qc.invalidateQueries({ queryKey: ['banners'] });
      closeModal();
    },
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to create banner.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BannerDraft }) =>
      adminAPI.updateBanner(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-banners'] });
      qc.invalidateQueries({ queryKey: ['banners'] });
      closeModal();
    },
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to update banner.'),
  });

  const handleSubmit = async (
    data: BannerDraft,
    otherMoves: { id: string; rowIndex: number }[],
  ) => {
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
    if (editingBanner) {
      updateMutation.mutate({ id: editingBanner._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (banner: Banner) => {
    Alert.alert('Delete Banner', `Delete "${banner.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(banner._id),
      },
    ]);
  };

  const filtered = useMemo(() => {
    let list = banners;
    if (slotFilter !== 'all') {
      list = list.filter((b) => b.slot === slotFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.subtitle?.toLowerCase().includes(q) ||
          b.slot?.toLowerCase().includes(q) ||
          SLOT_INFO[b.slot]?.label.toLowerCase().includes(q),
      );
    }
    return list;
  }, [banners, search, slotFilter]);

  const activeCount = banners.filter((b) => b.isActive).length;
  const slotCounts = useMemo(() => {
    const m: Partial<Record<BannerSlot, number>> = {};
    for (const b of banners) m[b.slot] = (m[b.slot] ?? 0) + 1;
    return m;
  }, [banners]);

  if (isLoading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Shared admin header + section nav */}
        <MobileAdminNav active="AdminBanners" />

        <View style={s.body}>
          {/* Title + Add */}
          <View style={s.titleRow}>
            <View>
              <Text style={s.pageTitle}>Banner Management</Text>
              <Text style={s.pageSub}>Manage homepage and promotional banners</Text>
            </View>
            <TouchableOpacity onPress={openCreate} activeOpacity={0.85} style={s.addBtnWrap}>
              <LinearGradient
                colors={Gradient.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.addBtn}
              >
                <Plus size={16} color="#fff" strokeWidth={2.5} />
                <Text style={s.addBtnText}>Add Banner</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={s.searchRow}>
            <Search size={16} color="#94a3b8" strokeWidth={2} />
            <TextInput
              style={s.searchInput}
              placeholder="Search banners by title or slot..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <SlidersHorizontal size={16} color="#64748b" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Slot filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterChipsRow}
          >
            <TouchableOpacity
              style={[s.filterChip, slotFilter === 'all' && s.filterChipActive]}
              onPress={() => setSlotFilter('all')}
            >
              <Text
                style={[s.filterChipTxt, slotFilter === 'all' && s.filterChipTxtActive]}
              >
                All
              </Text>
            </TouchableOpacity>
            {BANNER_SLOTS.map((slot) => (
              <TouchableOpacity
                key={slot}
                style={[s.filterChip, slotFilter === slot && s.filterChipActive]}
                onPress={() => setSlotFilter(slot)}
              >
                <Text
                  style={[s.filterChipTxt, slotFilter === slot && s.filterChipTxtActive]}
                >
                  {SLOT_INFO[slot].label}
                  {slotCounts[slot] ? ` (${slotCounts[slot]})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Stats */}
          <View style={s.statsGrid}>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Total Banners</Text>
              <Text style={s.miniVal}>{banners.length}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Active</Text>
              <Text style={[s.miniVal, { color: '#22c55e' }]}>{activeCount}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Hero</Text>
              <Text style={[s.miniVal, { color: '#3b82f6' }]}>{slotCounts.hero ?? 0}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Dual Pair</Text>
              <Text style={[s.miniVal, { color: '#7c3aed' }]}>
                {(slotCounts['dual-left'] ?? 0) + (slotCounts['dual-right'] ?? 0)}
              </Text>
            </View>
          </View>

          {/* Banner cards */}
          {filtered.length === 0 ? (
            <View style={s.emptyState}>
              <Inbox size={40} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No banners found</Text>
              <Text style={s.emptySub}>
                {search || slotFilter !== 'all'
                  ? 'Try a different filter or search term.'
                  : 'Tap "+ Add Banner" to create your first banner.'}
              </Text>
            </View>
          ) : (
            filtered.map((banner) => (
              <BannerCard
                key={banner._id}
                banner={banner}
                onToggle={() =>
                  toggleMutation.mutate({ id: banner._id, isActive: banner.isActive })
                }
                onEdit={() => openEdit(banner)}
                onDelete={() => handleDelete(banner)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Create / Edit Banner Modal */}
      <BannerModal
        visible={modalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
        initialData={editingBanner}
        allBanners={banners}
      />
    </SafeAreaView>
  );
};

// ─── Page Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoTxt: { fontSize: 16, fontFamily: Fonts.extraBold, color: '#3b82f6' },
  headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: '#fff' },
  headerSub: { fontSize: 11, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.7)' },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTxt: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },

  navScroll: { backgroundColor: '#3b82f6', paddingBottom: 12 },
  navContent: { paddingHorizontal: 12, gap: 4 },
  navTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  navTabActive: { backgroundColor: '#fff' },
  navLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.75)',
  },
  navLabelActive: { color: '#3b82f6', fontFamily: Fonts.bold },

  body: { paddingHorizontal: 16, paddingTop: 16 },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  pageTitle: { fontSize: 22, fontFamily: Fonts.extraBold, color: '#1e293b' },
  pageSub: { fontSize: 12, fontFamily: Fonts.regular, color: '#94a3b8', marginTop: 2 },
  addBtnWrap: { borderRadius: 10, overflow: 'hidden' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: '#1e293b' },

  filterChipsRow: { gap: 6, paddingVertical: 2, paddingRight: 16 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  filterChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  filterChipTxt: { fontSize: 11, fontFamily: Fonts.semiBold, color: '#64748b' },
  filterChipTxtActive: { color: '#fff' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 16 },
  miniStat: {
    width: '48%' as any,
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  miniLabel: { fontSize: 11, fontFamily: Fonts.regular, color: '#94a3b8', marginBottom: 4 },
  miniVal: { fontSize: 20, fontFamily: Fonts.extraBold, color: '#1e293b' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardImageArea: { height: 160, backgroundColor: '#1e293b', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  placeholderTxt: { fontSize: 12, fontFamily: Fonts.semiBold, color: 'rgba(255,255,255,0.95)' },

  overlayBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  overlayActive: { backgroundColor: 'rgba(220,252,231,0.92)' },
  overlayInactive: { backgroundColor: 'rgba(241,245,249,0.92)' },
  overlayBadgeText: { fontSize: 11, fontFamily: Fonts.semiBold },
  overlayActiveText: { color: '#16a34a' },
  overlayInactiveText: { color: '#94a3b8' },
  sortBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sortBadgeText: { fontSize: 11, fontFamily: Fonts.bold, color: '#fff' },

  cardBody: { padding: 14 },
  cardTitle: { fontSize: 17, fontFamily: Fonts.bold, color: '#1e293b', marginBottom: 2 },
  cardSubtitle: { fontSize: 12, fontFamily: Fonts.regular, color: '#94a3b8', marginBottom: 10 },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  slotPillText: { fontSize: 11, fontFamily: Fonts.semiBold, color: '#3b82f6' },
  pillNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    flex: 1,
  },
  pillNeutralText: { fontSize: 11, fontFamily: Fonts.medium, color: '#64748b', flexShrink: 1 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  toggleBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#64748b' },
  iconBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.semiBold, color: '#94a3b8', marginTop: 12 },
  emptySub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#cbd5e1',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 240,
  },
});

// ─── Modal Styles ────────────────────────────────────────────────────

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%' as any,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: { fontSize: 18, fontFamily: Fonts.extraBold, color: '#1e293b' },
  subtitle: { fontSize: 12, fontFamily: Fonts.regular, color: '#94a3b8', marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },

  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },

  sectionHead: { fontSize: 14, fontFamily: Fonts.extraBold, color: '#1e293b', marginBottom: 2 },
  sectionDesc: { fontSize: 12, fontFamily: Fonts.regular, color: '#94a3b8', marginBottom: 10 },

  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  slotTile: {
    width: '48%' as any,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#F0F4F8',
  },
  slotTileActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  slotTilePreview: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotTileLabel: { fontSize: 12, fontFamily: Fonts.bold, color: '#1e293b' },
  slotTileLabelActive: { color: '#3b82f6' },
  slotTileDesc: { fontSize: 10, fontFamily: Fonts.regular, color: '#94a3b8', marginTop: 2, lineHeight: 13 },
  slotTileCount: { fontSize: 10, fontFamily: Fonts.semiBold, color: '#22c55e', marginTop: 3 },

  warnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  warnTxt: { flex: 1, fontSize: 11, fontFamily: Fonts.medium, color: '#78350f', lineHeight: 15 },

  label: { fontSize: 12, fontFamily: Fonts.bold, color: '#475569', marginBottom: 6, marginTop: 10 },
  labelHint: { fontFamily: Fonts.regular, color: '#94a3b8' },
  req: { color: '#ef4444' },
  hint: { fontSize: 10, fontFamily: Fonts.regular, color: '#94a3b8', marginTop: 4 },
  positionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  positionBtnMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  positionBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#3b82f6' },
  positionBtnBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  positionBtnBadgeTxt: { fontSize: 12, fontFamily: Fonts.bold, color: '#2563eb' },

  // Section header (icon chip + title + hairline)
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 20, marginBottom: 2, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  sectionIcon: {
    width: 24, height: 24, borderRadius: 7,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 13, fontFamily: Fonts.extraBold, color: '#1e293b', letterSpacing: 0.2 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F4F8',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  inputTxt: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1e293b',
    paddingVertical: 10,
  },

  threeToggle: { flexDirection: 'row', gap: 6 },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#F0F4F8',
  },
  typeBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  typeBtnTxt: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#64748b' },
  typeBtnTxtActive: { color: '#fff' },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  badgeLabelInput: {
    flex: 1.4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 12,
    fontFamily: Fonts.bold,
  },
  badgeColorInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 12,
    fontFamily: Fonts.regular,
    backgroundColor: '#F0F4F8',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    color: '#1e293b',
  },
  badgeRemove: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#bfdbfe',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  addBadgeBtnTxt: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#3b82f6' },

  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },

  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  activeLabel: { fontSize: 13, fontFamily: Fonts.bold, color: '#1e293b' },
  activeHint: { fontSize: 11, fontFamily: Fonts.regular, color: '#94a3b8', marginTop: 2 },

  errTxt: { fontSize: 13, fontFamily: Fonts.regular, color: '#ef4444', marginTop: 12, textAlign: 'center' },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelTxt: { fontSize: 14, fontFamily: Fonts.bold, color: '#64748b' },
  submitBtnWrap: { flex: 1.4, borderRadius: 12, overflow: 'hidden' },
  submitBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
  submitTxt: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
});
