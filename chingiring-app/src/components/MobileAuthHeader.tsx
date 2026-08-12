import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { Fonts } from '../constants/theme';

// 3-stop brand gradient used across every mobile header.
// Mirrors CSS: linear-gradient(135deg, #1E3A8A 0%, #4784E2 60%, #91BDFF 100%).
// 135deg in CSS = top-left → bottom-right, which maps to start={0,0} end={1,1}.
const HEADER_GRADIENT_COLORS: readonly [string, string, string] =
  ['#1E3A8A', '#4784E2', '#91BDFF'];
const HEADER_GRADIENT_LOCATIONS: readonly [number, number, number] =
  [0, 0.6, 1];

/**
 * Shared header for all mobile auth screens (OTP, Forgot Password, Reset
 * Password, Signup, etc.). One blue gradient bar with back button + title,
 * identical on Android + iOS.
 *
 * Drop it at the top of any auth screen — handles status-bar safe area
 * automatically and falls back to navigation.goBack() if no `onBack` passed.
 */
interface Props {
  title: string;
  /** Optional override; defaults to navigation.goBack(). */
  onBack?: () => void;
  /** Hide the back button (e.g. top of a stack). Default: false. */
  hideBack?: boolean;
  /** Optional small subtitle under the title. */
  subtitle?: string;
  /** Small all-caps label rendered ABOVE the title (e.g. "ACCOUNT"). */
  kicker?: string;
  /** Title block alignment. Defaults to 'center'. */
  align?: 'left' | 'center';
  /** Custom right-side element (replaces the layout spacer). */
  rightSlot?: React.ReactNode;
  /**
   * Extra bottom padding ABOVE the standard 60px base. Rarely needed —
   * the baseline already leaves room for ~40px of card overlap. Only pass
   * a value if a screen needs deeper overlap (e.g. a really tall floating
   * card) and accept that the header will become taller than the rest.
   */
  extraBottomSpace?: number;
  /**
   * Override the standard 60px bottom padding. Use a small value for a
   * compact header on screens with NO overlapping card (e.g. Nearby Stores),
   * so the title sits vertically centred in the blue band instead of near
   * the top. Defaults to 60.
   */
  bottomPad?: number;
  /**
   * Extra content rendered INSIDE the gradient, directly below the title row
   * (e.g. a search bar). When present, the title row uses a slim bottom pad so
   * the content sits snug under the title instead of the overlap-card gap.
   */
  children?: React.ReactNode;
}

// Standard bottom padding inside every mobile header. Picked to match the
// Profile screen so every screen feels consistent at a glance and leaves
// enough room for the typical 40px overlap card (avatar / balance / identity).
const HEADER_BOTTOM_PAD = 60;

export const MobileAuthHeader: React.FC<Props> = ({
  title, onBack, hideBack = false, subtitle, kicker, align = 'center',
  rightSlot, extraBottomSpace = 0, bottomPad = HEADER_BOTTOM_PAD, children,
}) => {
  const navigation = useNavigation<any>();
  const handleBack = onBack ?? (() => navigation.goBack());

  const titleAlignStyle =
    align === 'left' ? styles.titleWrapLeft : styles.titleWrapCenter;

  return (
    <LinearGradient
      colors={HEADER_GRADIENT_COLORS}
      locations={HEADER_GRADIENT_LOCATIONS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Decorative blobs — match the brand surface used on Profile/Home. */}
        <View style={styles.blobLeft} pointerEvents="none" />
        <View style={styles.blobRight} pointerEvents="none" />

        <View style={[styles.row, { paddingBottom: children ? 12 : bottomPad + extraBottomSpace }]}>
          {hideBack ? (
            <View />
          ) : (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.iconBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ArrowLeft size={22} color="#fff" strokeWidth={2.2} />
            </TouchableOpacity>
          )}

          <View style={[styles.titleWrap, titleAlignStyle]}>
            {kicker ? (
              <Text style={styles.kicker} numberOfLines={1}>{kicker}</Text>
            ) : null}
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            ) : null}
          </View>

          {/* Either a caller-provided slot (Export, Edit, etc) or a
              spacer matched to the back-button width to keep the title
              optically centred. */}
          {rightSlot ?? <View style={styles.iconBtn} />}
        </View>

        {children ? <View style={styles.belowRow}>{children}</View> : null}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    // Android status-bar padding fallback when SafeAreaView's top inset is 0.
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  safe: {},
  belowRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  titleWrapCenter: {
    alignItems: 'center',
  },
  titleWrapLeft: {
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  kicker: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.4,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  blobLeft: {
    position: 'absolute',
    top: -40,
    left: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  blobRight: {
    position: 'absolute',
    top: 20,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});

export default MobileAuthHeader;
