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
import {useAuth} from '../../contexts/AuthContext';

export default function RegisterScreen({navigation}: any) {
  const {register} = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password, phone.trim() || undefined);
      navigation.goBack();
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join PleasureZone today</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Full Name *</Text>
          <View style={styles.inputWrap}>
            <Icon name="person-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="John Doe"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email *</Text>
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

        <View style={styles.field}>
          <Text style={styles.label}>Phone (optional)</Text>
          <View style={styles.inputWrap}>
            <Icon name="call-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+256..."
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password *</Text>
          <View style={styles.inputWrap}>
            <Icon name="lock-closed-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Minimum 8 characters"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Must be at least 8 characters with letters and numbers</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm Password *</Text>
          <View style={styles.inputWrap}>
            <Icon name="lock-closed-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.registerBtn, loading && {opacity: 0.7}]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.registerBtnText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <Text style={styles.loginLabel}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.replace('Login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: Spacing.lg,
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
  hint: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  registerBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.full,
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  registerBtnText: {
    color: Colors.white,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginLabel: {
    fontSize: Fonts.sizes.md,
    color: Colors.textMuted,
  },
  loginLink: {
    fontSize: Fonts.sizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
});
