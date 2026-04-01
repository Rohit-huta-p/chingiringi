import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ViewStyle, 
  TextStyle 
} from 'react-native';
import { Colors } from '../constants/theme';

export type ButtonVariant = 'primary' | 'outline' | 'text' | 'pillActive' | 'pillInactive';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) => {
  const getContainerStyle = () => {
    switch (variant) {
      case 'primary': return styles.primary;
      case 'outline': return styles.outline;
      case 'text': return styles.text;
      case 'pillActive': return styles.pillActive;
      case 'pillInactive': return styles.pillInactive;
      default: return styles.primary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary': return styles.primaryText;
      case 'outline': return styles.outlineText;
      case 'text': return styles.textText;
      case 'pillActive': return styles.pillActiveText;
      case 'pillInactive': return styles.pillInactiveText;
      default: return styles.primaryText;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        getContainerStyle(),
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : Colors.primary} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, getTextStyle(), textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8, // Space if there's an icon
  },
  primary: {
    backgroundColor: '#6093f4', // Sign In button blue
  },
  primaryText: {
    color: '#fff',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  outlineText: {
    color: Colors.text,
  },
  text: {
    backgroundColor: 'transparent',
    height: 'auto',
    paddingHorizontal: 0,
  },
  textText: {
    color: Colors.primary,
    fontSize: 14,
  },
  pillActive: {
    backgroundColor: '#000',
    borderRadius: 20,
    height: 36,
  },
  pillActiveText: {
    color: '#fff',
    fontSize: 14,
  },
  pillInactive: {
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    height: 36,
  },
  pillInactiveText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '400',
  },
  disabled: {
    opacity: 0.5,
  },
});
