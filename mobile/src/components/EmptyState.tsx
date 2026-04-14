import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing} from '../lib/theme';

interface Props {
  icon: string;
  title: string;
  message: string;
}

export default function EmptyState({icon, title, message}: Props) {
  return (
    <View style={styles.container}>
      <Icon name={icon} size={64} color={Colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  title: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  message: {
    fontSize: Fonts.sizes.md,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
