import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, ChevronDown, Search, User as UserIcon, Coins } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts } from '../constants/theme';
import { walletAPI } from '../api/wallet';
import { useAuthStore } from '../store';
import { useLocationLabel } from '../hooks/useLocationLabel';

// Brand gradient — mirrors MobileAuthHeader (135deg, #1E3A8A → #4784E2 → #91BDFF).
const GRAD: readonly [string, string, string] = ['#1E3A8A', '#4784E2', '#91BDFF'];
const GRAD_LOC: readonly [number, number, number] = [0, 0.6, 1];

interface Props {
  searchQuery: string;
  onChangeSearch: (t: string) => void;
  onSubmitSearch: () => void;
}

/**
 * Rich Products-tab header: location · coins · avatar · headline · search.
 * No top inset — it sits inside BuyerTabNavigator's top-padding SafeAreaView
 * (see mobile-header-top-inset-convention), so the inset is applied once there.
 */
export function ProductsHeader({ searchQuery, onChangeSearch, onSubmitSearch }: Props) {
  const navigation = useNavigation<any>();
  const locationLabel = useLocationLabel();
  const avatarUrl = useAuthStore((st) => st.user?.avatarUrl);
  const { data: wRes } = useQuery({ queryKey: ['wallet'], queryFn: () => walletAPI.getWallet() });
  const coins: number = wRes?.data?.wallet?.coins ?? wRes?.data?.coins ?? 0;

  return (
    <LinearGradient
      colors={GRAD}
      locations={GRAD_LOC}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={st.grad}
    >
      <View style={st.blobL} pointerEvents="none" />
      <View style={st.blobR} pointerEvents="none" />

      <View style={st.topRow}>
        <View style={st.loc}>
          <MapPin size={20} color="#dbe8ff" strokeWidth={2.2} />
          <View style={{ flexShrink: 1 }}>
            <Text style={st.locHint}>Shopping near</Text>
            <View style={st.locLine}>
              <Text style={st.locText} numberOfLines={1}>{locationLabel}</Text>
              <ChevronDown size={16} color="#fff" strokeWidth={2.4} />
            </View>
          </View>
        </View>

        <View style={st.icons}>
          <TouchableOpacity
            style={st.coin}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Wallet')}
            accessibilityRole="button"
            accessibilityLabel="Wallet"
          >
            <Coins size={16} color="#F5B301" strokeWidth={2.4} />
            <Text style={st.coinTxt}>{Number(coins).toLocaleString('en-IN')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={st.avatar}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={st.avatarImg} />
            ) : (
              <UserIcon size={20} color="#fff" strokeWidth={2.2} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={st.titleWrap}>
        <Text style={st.title}>Discover products</Text>
        <Text style={st.subtitle}>Shop · Watch · Connect</Text>
      </View>

      <View style={st.searchBar}>
        <Search size={18} color={Colors.primary} />
        <TextInput
          style={st.searchInput}
          placeholder="Search products"
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={onChangeSearch}
          returnKeyType="search"
          onSubmitEditing={onSubmitSearch}
        />
        <TouchableOpacity
          style={st.sbtn}
          onPress={onSubmitSearch}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          <Search size={16} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  grad: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  blobL: {
    position: 'absolute', top: -50, left: -40, width: 150, height: 150,
    borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  blobR: {
    position: 'absolute', top: 10, right: -70, width: 180, height: 180,
    borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  loc: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, flexShrink: 1, paddingRight: 8 },
  locHint: { fontSize: 11.5, color: 'rgba(255,255,255,0.82)', fontFamily: Fonts.medium, marginTop: 1 },
  locLine: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  locText: { fontSize: 15, color: '#fff', fontFamily: Fonts.extraBold, maxWidth: 190 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  coin: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
  },
  coinTxt: { color: '#fff', fontFamily: Fonts.extraBold, fontSize: 13.5 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  titleWrap: { marginTop: 14 },
  title: { color: '#fff', fontSize: 25, fontFamily: Fonts.extraBold, letterSpacing: 0.2 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontFamily: Fonts.semiBold, marginTop: 3, letterSpacing: 0.3 },
  searchBar: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: '#fff', borderRadius: 13, paddingLeft: 13, paddingRight: 7, height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Colors.text, height: 46 },
  sbtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
});
