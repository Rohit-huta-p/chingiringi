import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';

interface DealCardProps {
  brand: string;
  description: string;
  cashback: string;
  expiresIn: string;
  imageUrl?: string;
}

export const DealCard: React.FC<DealCardProps> = ({ brand, description, cashback, expiresIn, imageUrl }) => {
  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.imageContainer}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{cashback}</Text>
        </View>
        <View style={styles.placeholderImage}>
           {/* Fallback image placeholder */}
        </View>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.brandTitle} numberOfLines={1}>{brand}</Text>
        <Text style={styles.description} numberOfLines={2}>{description}</Text>
        
        <View style={styles.footer}>
          <Text style={styles.expiresText}>⏰ {expiresIn}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
    minWidth: 200,
    margin: 10,
  },
  imageContainer: {
    height: 140,
    backgroundColor: '#f1f5f9',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImage: {
    width: 60,
    height: 60,
    backgroundColor: '#e2e8f0',
    borderRadius: 30,
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expiresText: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '600',
  },
});
