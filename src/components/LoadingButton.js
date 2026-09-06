import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';

export default function LoadingButton({
  onPress,
  loading = false,
  disabled = false,
  loadingText,
  children,
  style,
  textStyle,
  indicatorColor = '#fff',
  variant = 'primary',
}) {
  const isDisabled = disabled || loading;

  const variantStyles = {
    primary: styles.primaryButton,
    secondary: styles.secondaryButton,
    danger: styles.dangerButton,
  };

  const variantTextStyles = {
    primary: styles.primaryText,
    secondary: styles.secondaryText,
    danger: styles.dangerText,
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[variantStyles[variant] || variantStyles.primary, style, isDisabled && styles.disabled]}
        onPress={onPress}
        disabled={isDisabled}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={indicatorColor} size="small" />
            {loadingText ? (
              <Text style={[variantTextStyles[variant] || variantTextStyles.primary, textStyle, styles.loadingText]}>
                {loadingText}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={[variantTextStyles[variant] || variantTextStyles.primary, textStyle]}>{children}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  wrapper: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButton: {
    backgroundColor: '#208AEF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  dangerButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c0392b',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerText: {
    color: '#c0392b',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 15,
  },
  disabled: {
    opacity: 0.65,
  },
};
