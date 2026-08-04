import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

export function createAdminPlaceholder(title: string) {
  return function PlaceholderScreen() {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
      </View>
    );
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textSecondary },
});
