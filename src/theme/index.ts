// Centralized SplitMate Design System — Sky Blue Brand Identity (Fyndra Labs)

export const LightColors = {
  // Brand Primary Sky Blue Palette
  primary: '#0284C7', // Stronger high-contrast sky blue primary for Android readability
  primaryLight: '#38BDF8',
  primaryPressed: '#0369A1',
  primaryDark: '#0369A1',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E0F2FE', // Pale blue surface
  onPrimaryContainer: '#0369A1',
  primaryFixed: '#E0F2FE',
  primaryFixedDim: '#BAE6FD',
  onPrimaryFixed: '#082F49',
  onPrimaryFixedVariant: '#0284C7',
  inversePrimary: '#38BDF8',

  // Secondary & Soft Accent
  secondary: '#0EA5E9',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F0F9FF',
  onSecondaryContainer: '#0369A1',
  secondaryFixed: '#E0F2FE',
  secondaryFixedDim: '#BAE6FD',

  // Accent Cyan/Teal
  accentTeal: '#0D9488',
  accentTealContainer: '#CCFBF1',

  // Tertiary Slate Amber
  tertiary: '#D97706',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FEF3C7',

  // Neutral & Surface Palette (Clean Fintech White & Slate)
  surface: '#FFFFFF',
  surfaceDim: '#F1F5F9',
  surfaceBright: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F8FAFC',
  surfaceContainer: '#F1F5F9',
  surfaceContainerHigh: '#E2E8F0',
  surfaceContainerHighest: '#CBD5E1',
  surfaceVariant: '#F1F5F9',
  onSurface: '#0F172A',
  onSurfaceVariant: '#64748B',
  inverseSurface: '#0F172A',

  // Backgrounds
  background: '#F8FAFC',
  onBackground: '#0F172A',
  lightSkyBackground: '#F0F9FF',
  paleBlueSurface: '#E0F2FE',
  cardBackground: '#FFFFFF',

  // Outlines & Borders
  outline: '#94A3B8',
  outlineVariant: '#E2E8F0',
  divider: '#E2E8F0',
  border: '#E2E8F0',

  // Semantic Status Colors
  error: '#DC2626',
  onError: '#FFFFFF',
  errorContainer: '#FEE2E2',
  onErrorContainer: '#991B1B',

  warning: '#F59E0B',
  onWarning: '#FFFFFF',
  warningContainer: '#FEF3C7',

  positive: '#16A34A',
  positiveContainer: '#DCFCE7',
  positiveText: '#15803D',
  success: '#16A34A',

  // Text helpers
  primaryText: '#0F172A',
  secondaryText: '#64748B',
};

export const DarkColors = {
  ...LightColors,
  // Brand Primary Sky Blue for Dark Theme
  primary: '#38BDF8',
  primaryLight: '#7DD3FC',
  primaryPressed: '#0284C7',
  primaryDark: '#0369A1',
  onPrimary: '#082F49',
  primaryContainer: '#0C4A6E',
  onPrimaryContainer: '#E0F2FE',
  primaryFixed: '#075985',
  primaryFixedDim: '#0369A1',
  onPrimaryFixed: '#F0F9FF',
  onPrimaryFixedVariant: '#BAE6FD',
  inversePrimary: '#0284C7',

  // Dark Slate Surfaces
  surface: '#0F172A',
  surfaceDim: '#0B1120',
  surfaceBright: '#1E293B',
  surfaceContainerLowest: '#090D16',
  surfaceContainerLow: '#0F172A',
  surfaceContainer: '#1E293B',
  surfaceContainerHigh: '#334155',
  surfaceContainerHighest: '#475569',
  surfaceVariant: '#1E293B',
  onSurface: '#F8FAFC',
  onSurfaceVariant: '#94A3B8',
  inverseSurface: '#F8FAFC',

  // Dark Backgrounds
  background: '#090D16',
  onBackground: '#F8FAFC',
  lightSkyBackground: '#0C4A6E',
  paleBlueSurface: '#075985',
  cardBackground: '#0F172A',

  // Outlines & Borders
  outline: '#64748B',
  outlineVariant: '#334155',
  divider: '#1E293B',
  border: '#334155',

  // Semantics in Dark
  error: '#EF4444',
  errorContainer: '#7F1D1D',
  onErrorContainer: '#FEE2E2',

  warning: '#FBBF24',
  warningContainer: '#78350F',

  positive: '#22C55E',
  positiveContainer: '#14532D',
  positiveText: '#4ADE80',
  success: '#22C55E',

  primaryText: '#F8FAFC',
  secondaryText: '#94A3B8',
};

export const activeTheme = {
  isDark: false,
};

export const Colors = LightColors;

export const Typography = {
  fontFamily: 'Inter_400Regular',
  fontFamilyMedium: 'Inter_500Medium',
  fontFamilySemiBold: 'Inter_600SemiBold',
  fontFamilyBold: 'Inter_700Bold',

  displayLg: {
    fontFamily: 'Inter_700Bold',
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -0.8,
  },
  headlineLg: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  headlineSm: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    lineHeight: 28,
  },
  headlineLgMobile: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    lineHeight: 28,
  },
  titleLg: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    lineHeight: 26,
  },
  titleMd: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
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
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMd: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
  },
  numericDisplay: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  gutter: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
  containerMargin: 18,
};

export const BorderRadius = {
  xs: 6,
  sm: 10,
  DEFAULT: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardElevated: {
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  button: {
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  dialog: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
};
