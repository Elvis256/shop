import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";

export default function AccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, profile, isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.guestContent}>
          <View style={[styles.avatar, { backgroundColor: theme.surface }]}>
            <Ionicons name="person" size={48} color={theme.textMuted} />
          </View>
          <Text style={[styles.guestTitle, { color: theme.text }]}>Welcome!</Text>
          <Text style={[styles.guestSubtitle, { color: theme.textSecondary }]}>
            Sign in to manage your orders, wishlist, and account settings.
          </Text>
          <TouchableOpacity
            style={[styles.signInBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/auth/login")}
          >
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/auth/register")}>
            <Text style={[styles.registerLink, { color: theme.primary }]}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";

  const menuItems = [
    {
      section: "Shopping",
      items: [
        { icon: "receipt-outline" as const, label: "My Orders", route: "/orders" },
        { icon: "heart-outline" as const, label: "Wishlist", route: "/(tabs)/wishlist" },
        { icon: "location-outline" as const, label: "Saved Addresses", route: "/account/addresses" },
      ],
    },
    {
      section: "Account",
      items: [
        { icon: "person-outline" as const, label: "Edit Profile", route: "/account/profile" },
        { icon: "key-outline" as const, label: "Change Password", route: "/account/change-password" },
      ],
    },
    ...(isAdmin
      ? [{
          section: "Admin",
          items: [
            { icon: "speedometer-outline" as const, label: "Dashboard", route: "/admin" },
            { icon: "cube-outline" as const, label: "Products", route: "/admin/products" },
            { icon: "receipt-outline" as const, label: "Orders", route: "/admin/orders" },
            { icon: "people-outline" as const, label: "Customers", route: "/admin/customers" },
            { icon: "pricetag-outline" as const, label: "Coupons", route: "/admin/coupons" },
          ],
        }]
      : []),
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Text style={styles.avatarText}>
            {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: theme.text }]}>
            {user?.name || "User"}
          </Text>
          <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
            {user?.email}
          </Text>
          {profile && (
            <Text style={[styles.profileStats, { color: theme.textMuted }]}>
              {profile._count.orders} orders • {profile._count.wishlist} wishlist items
            </Text>
          )}
        </View>
      </View>

      {/* Menu sections */}
      {menuItems.map((section) => (
        <View key={section.section} style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
            {section.section}
          </Text>
          <View style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {section.items.map((item, idx) => (
              <TouchableOpacity
                key={item.route}
                style={[
                  styles.menuItem,
                  idx < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                ]}
                onPress={() => router.push(item.route as any)}
              >
                <Ionicons name={item.icon} size={22} color={theme.primary} />
                <Text style={[styles.menuLabel, { color: theme.text }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: theme.error }]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={22} color={theme.error} />
        <Text style={[styles.logoutText, { color: theme.error }]}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  guestContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xxxl,
    gap: Spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  avatarText: {
    color: "#FFF",
    fontSize: FontSize.xxxl,
    fontWeight: "700",
  },
  guestTitle: { fontSize: FontSize.xxl, fontWeight: "700" },
  guestSubtitle: { fontSize: FontSize.md, textAlign: "center", lineHeight: 22 },
  signInBtn: {
    width: "100%",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  signInBtnText: { color: "#FFF", fontSize: FontSize.lg, fontWeight: "700" },
  registerLink: { fontSize: FontSize.md, fontWeight: "600", marginTop: Spacing.md },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: FontSize.xl, fontWeight: "700" },
  profileEmail: { fontSize: FontSize.md, marginTop: 2 },
  profileStats: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  menuSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  menuCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: "500",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  logoutText: { fontSize: FontSize.base, fontWeight: "600" },
});
