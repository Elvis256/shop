import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, StatusBar, Linking} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius} from '../lib/theme';
import {storage} from '../lib/storage';

interface Props {
  onVerified: () => void;
}

export default function AgeGateScreen({onVerified}: Props) {
  const handleConfirm = async () => {
    await storage.setAgeVerified();
    onVerified();
  };

  const handleDeny = () => {
    Linking.openURL('https://www.google.com');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Icon name="shield-checkmark" size={64} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Age Verification</Text>
        <Text style={styles.subtitle}>
          You must be 18 years or older to access this application. By continuing, you confirm that you meet the minimum age requirement.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirm} activeOpacity={0.8}>
          <Text style={styles.primaryBtnText}>I am 18 or older</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleDeny} activeOpacity={0.8}>
          <Text style={styles.secondaryBtnText}>I am under 18</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 340,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: Fonts.sizes['3xl'],
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Fonts.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxxl,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
  },
  secondaryBtn: {
    width: '100%',
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
  },
});
