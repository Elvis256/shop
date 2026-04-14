import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius} from '../../lib/theme';
import {api} from '../../lib/api';

export default function ForgotPasswordScreen({navigation}: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.auth.forgotPassword(email.trim());
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Icon name="checkmark-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Check Your Email</Text>
          <Text style={styles.successMessage}>
            We've sent a password reset link to {email}. Please check your inbox and follow the instructions.
          </Text>
          <TouchableOpacity
            style={styles.backToLoginBtn}
            onPress={() => navigation.navigate('Login')}>
            <Text style={styles.backToLoginText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your email address and we'll send you a link to reset your password.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <Icon name="mail-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, loading && {opacity: 0.7}]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backLink} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.backLinkText}>Back to Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxxxl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: Fonts.sizes['4xl'],
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Fonts.sizes.lg,
    color: Colors.textMuted,
    marginBottom: Spacing.xxxl,
    lineHeight: 24,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    color: Colors.danger,
    fontSize: Fonts.sizes.md,
  },
  field: {
    marginBottom: Spacing.xxl,
  },
  label: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Fonts.sizes.base,
    color: Colors.text,
    paddingVertical: 0,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.full,
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
  },
  backLink: {
    alignSelf: 'center',
  },
  backLinkText: {
    color: Colors.primary,
    fontSize: Fonts.sizes.md,
    fontWeight: '500',
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  successIcon: {
    marginBottom: Spacing.xxl,
  },
  successTitle: {
    fontSize: Fonts.sizes['3xl'],
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  successMessage: {
    fontSize: Fonts.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxxl,
  },
  backToLoginBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: Radius.full,
  },
  backToLoginText: {
    color: Colors.white,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
  },
});
