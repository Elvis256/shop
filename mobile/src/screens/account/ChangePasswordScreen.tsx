import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius} from '../../lib/theme';
import {api} from '../../lib/api';

export default function ChangePasswordScreen({navigation}: any) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.auth.changePassword({currentPassword, newPassword});
      Alert.alert('Success', 'Password changed successfully.', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Change Password</Text>
          <View style={{width: 40}} />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputWrap}>
            <Icon name="lock-closed-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showCurrent}
            />
            <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
              <Icon name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputWrap}>
            <Icon name="lock-closed-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Minimum 8 characters"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showNew}
            />
            <TouchableOpacity onPress={() => setShowNew(!showNew)}>
              <Icon name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Must be at least 8 characters with letters and numbers</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.inputWrap}>
            <Icon name="lock-closed-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showNew}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, loading && {opacity: 0.7}]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Update Password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {
    paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.xxxxl,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Spacing.xxl, paddingBottom: Spacing.xxl,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: {
    flex: 1, textAlign: 'center',
    fontSize: Fonts.sizes['2xl'], fontWeight: '700', color: Colors.text,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.dangerLight, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.lg, gap: Spacing.sm,
  },
  errorText: {flex: 1, color: Colors.danger, fontSize: Fonts.sizes.md},
  field: {marginBottom: Spacing.lg},
  label: {
    fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.text,
    marginBottom: Spacing.sm,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, height: 50,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  input: {
    flex: 1, fontSize: Fonts.sizes.base, color: Colors.text, paddingVertical: 0,
  },
  hint: {fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: Spacing.xs},
  saveBtn: {
    backgroundColor: Colors.primary, paddingVertical: 14,
    borderRadius: Radius.full, alignItems: 'center', marginTop: Spacing.lg,
  },
  saveBtnText: {color: Colors.white, fontSize: Fonts.sizes.lg, fontWeight: '600'},
});
