import React from 'react';
import { Text } from 'react-native';

export default function FormFieldError({ message }) {
  if (!message) {
    return null;
  }

  return <Text style={styles.error}>{message}</Text>;
}

const styles = {
  error: {
    color: '#e74c3c',
    fontSize: 13,
    marginTop: 4,
  },
};
