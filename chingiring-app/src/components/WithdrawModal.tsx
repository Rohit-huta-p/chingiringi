import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
} from 'react-native';
import { Colors, Spacing } from '../constants/theme';

interface WithdrawModalProps {
  visible: boolean;
  onClose: () => void;
}

type WithdrawTab = 'UPI' | 'Bank' | 'Paytm';

const QUICK_AMOUNTS = [100, 500, 1000];

const TAB_PLACEHOLDERS: Record<WithdrawTab, string> = {
  UPI: 'Enter UPI ID',
  Bank: 'Enter bank account number',
  Paytm: 'Enter Paytm number',
};

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState<WithdrawTab>('UPI');
  const [accountInput, setAccountInput] = useState('');
  const [amount, setAmount] = useState('');

  const handleQuickAmount = (value: number) => {
    setAmount(String(value));
  };

  const handleConfirm = () => {
    // TODO: wire up withdrawal API
    onClose();
  };

  const resetAndClose = () => {
    setAccountInput('');
    setAmount('');
    setActiveTab('UPI');
    onClose();
  };

  return (
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
              <Text style={styles.balanceAmount}>₹1250</Text>
              <Text style={styles.balanceCheck}>✓</Text>
            </View>
          </View>

          {/* Withdraw To Tabs */}
          <Text style={styles.fieldLabel}>WITHDRAW TO</Text>
          <View style={styles.tabRow}>
            {(['UPI', 'Bank', 'Paytm'] as WithdrawTab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Account Input */}
          <TextInput
            style={styles.input}
            placeholder={TAB_PLACEHOLDERS[activeTab]}
            placeholderTextColor={Colors.textSecondary}
            value={accountInput}
            onChangeText={setAccountInput}
          />

          {/* Amount */}
          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>AMOUNT</Text>
          <TextInput
            style={styles.input}
            placeholder="Minimum ₹100"
            placeholderTextColor={Colors.textSecondary}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

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
            style={styles.confirmButton}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>Confirm Withdrawal</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
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

  // Tabs
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: '#ffffff',
  },

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
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
