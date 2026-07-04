import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable,
  ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X, AlertTriangle, ChevronDown, Sparkles, Trash2,
} from 'lucide-react-native';
import { Colors, Fonts, Gradient } from '../constants/theme';

/**
 * Modal for confirming account deletion. Shown over the Settings screen.
 *
 * UX notes:
 * - Dropdown collects a deletion reason (used for analytics, not required).
 * - A soft retention message is shown above the buttons.
 * - Primary CTA is "Special Deals For You" (not "Cancel") — last attempt to
 *   keep the user around by reminding them of the value they'd lose.
 * - The destructive "Delete Forever" button only enables once a reason is
 *   picked, to add one more moment of friction.
 */
interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called when the user confirms deletion. */
  onConfirmDelete: (reason: string) => void;
  /** Called when the user taps "Special Deals For You" — caller should
   *  close the modal AND navigate to the deals tab. */
  onShowDeals: () => void;
  isDeleting?: boolean;
}

const REASONS = [
  'Not earning enough cashback',
  'Found a better app',
  'Too many notifications',
  'Privacy concerns',
  'Not shopping online anymore',
  'Other',
];

export const DeleteAccountModal: React.FC<Props> = ({
  visible, onClose, onConfirmDelete, onShowDeals, isDeleting,
}) => {
  const [reason, setReason] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Reset internal state every time the modal closes so reopening starts fresh.
  React.useEffect(() => {
    if (!visible) {
      setReason('');
      setDropdownOpen(false);
    }
  }, [visible]);

  const canDelete = reason.length > 0 && !isDeleting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        {/* Inner Pressable blocks the backdrop press so taps inside the
            card don't dismiss the modal. */}
        <Pressable style={s.cardWrap} onPress={() => {}}>
          <View style={s.card}>
            {/* ── Header ─────────────────────────────────────── */}
            <View style={s.headerRow}>
              <View style={s.iconCircle}>
                <AlertTriangle size={20} color="#ef4444" strokeWidth={2.2} />
              </View>
              <Text style={s.title}>Delete Account</Text>
              <TouchableOpacity
                style={s.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#64748b" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {/* ── Reason dropdown ────────────────────────────── */}
            <Text style={s.fieldLabel}>Select reason for deleting account</Text>
            <TouchableOpacity
              style={s.dropdown}
              activeOpacity={0.75}
              onPress={() => setDropdownOpen((v) => !v)}
            >
              <Text style={[s.dropdownText, !reason && { color: '#94a3b8' }]}>
                {reason || 'Reason'}
              </Text>
              <ChevronDown
                size={18}
                color="#64748b"
                strokeWidth={2}
                style={{ transform: [{ rotate: dropdownOpen ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {dropdownOpen ? (
              <View style={s.dropdownList}>
                <ScrollView
                  style={{ maxHeight: 180 }}
                  showsVerticalScrollIndicator={false}
                >
                  {REASONS.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[s.dropdownItem, reason === r && s.dropdownItemActive]}
                      onPress={() => { setReason(r); setDropdownOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          s.dropdownItemText,
                          reason === r && s.dropdownItemTextActive,
                        ]}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* ── Retention message (blue, ABOVE) ────────────── */}
            <View style={s.retentionCard}>
              <Text style={s.retentionTitle}>Wait — before you go 💙</Text>
              <Text style={s.retentionBody}>
                You're already shopping online anyway. Every small cashback adds up
                fast — give it a few weeks and you'll see a real pile of pocket
                money show up. One tap from here, that's it.
              </Text>
            </View>

            {/* ── Warning card (red, BELOW) ──────────────────── */}
            <View style={s.warningCard}>
              <Text style={s.warningTitle}>⚠️ This action cannot be undone</Text>
              <Text style={s.warningLine}>All your cashback will be forfeited</Text>
              <Text style={s.warningLine}>Your coins balance will be lost</Text>
              <Text style={s.warningLine}>Transaction history will be deleted</Text>
              <Text style={s.warningLine}>Referral data will be removed</Text>
            </View>

            {/* ── Action buttons ─────────────────────────────── */}
            <View style={s.actionsRow}>
              <TouchableOpacity
                style={[s.deleteBtn, !canDelete && { opacity: 0.5 }]}
                onPress={() => canDelete && onConfirmDelete(reason)}
                disabled={!canDelete}
                activeOpacity={0.85}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Trash2 size={15} color="#fff" strokeWidth={2.2} />
                    <Text style={s.deleteBtnText}>Delete Forever</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.dealsBtnWrap}
                onPress={onShowDeals}
                activeOpacity={0.85}
                disabled={isDeleting}
              >
                <LinearGradient
                  colors={Gradient.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.dealsBtn}
                >
                  <Sparkles size={15} color="#fff" strokeWidth={2.2} />
                  <Text style={s.dealsBtnText}>Special Deals For You</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardWrap: { width: '100%', maxWidth: 420 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 20px 50px rgba(15,23,42,0.25)' } as any)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 20 },
          shadowRadius: 30,
          elevation: 14,
        }),
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: '#0f172a',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Dropdown
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#0f172a',
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#0f172a',
  },
  dropdownList: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownItemActive: { backgroundColor: '#eff6ff' },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#334155',
  },
  dropdownItemTextActive: { color: Colors.primary, fontFamily: Fonts.bold },

  // Warning
  warningCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#dc2626',
    marginBottom: 6,
  },
  warningLine: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#dc2626',
    marginTop: 2,
  },

  // Retention
  retentionCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  retentionTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#1e40af',
    marginBottom: 4,
  },
  retentionBody: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#1e3a8a',
    lineHeight: 17,
  },

  // Buttons
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  deleteBtn: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  dealsBtnWrap: {
    flex: 1.4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  dealsBtn: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealsBtnText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
});

export default DeleteAccountModal;
