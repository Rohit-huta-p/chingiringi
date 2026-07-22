import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Spacing } from '../constants/theme';

interface WriteReviewModalProps {
  visible: boolean;
  onClose: () => void;
  // Resolve → parent handles success (invalidate + close). Reject → error shown.
  onSubmit: (rating: number, text: string) => Promise<void>;
}

export const WriteReviewModal: React.FC<WriteReviewModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset every time the modal opens.
  useEffect(() => {
    if (visible) {
      setRating(0);
      setText('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(rating, text.trim());
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          'Could not post your review. Please try again.',
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Write a review</Text>
          <Text style={styles.subtitle}>How was the product?</Text>

          {/* Star rating */}
          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setRating(i + 1)}
                activeOpacity={0.7}
                hitSlop={6}
                accessibilityLabel={`Rate ${i + 1} star${i === 0 ? '' : 's'}`}
              >
                <Text style={[styles.star, i < rating && styles.starOn]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Share your experience (optional)"
            placeholderTextColor={Colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlignVertical="top"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, (rating < 1 || submitting) && styles.submitDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={rating < 1 || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
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
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  star: {
    fontSize: 32,
    color: '#e2e8f0',
  },
  starOn: {
    color: '#f59e0b',
  },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  error: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.danger,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  submitButton: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
});
