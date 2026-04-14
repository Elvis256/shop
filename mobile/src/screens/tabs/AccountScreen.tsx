import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius, Shadows} from '../../lib/theme';
import {useAuth} from '../../contexts/AuthContext';
import {api} from '../../lib/api';

const MENU_ITEMS = [
  {icon: 'receipt-outline', label: 'My Orders', screen: 'Orders'},
  {icon: 'location-outline', label: 'Addresses', screen: 'Addresses'},
  {icon: 'person-outline', label: 'Edit Profile', screen: 'Profile'},
  {icon: 'lock-closed-outline', label: 'Change Password', screen: 'ChangePassword'},
];

export default function AccountScreen({navigation}: any) {
  const {user, isAuthenticated, logout} = useAuth();
  const [trackNumber, setTrackNumber] = useState('');
  const [tracking, setTracking] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Logout', style: 'destructive', onPress: logout},
    ]);
  };

  const handleTrackOrder = async () => {
    if (!trackNumber.trim()) return;
    setTracking(true);
    try {
      const order = await api.orders.track(trackNumber.trim());
      navigation.navigate('OrderDetail', {orderId: order.id, orderNumber: order.orderNumber});
    } catch (err: any) {
      Alert.alert('Not Found', err.message || 'Order not found. Please check the order number.');
    } finally {
      setTracking(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <Text style={styles.title}>Account</Text>
      </View>

      {isAuthenticated && user ? (
        <>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>

          {/* Menu Items */}
          <View style={styles.menuCard}>
            {MENU_ITEMS.map((item, index) => (
              <TouchableOpacity
                key={item.screen}
                style={[styles.menuItem, index < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
                onPress={() => navigation.navigate(item.screen)}>
                <Icon name={item.icon} size={22} color={Colors.text} />
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Icon name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Icon name="log-out-outline" size={22} color={Colors.danger} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Auth Buttons */}
          <View style={styles.authCard}>
            <Icon name="person-circle-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.authTitle}>Welcome to PleasureZone</Text>
            <Text style={styles.authSubtitle}>Sign in to manage your orders and preferences</Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('Login')}>
              <Text style={styles.primaryBtnText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Register')}>
              <Text style={styles.secondaryBtnText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Track Order */}
      <View style={styles.trackCard}>
        <Text style={styles.trackTitle}>Track Your Order</Text>
        <View style={styles.trackRow}>
          <TextInput
            style={styles.trackInput}
            value={trackNumber}
            onChangeText={setTrackNumber}
            placeholder="Enter order number"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={handleTrackOrder}
          />
          <TouchableOpacity
            style={[styles.trackBtn, tracking && {opacity: 0.6}]}
            onPress={handleTrackOrder}
            disabled={tracking}>
            <Icon name="search" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appName}>PleasureZone</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxxl,
  },
  header: {
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: Fonts.sizes['3xl'],
    fontWeight: '700',
    color: Colors.text,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Fonts.sizes['2xl'],
    fontWeight: '700',
    color: Colors.white,
  },
  profileInfo: {
    marginLeft: Spacing.lg,
    flex: 1,
  },
  profileName: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  profileEmail: {
    fontSize: Fonts.sizes.md,
    color: Colors.textMuted,
    marginTop: 2,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuLabel: {
    flex: 1,
    fontSize: Fonts.sizes.lg,
    color: Colors.text,
    marginLeft: Spacing.md,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.full,
    paddingVertical: 14,
    marginBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  logoutText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    color: Colors.danger,
  },
  authCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xxxl,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  authTitle: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  authSubtitle: {
    fontSize: Fonts.sizes.md,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
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
    borderRadius: Radius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: {
    color: Colors.text,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
  },
  trackCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  trackTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  trackRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  trackInput: {
    flex: 1,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    fontSize: Fonts.sizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trackBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  appName: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  appVersion: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
