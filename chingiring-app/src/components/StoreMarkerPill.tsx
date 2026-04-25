import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';
import type { Store } from '../data/offlineStores';

type Props = {
  store: Store;
  isSelected: boolean;
  onPress: () => void;
};

/**
 * The oval-pill marker shown over the map for each store.
 * - Default: white bg, blue border, blue text
 * - Selected: solid blue bg, white text
 * - Closed stores get a slight grey tint
 */
export const StoreMarkerPill: React.FC<Props> = ({ store, isSelected, onPress }) => {
  const isClosed = !store.isOpen;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <View
        style={[
          styles.pill,
          isSelected && styles.pillActive,
          isClosed && !isSelected && styles.pillClosed,
        ]}
      >
        <Text
          style={[
            styles.pillText,
            isSelected && styles.pillTextActive,
            isClosed && !isSelected && styles.pillTextClosed,
          ]}
          numberOfLines={1}
        >
          {store.shortName}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e293b',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillClosed: {
    borderColor: '#94A3B8',
    backgroundColor: '#F8FAFC',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  pillTextClosed: {
    color: '#64748B',
  },
});
