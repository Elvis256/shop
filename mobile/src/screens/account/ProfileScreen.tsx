import React, {useState, useEffect} from 'react';
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
import {useAuth} from '../../contexts/AuthContext';
import {api} from '../../lib/api';

export default function ProfileScreen({navigation}: any) {
  const {user, refreshUser} = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.auth.updateProfile({name: name.trim(), phone: phone.trim()});
      await refreshUser();
      Alert.alert('Success', 'Profile updated successfully.');
      navigation.goBack();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
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
          <Text style={styles.title}>Edit Profile</Text>
          <View style={{width: 40}} />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputWrap}>
            <Icon name="person-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputWrap, {backgroundColor: Colors.surfaceSecondary}]}>
            <Icon name="mail-outline" size={20} color={Colors.textMuted} />
            <TextInput
              style={[styles.input, {color: Colors.textMuted}]}
              value={user?.email || ''}
              editable={false}
            />
          </View>
          <Text style={styles.hint}>Email cannot be changed</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone</Text>
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

        <TouchableOpacity
          style={[styles.saveBtn, loading && {opacity: 0.7}]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xxxxl,
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
