import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Monitor, Smartphone } from 'lucide-react-native';
import { Fonts } from '../constants/theme';
import { Banner } from '../api/banners';
import { BannerBlock } from './BannerBlock';

// A live, WYSIWYG preview of the banner being edited. Renders the real
// <BannerBlock> so what admins see here is exactly what the home shows, with a
// Desktop / Mobile toggle (each uses its own image + sizing). Taps are inert.
const noopNav = { navigate: () => {} };

export function BannerPreview({ banner }: { banner: Partial<Banner> }) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const isMobile = device === 'mobile';

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.label}>Live preview</Text>
        <View style={s.toggle}>
          <TouchableOpacity
            style={[s.toggleBtn, !isMobile && s.toggleBtnOn]}
            onPress={() => setDevice('desktop')}
            activeOpacity={0.85}
          >
            <Monitor size={13} color={!isMobile ? '#fff' : '#64748b'} strokeWidth={2.2} />
            <Text style={[s.toggleTxt, !isMobile && s.toggleTxtOn]}>Desktop</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, isMobile && s.toggleBtnOn]}
            onPress={() => setDevice('mobile')}
            activeOpacity={0.85}
          >
            <Smartphone size={13} color={isMobile ? '#fff' : '#64748b'} strokeWidth={2.2} />
            <Text style={[s.toggleTxt, isMobile && s.toggleTxtOn]}>Mobile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sits on the real home background colour so the preview reads true. */}
      <View style={s.surface}>
        <View style={isMobile ? s.phone : s.full}>
          <BannerBlock banner={banner as Banner} navigation={noopNav} isMobile={isMobile} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', letterSpacing: 0.3, textTransform: 'uppercase' },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#eef2f7',
    borderRadius: 9,
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 7,
  },
  toggleBtnOn: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  toggleTxt: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  toggleTxtOn: { color: '#fff' },
  surface: {
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    alignItems: 'center',
  },
  full: { width: '100%' },
  phone: {
    width: 320,
    maxWidth: '100%',
  },
});

export default BannerPreview;
