import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Linking,
} from 'react-native';
import { ShoppingBag } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { clicksAPI } from '../api/clicks';

const MERCHANTS: { key: string; label: string }[] = [
  { key: 'amazon',   label: 'Amazon' },
  { key: 'flipkart', label: 'Flipkart' },
  { key: 'myntra',   label: 'Myntra' },
  { key: 'meesho',   label: 'Meesho' },
];

interface Props {
  searchQuery: string;
  /** Defaults to "Not stocked yet — search on:" */
  title?: string;
}

/**
 * Row of merchant chips that deep-link into each merchant's search results
 * for the given query. The click is logged through the existing subid-rewrite
 * pipeline so Chingiringi earns the affiliate commission.
 *
 * Rendered at the bottom of every search results page and prominently inside
 * zero-result states.
 */
export function MerchantSearchStrip({ searchQuery, title }: Props) {
  if (!searchQuery.trim()) return null;

  const openMerchant = async (merchant: string) => {
    try {
      const { redirectUrl } = await clicksAPI.log({
        merchant,
        searchQuery: searchQuery.trim(),
        source: 'search_fallback',
      });
      await Linking.openURL(redirectUrl);
    } catch {
      // Click log failed — no raw URL to fall back to since the server builds it.
      // Silently no-op; the user stays on the current screen.
    }
  };

  return (
    <View style={st.wrap}>
      <Text style={st.title}>{title ?? 'Not stocked yet — search on:'}</Text>
      <View style={st.chips}>
        {MERCHANTS.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={st.chip}
            onPress={() => openMerchant(m.key)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Search ${m.label} for ${searchQuery}`}
          >
            <ShoppingBag size={13} color={Colors.primary} strokeWidth={2} />
            <Text style={st.chipLabel}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  title: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryLight10,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
});
