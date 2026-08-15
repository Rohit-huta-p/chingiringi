import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X, FileSpreadsheet, Link2, Sparkles, Trash2, ArrowLeft, Check, AlertCircle, CheckCircle2,
} from 'lucide-react-native';
import { adminAPI } from '../api/admin';
import { cloudinaryFill } from '../utils/cloudinary';
import { importRemoteImage, cloudinaryConfigured } from './useImageUpload';
import { CategoryPicker } from './CategoryPicker';
import { Colors, Gradient } from '../constants/theme';
import {
  type Draft, EMPTY_DRAFT, draftValid, draftToPayload, parseTable,
} from '../utils/bulkImport';

// Bulk product import: paste a CSV/TSV table, OR paste many buy links and let the
// scraper draft each one. Both funnel into one editable preview → POST /products/bulk.
// Parsing/validation lives in ../utils/bulkImport (pure + unit-tested).
// ponytail: preview is a plain ScrollView — fine for the realistic <~50 rows/paste;
// revisit with a FlatList if someone routinely imports hundreds at once.

const MAX_LINK_FETCH = 40;

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful import so the list can refetch. */
  onImported: () => void;
}

export const BulkImportModal: React.FC<Props> = ({ visible, onClose, onImported }) => {
  const { width: winW, height: winH } = useWindowDimensions();
  const narrow = winW < 880;

  const [mode, setMode] = useState<'csv' | 'links'>('csv');
  const [step, setStep] = useState<'input' | 'preview' | 'done'>('input');
  const [raw, setRaw] = useState('');
  const [parseErr, setParseErr] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  // One label for whichever async pass is running (reading links / hosting images).
  const [busy, setBusy] = useState<{ label: string; done: number; total: number } | null>(null);
  const [hostFails, setHostFails] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: number } | null>(null);

  const reset = () => {
    setMode('csv'); setStep('input'); setRaw(''); setParseErr('');
    setDrafts([]); setBusy(null); setHostFails(0);
    setSubmitting(false); setResult(null);
  };
  const close = () => { reset(); onClose(); };

  const validCount = useMemo(() => drafts.filter(draftValid).length, [drafts]);

  // Import every draft's image URLs into Cloudinary so the admin never downloads
  // + re-uploads. Already-hosted Cloudinary URLs pass through; a failed import
  // keeps the original link (hotlink) rather than dropping the image. Sequential
  // with honest progress. ponytail: fine for ~50 rows; add concurrency if imports
  // of hundreds of images become the bottleneck.
  const hostDrafts = async (ds: Draft[]): Promise<Draft[]> => {
    const total = ds.reduce((n, d) => n + d.images.length + d.mobileImages.length, 0);
    if (!cloudinaryConfigured || total === 0) { setBusy(null); return ds; }
    let done = 0;
    let fails = 0;
    setBusy({ label: 'Hosting images', done, total });
    const hostList = async (urls: string[]) => {
      const out: string[] = [];
      for (const u of urls) {
        try { out.push(await importRemoteImage(u, 'chingiringi/products')); }
        catch { out.push(u); fails++; }
        done++;
        setBusy({ label: 'Hosting images', done, total });
      }
      return out;
    };
    const hosted: Draft[] = [];
    for (const d of ds) {
      hosted.push({ ...d, images: await hostList(d.images), mobileImages: await hostList(d.mobileImages) });
    }
    setHostFails(fails);
    setBusy(null);
    return hosted;
  };

  // CSV/TSV → drafts → host images → preview.
  const handleParse = async () => {
    const { drafts: d, error } = parseTable(raw);
    if (error) { setParseErr(error); return; }
    setParseErr('');
    setDrafts(await hostDrafts(d));
    setStep('preview');
  };

  // Links → scrape each → host images → preview. Sequential so progress is honest
  // and we don't hammer the target host. Unreadable links still yield a row (URL
  // prefilled) for manual completion in the preview.
  const handleFetchLinks = async () => {
    const urls = raw
      .replace(/\r/g, '').split('\n').map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u))
      .slice(0, MAX_LINK_FETCH);
    if (!urls.length) { setParseErr('Paste at least one http(s) link, one per line.'); return; }
    setParseErr('');
    setBusy({ label: 'Reading links', done: 0, total: urls.length });
    const out: Draft[] = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const res = await adminAPI.fetchUrlMeta(url);
        const m = res?.data ?? ({} as any);
        const imgs = (m.images?.length ? m.images : m.image ? [m.image] : []).filter(Boolean);
        out.push({
          ...EMPTY_DRAFT,
          name: m.title || '',
          description: m.description || '',
          price: m.price != null ? String(m.price) : '',
          mrp: m.mrp != null ? String(m.mrp) : '',
          merchant: m.merchant || '',
          affiliateUrl: url,
          images: imgs,
          rating: m.rating != null ? String(m.rating) : '',
          ratingCount: m.ratingCount != null ? String(m.ratingCount) : '',
        });
      } catch {
        out.push({ ...EMPTY_DRAFT, affiliateUrl: url });
      }
      setBusy({ label: 'Reading links', done: i + 1, total: urls.length });
    }
    setDrafts(await hostDrafts(out));
    setStep('preview');
  };

  const updateDraft = (i: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const removeDraft = (i: number) => setDrafts((ds) => ds.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    const payload = drafts.filter(draftValid).map(draftToPayload);
    if (!payload.length) return;
    setSubmitting(true);
    try {
      const res = await adminAPI.bulkCreateProducts(payload);
      const data = res?.data ?? {};
      setResult({ created: Number(data.created) || 0, failed: Number(data.failed) || 0 });
      setStep('done');
      onImported();
    } catch (e: any) {
      setParseErr(e?.response?.data?.message || 'Import failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const CSV_PLACEHOLDER =
    'name\tprice\tmrp\tcategory\tmerchant\taffiliateUrl\timageUrl\trating\tratingCount\n' +
    'Wireless Earbuds\t1299\t2999\tElectronics\tAmazon\thttps://amzn.in/abc\thttps://…/a.jpg\t4.3\t512';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={st.overlay}
      >
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={close} />

        <View style={[st.card, { maxHeight: winH * 0.92 }, narrow && { flex: 1 }]}>
          {/* Header */}
          <View style={st.header}>
            <View style={st.headerLeft}>
              <View style={st.headerBadge}>
                <FileSpreadsheet size={16} color="#fff" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>Bulk import</Text>
                <Text style={st.subtitle}>
                  {step === 'preview'
                    ? `${drafts.length} row${drafts.length === 1 ? '' : 's'} · ${validCount} ready`
                    : 'Add many products at once'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={close} style={st.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.textSecondary} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {/* ── Step: input ─────────────────────────────────────────────── */}
          {step === 'input' && (
            <>
              <View style={st.tabs}>
                <ModeTab active={mode === 'csv'} icon={FileSpreadsheet} label="Paste CSV / table" onPress={() => setMode('csv')} />
                <ModeTab active={mode === 'links'} icon={Link2} label="Paste links" onPress={() => setMode('links')} />
              </View>

              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
                {mode === 'csv' ? (
                  <>
                    <Text style={st.hint}>
                      Paste rows copied from Google Sheets / Excel (tab-separated) or a CSV. The first
                      row must be a header. <Text style={st.hintStrong}>name</Text> and{' '}
                      <Text style={st.hintStrong}>price</Text> are required; the rest are optional:
                      mrp, category, merchant, affiliateUrl, imageUrl, mobileImageUrl, rating, ratingCount,
                      description. Multiple images → separate with “|”. Image URLs are auto-hosted to
                      Cloudinary on import — no downloading needed.
                    </Text>
                    <TextInput
                      style={[st.input, st.textarea]}
                      placeholder={CSV_PLACEHOLDER}
                      placeholderTextColor="#94a3b8"
                      value={raw}
                      onChangeText={setRaw}
                      multiline
                      textAlignVertical="top"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </>
                ) : (
                  <>
                    <Text style={st.hint}>
                      Paste product buy links, one per line (up to {MAX_LINK_FETCH}). We’ll read each
                      page for title, images, price, MRP, rating and merchant, then let you review before
                      saving. Some sites (Amazon especially) block this — those rows come back blank to
                      fill in manually.
                    </Text>
                    <TextInput
                      style={[st.input, st.textarea]}
                      placeholder={'https://www.flipkart.com/...\nhttps://www.myntra.com/...\nhttps://...'}
                      placeholderTextColor="#94a3b8"
                      value={raw}
                      onChangeText={setRaw}
                      multiline
                      textAlignVertical="top"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                  </>
                )}
                {parseErr ? <Text style={st.errText}>{parseErr}</Text> : null}
                {busy ? (
                  <View style={st.progressRow}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={st.progressText}>{busy.label}… {busy.done}/{busy.total}</Text>
                  </View>
                ) : null}
              </ScrollView>

              <View style={st.footer}>
                <TouchableOpacity style={st.cancelBtn} onPress={close} activeOpacity={0.85}>
                  <Text style={st.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.primaryWrap, (!!busy || !raw.trim()) && { opacity: 0.6 }]}
                  onPress={mode === 'csv' ? handleParse : handleFetchLinks}
                  disabled={!!busy || !raw.trim()}
                  activeOpacity={0.9}
                >
                  <LinearGradient colors={Gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.primaryBtn}>
                    {busy
                      ? <ActivityIndicator color="#fff" />
                      : (
                        <>
                          <Sparkles size={15} color="#fff" strokeWidth={2.4} />
                          <Text style={st.primaryText}>{mode === 'csv' ? 'Preview rows' : 'Fetch & preview'}</Text>
                        </>
                      )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Step: preview ───────────────────────────────────────────── */}
          {step === 'preview' && (
            <>
              <ScrollView contentContainerStyle={st.previewBody} keyboardShouldPersistTaps="handled">
                {hostFails > 0 ? (
                  <View style={st.hostWarn}>
                    <AlertCircle size={14} color="#b45309" strokeWidth={2.4} />
                    <Text style={st.hostWarnText}>
                      {hostFails} image{hostFails === 1 ? '' : 's'} couldn’t be auto-hosted — kept the original link.
                    </Text>
                  </View>
                ) : null}
                {drafts.map((d, i) => {
                  const ok = draftValid(d);
                  const thumb = d.images[0] ? (cloudinaryFill(d.images[0], 96, 96) ?? d.images[0]) : '';
                  return (
                    <View key={i} style={[st.row, !ok && st.rowInvalid]}>
                      <View style={st.thumb}>
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        ) : (
                          <Text style={st.thumbLetter}>{d.name.trim()[0]?.toUpperCase() ?? '?'}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1, gap: 6 }}>
                        <TextInput
                          style={st.rowNameInput}
                          placeholder="Product name *"
                          placeholderTextColor="#94a3b8"
                          value={d.name}
                          onChangeText={(v) => updateDraft(i, { name: v })}
                        />
                        <View style={st.rowMetaLine}>
                          <TextInput
                            style={st.rowPriceInput}
                            placeholder="₹ price *"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            value={d.price}
                            onChangeText={(v) => updateDraft(i, { price: v.replace(/[^0-9.]/g, '') })}
                          />
                          {/* Same category control as the add-product form —
                              picks from existing categories, create-on-type. */}
                          <View style={{ flex: 1 }}>
                            <CategoryPicker
                              value={d.category}
                              onChange={(v) => updateDraft(i, { category: v })}
                            />
                          </View>
                        </View>
                        {(d.merchant || d.mrp || d.rating) ? (
                          <Text style={st.rowSub} numberOfLines={1}>
                            {[
                              d.merchant,
                              d.mrp && `MRP ₹${d.mrp}`,
                              d.rating && `★ ${d.rating}${d.ratingCount ? ` (${d.ratingCount})` : ''}`,
                            ].filter(Boolean).join('  ·  ')}
                          </Text>
                        ) : null}
                      </View>
                      <View style={st.rowRight}>
                        {ok
                          ? <Check size={16} color={Colors.success} strokeWidth={2.6} />
                          : <AlertCircle size={16} color={Colors.danger} strokeWidth={2.4} />}
                        <TouchableOpacity onPress={() => removeDraft(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Trash2 size={15} color={Colors.textSecondary} strokeWidth={2.2} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
                {drafts.length === 0 ? (
                  <Text style={st.hint}>No rows parsed. Go back and check the format.</Text>
                ) : null}
                {parseErr ? <Text style={st.errText}>{parseErr}</Text> : null}
              </ScrollView>

              <View style={st.footer}>
                <TouchableOpacity style={st.cancelBtn} onPress={() => setStep('input')} activeOpacity={0.85} disabled={submitting}>
                  <View style={st.backInner}>
                    <ArrowLeft size={15} color={Colors.text} strokeWidth={2.4} />
                    <Text style={st.cancelBtnText}>Back</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.primaryWrap, (submitting || validCount === 0) && { opacity: 0.6 }]}
                  onPress={handleCreate}
                  disabled={submitting || validCount === 0}
                  activeOpacity={0.9}
                >
                  <LinearGradient colors={Gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.primaryBtn}>
                    {submitting
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={st.primaryText}>Create {validCount} product{validCount === 1 ? '' : 's'}</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Step: done ──────────────────────────────────────────────── */}
          {step === 'done' && result && (
            <View style={st.doneBox}>
              <View style={st.doneIcon}>
                <CheckCircle2 size={40} color={Colors.success} strokeWidth={2} />
              </View>
              <Text style={st.doneTitle}>
                {result.created} product{result.created === 1 ? '' : 's'} added
              </Text>
              {result.failed > 0 ? (
                <Text style={st.doneSub}>{result.failed} row{result.failed === 1 ? '' : 's'} were skipped (missing name or price).</Text>
              ) : (
                <Text style={st.doneSub}>They’re live in the store now.</Text>
              )}
              <TouchableOpacity style={st.doneBtnWrap} onPress={close} activeOpacity={0.9}>
                <LinearGradient colors={Gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.primaryBtn}>
                  <Text style={st.primaryText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

function ModeTab({ active, icon: Icon, label, onPress }: { active: boolean; icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[st.tab, active && st.tabActive]} onPress={onPress} activeOpacity={0.85}>
      <Icon size={15} color={active ? Colors.primary : Colors.textSecondary} strokeWidth={2.4} />
      <Text style={[st.tabText, active && st.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 32, elevation: 10,
  },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eef2f7',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: Colors.text, letterSpacing: -0.2 },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 16 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#f8fafc',
  },
  tabActive: { borderColor: Colors.primary, backgroundColor: '#eff6ff' },
  tabText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },

  body: { padding: 20, gap: 12 },
  hint: { fontSize: 12.5, lineHeight: 18, color: Colors.textSecondary },
  hintStrong: { fontWeight: '800', color: Colors.text },
  input: {
    borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: Colors.text,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  textarea: {
    minHeight: 180, paddingTop: 12,
    ...(Platform.OS === 'web' ? ({ fontFamily: 'monospace' } as any) : {}),
  },
  errText: { fontSize: 12.5, color: Colors.danger, fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { fontSize: 12.5, color: Colors.textSecondary, fontWeight: '600' },

  // Preview
  previewBody: { padding: 16, gap: 10 },
  hostWarn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  hostWarnText: { flex: 1, fontSize: 12, color: '#92400e', fontWeight: '600' },
  row: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 10, backgroundColor: '#fff',
  },
  rowInvalid: { borderColor: '#fecaca', backgroundColor: '#fff8f8' },
  thumb: {
    width: 52, height: 52, borderRadius: 8, backgroundColor: Colors.background,
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
  },
  thumbLetter: { fontSize: 20, fontWeight: '800', color: Colors.primaryLight },
  rowNameInput: {
    fontSize: 14, fontWeight: '700', color: Colors.text, paddingVertical: 4, paddingHorizontal: 0,
    borderBottomWidth: 1, borderBottomColor: '#eef2f7',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  rowMetaLine: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rowPriceInput: {
    width: 92, minHeight: 44, fontSize: 13, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  rowSub: { fontSize: 11.5, color: Colors.textSecondary },
  rowRight: { alignItems: 'center', gap: 12, paddingTop: 2 },

  // Footer / buttons
  footer: { flexDirection: 'row', gap: 10, padding: 20, paddingBottom: Platform.OS === 'ios' ? 24 : 20, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  backInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cancelBtnText: { color: Colors.text, fontWeight: '600', fontSize: 14 },
  primaryWrap: { flex: 2, borderRadius: 10, overflow: 'hidden' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Done
  doneBox: { padding: 32, alignItems: 'center', gap: 8 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  doneTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  doneSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  doneBtnWrap: { marginTop: 16, borderRadius: 10, overflow: 'hidden', alignSelf: 'stretch' },
});

export default BulkImportModal;
