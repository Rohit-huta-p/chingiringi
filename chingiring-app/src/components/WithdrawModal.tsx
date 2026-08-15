import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Spacing } from '../constants/theme';
import { walletAPI } from '../api/wallet';
import { useAuthStore } from '../store';
import { EmailVerifyModal } from './EmailVerifyModal';

interface WithdrawModalProps {
  visible: boolean;
  onClose: () => void;
  /** Withdrawable coin balance (coins, not ₹). */
  coinBalance: number;
}

const QUICK_AMOUNTS = [100, 500, 1000];
const MIN_WITHDRAW = 100; // ₹
const COINS_PER_RUPEE = 1000; // mirrors AdminSettings default; ₹ ↔ coins

// react-native-web's Alert is a no-op — route through window.alert on web so
// the user actually sees the result.
function notify(title: string, message?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ visible, onClose, coinBalance }) => {
  const qc = useQueryClient();
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [amount, setAmount] = useState('');
  const [verifyOpen, setVerifyOpen] = useState(false);
  const user = useAuthStore((st) => st.user);
  const hydrate = useAuthStore((st) => st.hydrate);

  // Withdrawal is coin-based server-side; the UI is in ₹. Convert the balance
  // to a ₹ ceiling, and the entered ₹ back to coins on submit.
  const availableRupees = Math.floor((coinBalance ?? 0) / COINS_PER_RUPEE);
  const amountNum = Number(amount) || 0;
  const coinsToRedeem = Math.round(amountNum * COINS_PER_RUPEE);
  const overBalance = amountNum > availableRupees;

  // At least one payout destination is required. A bank transfer only counts
  // once BOTH the account number and IFSC are present; UPI needs just the ID.
  const hasUpi = upiId.trim().length > 0;
  const hasBank = accountNumber.trim().length > 0 && ifsc.trim().length > 0;

  const resetAndClose = () => {
    setUpiId('');
    setAccountNumber('');
    setIfsc('');
    setAmount('');
    onClose();
  };

  const mutation = useMutation({
    mutationFn: () => walletAPI.requestWithdrawal({
      coins: coinsToRedeem,
      // Both rails are required, so the admin gets everything: UPI as the
      // method + paymentDetails, with bank account number + IFSC attached.
      method: 'UPI',
      paymentDetails: upiId.trim(),
      accountNumber: accountNumber.trim(),
      ifsc: ifsc.trim(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['walletSummary'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      notify('Request submitted', `Your ₹${amountNum.toLocaleString('en-IN')} withdrawal is under review.`);
      resetAndClose();
    },
    onError: (e: any) =>
      notify('Withdrawal failed', e?.response?.data?.message || e?.message || 'Please try again.'),
  });

  // Admin pays out by hand and needs BOTH rails on file, so both are required:
  // a UPI ID and complete bank details (account number + IFSC).
  const validDest = hasUpi && hasBank;
  const canConfirm = validDest && amountNum >= MIN_WITHDRAW && !overBalance && !mutation.isPending;

  const handleQuickAmount = (value: number) => {
    setAmount(String(value));
  };

  // Fire the withdrawal (guards re-checked so the post-verification path is safe).
  const submit = () => {
    if (validDest && amountNum >= MIN_WITHDRAW && !overBalance) mutation.mutate();
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    if (!user?.isEmailVerified) { setVerifyOpen(true); return; }
    submit();
  };

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={resetAndClose}
    >
      <Pressable style={styles.overlay} onPress={resetAndClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Withdraw Funds</Text>
            <TouchableOpacity onPress={resetAndClose} activeOpacity={0.7}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Available Balance */}
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Available</Text>
            <View style={styles.balanceValueRow}>
              <Text style={styles.balanceAmount}>₹{availableRupees.toLocaleString('en-IN')}</Text>
              <Text style={styles.balanceCheck}>✓</Text>
            </View>
            <Text style={styles.balanceSub}>{(coinBalance ?? 0).toLocaleString('en-IN')} coins</Text>
          </View>

          {/* Withdraw To — admin needs BOTH rails; both are required */}
          <View style={styles.sectionHead}>
            <Text style={styles.fieldLabel}>WITHDRAW TO</Text>
            <Text style={styles.hint}>Both required</Text>
          </View>

          {/* UPI */}
          <Text style={styles.subLabel}>UPI ID <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="yourname@bank"
            placeholderTextColor={Colors.textSecondary}
            value={upiId}
            onChangeText={setUpiId}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Bank */}
          <Text style={[styles.subLabel, { marginTop: Spacing.md }]}>Bank account <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Account number"
            placeholderTextColor={Colors.textSecondary}
            value={accountNumber}
            onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />
          <TextInput
            style={[styles.input, { marginTop: Spacing.sm }]}
            placeholder="IFSC code"
            placeholderTextColor={Colors.textSecondary}
            value={ifsc}
            onChangeText={(t) => setIfsc(t.toUpperCase().replace(/\s/g, ''))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={11}
          />

          {/* Amount */}
          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>AMOUNT</Text>
          <TextInput
            style={styles.input}
            placeholder={`Minimum ₹${MIN_WITHDRAW}`}
            placeholderTextColor={Colors.textSecondary}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
          />
          {amountNum > 0 && (overBalance || amountNum < MIN_WITHDRAW) ? (
            <Text style={styles.amountError}>
              {overBalance
                ? `You can withdraw up to ₹${availableRupees.toLocaleString('en-IN')}`
                : `Minimum withdrawal is ₹${MIN_WITHDRAW}`}
            </Text>
          ) : null}

          {/* Quick Amount Pills */}
          <View style={styles.pillRow}>
            {QUICK_AMOUNTS.map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.pill, amount === String(val) && styles.pillActive]}
                onPress={() => handleQuickAmount(val)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.pillText, amount === String(val) && styles.pillTextActive]}
                >
                  ₹{val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>
              {mutation.isPending ? 'Submitting…' : 'Confirm Withdrawal'}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
    <EmailVerifyModal
      visible={verifyOpen}
      email={user?.email}
      onClose={() => setVerifyOpen(false)}
      onVerified={async () => { await hydrate(); setVerifyOpen(false); submit(); }}
    />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    fontSize: 20,
    color: Colors.textSecondary,
    padding: Spacing.xs,
  },

  // Balance
  balanceRow: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  balanceLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.success,
  },
  balanceCheck: {
    fontSize: 18,
    color: Colors.success,
    marginLeft: Spacing.sm,
  },
  balanceSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Labels
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  hint: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  req: { color: Colors.danger, fontWeight: '700' },

  // Inputs
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: '#ffffff',
  },
  amountError: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 6,
  },

  // Quick amount pills
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  pillActive: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // Confirm
  confirmButton: {
    height: 50,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
