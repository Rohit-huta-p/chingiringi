import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Plus, ChevronLeft } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { MyVideosPanel, MyVideosPanelHandle } from '../../components/MyVideosPanel';

/**
 * "My Videos" — the user's own clips (any status), with a Post CTA and
 * edit/delete on their own. User posts are moderated, so a clip shows
 * "Under review" until an admin approves. The list + flows live in
 * <MyVideosPanel/>, shared with the seller "My Store → Videos" tab.
 */
export const MyVideosScreen = () => {
  const nav = useNavigation<any>();
  const panelRef = useRef<MyVideosPanelHandle>(null);

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={8} style={s.back}><ChevronLeft size={24} color={Colors.text} /></TouchableOpacity>
        <Text style={s.headerTitle}>My Videos</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => panelRef.current?.openCreate()} activeOpacity={0.85}>
          <Plus size={16} color="#fff" strokeWidth={2.5} />
          <Text style={s.addBtnText}>Post</Text>
        </TouchableOpacity>
      </View>

      <MyVideosPanel ref={panelRef} emptyHint='Tap “Post” to share your first clip.' />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { padding: 2 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },
});

export default MyVideosScreen;
