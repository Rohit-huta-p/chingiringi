export const Colors = {
  primary: '#3b82f6', // Assuming blue from the "My Wallet" PDF
  primaryLight: '#eff6ff',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  success: '#10b981',
  danger: '#ef4444',
  border: '#e2e8f0',
};

export const Typography = {
  header: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: Colors.text,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  body: {
    fontSize: 14,
    color: Colors.text,
  },
  bodySecondary: {
    fontSize: 14,
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
