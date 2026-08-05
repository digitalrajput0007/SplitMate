// Centralized SplitMate Design System — Grounded in Stitch Design Guidelines

export const Colors = {
  // Primary Palette
  primary: '#24389C',
  onPrimary: '#FFFFFF',
  primaryContainer: '#3F51B5',
  onPrimaryContainer: '#CACFFF',
  primaryFixed: '#DEE0FF',
  primaryFixedDim: '#BAC3FF',
  onPrimaryFixed: '#00105C',
  onPrimaryFixedVariant: '#293CA0',
  inversePrimary: '#BAC3FF',

  // Secondary & Accent Palette
  secondary: '#4C56AF',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#959EFD',
  onSecondaryContainer: '#27308A',
  secondaryFixed: '#E0E0FF',
  secondaryFixedDim: '#BDC2FF',

  // Accent Teal
  accentTeal: '#008080',
  accentTealContainer: '#E0F2F1',

  // Tertiary
  tertiary: '#6C3400',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#8F4700',

  // Neutral & Surface Palette
  surface: '#F9F9F9',
  surfaceDim: '#DADADA',
  surfaceBright: '#F9F9F9',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F3F3F3',
  surfaceContainer: '#EEEEEE',
  surfaceContainerHigh: '#E8E8E8',
  surfaceContainerHighest: '#E2E2E2',
  surfaceVariant: '#E2E2E2',
  onSurface: '#1A1C1C',
  onSurfaceVariant: '#454652',
  inverseSurface: '#2F3131',

  // Background
  background: '#F9F9F9',
  onBackground: '#1A1C1C',

  // Outlines & Borders
  outline: '#757684',
  outlineVariant: '#C5C5D4',
  divider: '#F2F2F7',

  // Semantic Status Colors
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#93000A',

  positive: '#15803D',
  positiveContainer: '#DCFCE7',
  positiveText: '#166534',
};

export const Typography = {
  fontFamily: 'Inter_400Regular',
  fontFamilyMedium: 'Inter_500Medium',
  fontFamilySemiBold: 'Inter_600SemiBold',
  fontFamilyBold: 'Inter_700Bold',

  displayLg: {
    fontFamily: 'Inter_700Bold',
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -0.96,
  },
  headlineLg: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.32,
  },
  headlineSm: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    lineHeight: 32,
  },
  headlineLgMobile: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    lineHeight: 32,
  },
  titleLg: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    lineHeight: 28,
  },
  titleMd: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
  },
  titleSm: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  bodyLg: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMd: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  bodySm: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  labelLg: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMd: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  numericDisplay: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.64,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  gutter: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  containerMargin: 24,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  DEFAULT: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 28,
  full: 9999,
};

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  cardElevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  button: {
    shadowColor: '#24389C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
};
