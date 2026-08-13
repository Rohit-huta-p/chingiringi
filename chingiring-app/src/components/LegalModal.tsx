import React from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Colors, Fonts, Spacing } from '../constants/theme';
import { PRIVACY_POLICY, TERMS_AND_CONDITIONS, ABOUT } from '../constants/legalContent';

export type LegalType = 'privacy' | 'terms' | 'about';

const DOC: Record<LegalType, { title: string; body: string }> = {
  privacy: { title: 'Privacy Policy', body: PRIVACY_POLICY },
  terms: { title: 'Terms & Conditions', body: TERMS_AND_CONDITIONS },
  about: { title: 'About', body: ABOUT },
};

// Inline **bold** → <Text> spans. Splits on `**`; odd segments are bold.
// Content is authored with balanced markers, so no escaping needed.
function inline(text: string): React.ReactNode {
  return text.split('**').map((part, i) =>
    i % 2 === 1
      ? <Text key={i} style={s.bold}>{part}</Text>
      : <Text key={i}>{part}</Text>,
  );
}

// Minimal markdown → RN. Handles the subset legalContent.ts actually uses:
// ## / ### headings, `- ` bullets, `---` rule, `**bold**`, blank-line gaps.
function renderMarkdown(md: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  md.replace(/\r/g, '').split('\n').forEach((raw, key) => {
    const line = raw.trimEnd();
    if (line === '') out.push(<View key={key} style={s.gap} />);
    else if (line === '---') out.push(<View key={key} style={s.hr} />);
    else if (line.startsWith('### ')) out.push(<Text key={key} style={s.h3}>{inline(line.slice(4))}</Text>);
    else if (line.startsWith('## ')) out.push(<Text key={key} style={s.h2}>{inline(line.slice(3))}</Text>);
    else if (line.startsWith('# ')) out.push(<Text key={key} style={s.h1}>{inline(line.slice(2))}</Text>);
    else if (line.startsWith('- ')) out.push(
      <View key={key} style={s.bulletRow}>
        <Text style={s.bulletDot}>{'•'}</Text>
        <Text style={s.bulletText}>{inline(line.slice(2))}</Text>
      </View>,
    );
    else out.push(<Text key={key} style={s.p}>{inline(line)}</Text>);
  });
  return out;
}

export function LegalModal({ type, onClose }: { type: LegalType | null; onClose: () => void }) {
  const doc = type ? DOC[type] : null;
  return (
    <Modal visible={!!doc} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.headerTitle} numberOfLines={1}>{doc?.title}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={s.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color={Colors.text} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator>
            {doc ? renderMarkdown(doc.body) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '85%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: Fonts.bold, color: Colors.text },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },

  body: { padding: Spacing.lg, paddingBottom: 48 },

  h1: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.text, marginBottom: 4 },
  h2: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.text, marginTop: 18, marginBottom: 4 },
  h3: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.text, marginTop: 12, marginBottom: 2 },
  p: { fontSize: 13, lineHeight: 20, fontFamily: Fonts.regular, color: Colors.textSecondary },
  bold: { fontFamily: Fonts.bold, color: Colors.text },

  bulletRow: { flexDirection: 'row', paddingLeft: 4, marginTop: 3 },
  bulletDot: { fontSize: 13, lineHeight: 20, color: Colors.primary, marginRight: 8 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 20, fontFamily: Fonts.regular, color: Colors.textSecondary },

  gap: { height: 8 },
  hr: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
});

export default LegalModal;
