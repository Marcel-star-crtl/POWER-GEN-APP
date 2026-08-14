import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, TouchableOpacityProps } from 'react-native';
import { Colors } from '../../constants/Colors';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
  className?: string; // For Tailwind classes if using NativeWind (conceptually)
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  style,
  disabled,
  ...props
}) => {
  const getBackgroundColor = () => {
    if (disabled) return '#cbd5e1';
    switch (variant) {
      case 'primary': return Colors.primary;
      case 'secondary': return Colors.secondary;
      case 'danger': return Colors.danger;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      default: return Colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return '#94a3b8';
    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'danger':
        return '#ffffff';
      case 'outline': return Colors.primary;
      case 'ghost': return Colors.text;
      default: return '#ffffff';
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'sm': return { paddingVertical: 8, paddingHorizontal: 12 };
      case 'md': return { paddingVertical: 12, paddingHorizontal: 16 };
      case 'lg': return { paddingVertical: 16, paddingHorizontal: 24 };
      default: return { paddingVertical: 12, paddingHorizontal: 16 };
    }
  };

  return (
    <TouchableOpacity
      style={[
        {
          backgroundColor: getBackgroundColor(),
          borderRadius: 8,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: variant === 'outline' ? Colors.primary : 'transparent',
          opacity: disabled || loading ? 0.7 : 1,
          ...getPadding(),
        },
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} style={{ marginRight: 8 }} />
      ) : null}
      <Text
        style={{
          color: getTextColor(),
          fontWeight: '600',
          fontSize: size === 'lg' ? 18 : size === 'sm' ? 14 : 16,
        }}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
};
