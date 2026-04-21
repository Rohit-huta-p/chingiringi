// ── Typography font families ────────────────────────────────────────────────
// Import and load these via useFonts in App.tsx (already done globally).
// Use these instead of fontWeight strings so the correct Outfit variant loads.
export const Fonts = {
  regular:   'Outfit_400Regular',
  medium:    'Outfit_500Medium',
  semiBold:  'Outfit_600SemiBold',
  bold:      'Outfit_700Bold',
  extraBold: 'Outfit_800ExtraBold',
};

// ── Brand gradient ──────────────────────────────────────────────────────────
// Use with expo-linear-gradient:
//   <LinearGradient colors={Gradient.brand} start={{x:0,y:0}} end={{x:1,y:0}} />
export const Gradient = {
  brand: ['#4784E2', '#91BDFF'] as [string, string],
};

export const Colors = {
  primary: '#4784E2',
  primaryLight: '#8BB9FD',
  primaryLight10: '#E9F4FF',
  background: '#f8fafc',
  backgroundGrey: '#F3F5F7',
  surface: '#ffffff',
  text: '#1e293b',
  textWhite: '#fff',
  textSecondary: '#64748b',
  success: '#10b981',
  danger: '#ef4444',
  border: '#e2e8f0',
  borderLight: '#e2e8f0',
  borderLight10: '#e2e8f0',
};

export const Typography = {
  header: {
    fontSize: 24,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  body: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  bodySecondary: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
