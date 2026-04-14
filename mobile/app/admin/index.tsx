import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { DashboardStats } from "@/lib/types";

export default function AdminDashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.admin.getDashboard();
      setStats(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;
  if (!stats) return null;

  const cards = [
    { label: "Total Orders", value: stats.totalOrders, icon: "receipt" as const, color: "#3B82F6", route: "/admin/orders" },
    { label: "Revenue", value: `KES ${stats.totalRevenue.toLocaleString()}`, icon: "cash" as const, color: "#10B981" },
    { label: "Customers", value: stats.totalCustomers, icon: "people" as const, color: "#8B5CF6", route: "/admin/customers" },
    { label: "Products", value: stats.totalProducts, icon: "cube" as const, color: "#F59E0B", route: "/admin/products" },
    { label: "Pending Orders", value: stats.pendingOrders, icon: "hourglass" as const, color: "#EF4444" },
    { label: "Low Stock", value: stats.lowStockProducts, icon: "warning" as const, color: "#F97316" },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(); }} tintColor={theme.primary} />}
    >
      {/* Stats grid */}
      <View style={styles.statsGrid}>
        {cards.map((card) => (
          <TouchableOpacity
            key={card.label}
            style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => card.route && router.push(card.route as any)}
            disabled={!card.route}
          >
            <View style={[styles.statIcon, { backgroundColor: card.color + "20" }]}>
              <Ionicons name={card.icon} size={24} color={card.color} />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{card.value}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>{card.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick links */}
      <View style={styles.quickLinks}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
        {[
          { label: "Manage Products", icon: "cube-outline" as const, route: "/admin/products" },
          { label: "Manage Orders", icon: "receipt-outline" as const, route: "/admin/orders" },
          { label: "View Customers", icon: "people-outline" as const, route: "/admin/customers" },
          { label: "Manage Coupons", icon: "pricetag-outline" as const, route: "/admin/coupons" },
        ].map((link) => (
          <TouchableOpacity
            key={link.label}
            style={[styles.linkCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push(link.route as any)}
          >
            <Ionicons name={link.icon} size={22} color={theme.primary} />
            <Text style={[styles.linkLabel, { color: theme.text }]}>{link.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent orders */}
      {stats.recentOrders.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Orders</Text>
          {stats.recentOrders.slice(0, 5).map((order) => (
            <TouchableOpacity
              key={order.id}
              style={[styles.orderRow, { borderColor: theme.border }]}
              onPress={() => router.push(`/orders/${order.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.orderNum, { color: theme.text }]}>#{order.orderNumber}</Text>
                <Text style={[styles.orderCustomer, { color: theme.textMuted }]}>{order.customerName}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.orderAmount, { color: theme.primary }]}>
                  {order.currency} {order.totalAmount.toLocaleString()}
                </Text>
                <Text style={[styles.orderStatus, {
                  color: order.status === "DELIVERED" ? theme.success : order.status === "CANCELLED" ? theme.error : theme.warning,
                }]}>
                  {order.status}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    padding: Spacing.lg, gap: Spacing.md,
  },
  statCard: {
    width: "47%", borderWidth: 1, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, alignItems: "center", gap: Spacing.sm,
  },
  statIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: FontSize.xl, fontWeight: "700" },
  statLabel: { fontSize: FontSize.sm, textAlign: "center" },
  quickLinks: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xxl },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: "700", marginBottom: Spacing.md },
  linkCard: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.sm,
  },
  linkLabel: { flex: 1, fontSize: FontSize.base, fontWeight: "500" },
  recentSection: { paddingHorizontal: Spacing.lg },
  orderRow: {
    flexDirection: "row", alignItems: "center",
    borderBottomWidth: 1, paddingVertical: Spacing.md,
  },
  orderNum: { fontSize: FontSize.md, fontWeight: "600" },
  orderCustomer: { fontSize: FontSize.sm },
  orderAmount: { fontSize: FontSize.md, fontWeight: "700" },
  orderStatus: { fontSize: FontSize.xs, fontWeight: "600" },
});
