import React from 'react';
import { View, StyleSheet, KeyboardAvoidingView, ScrollView, Platform, Text, TouchableOpacity } from 'react-native';
import { Card } from '../../components/Card';
import { Colors } from '../../constants/theme';
import { DiagonalPillScroll } from '../../components/DiagonalPillScroll';
import { LinearGradient } from 'expo-linear-gradient';
// import { Ionicons } from '@expo/vector-icons';

interface AuthLayoutProps {
  children: React.ReactNode;
  showBackButton?: boolean;
  onBackPress?: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ 
  children, 
  showBackButton, 
  onBackPress,
  title,
  subtitle
}) => {
  return (
    <View style={styles.root}>
      {Platform.OS === 'web' && (
        <>
          <DiagonalPillScroll side="left" />
          <DiagonalPillScroll side="right" />
          <View style={styles.centerFade} pointerEvents="none">
            <LinearGradient
              colors={['rgba(240,244,248,0)', 'rgba(240,244,248,0.9)', 'rgba(240,244,248,0.9)', 'rgba(240,244,248,0)']}
              locations={[0, 0.3, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </>
      )}
      <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        <View style={styles.contentWrapper}>
          {showBackButton && (
            <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
              {/* <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} /> */}
              <Text style={styles.backText}>&lt;- Back to login</Text>
            </TouchableOpacity>
          )}

          {title && <View style={styles.headerContainer}>{title}</View>}
          {subtitle && <View style={styles.subtitleContainer}>{subtitle}</View>}

          <Card style={styles.card}>
            {children}
          </Card>
        </View>
        
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F0F4F8', // Light blue background from designs
  },
  centerFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    marginLeft: -340,
    width: 680,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 480, // Desktop/Tablet width constraint
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  subtitleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  card: {
    padding: 32,
    borderRadius: 16,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
  },
});
