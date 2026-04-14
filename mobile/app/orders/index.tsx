import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { OrderListItem } from "@/lib/types";

const statusColors: Record<string, string> = {
  PENDING: "#F59E0B",
  CONFIRMED: "#3B82F6",
  PROCESSING: "#8B5CF6",
  SHIPPED: "#6366F1",
  DELIVERED: "#10B981",
  CANCELLED: "#EF4444",
  REFUNDED: "#6B7280",
};

export default function OrdersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const data = await api.getOrders();
      setOrders(data.orders);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  if (loading) return <LoadingSpinner message="Loading orders..." />;

  if (orders.length === 0) {
    return <EmptyState icon="receipt-outline" title="No Orders Yet" message="Your orders will appear here." />;
  }

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.background }]}
      data={orders}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push(`/orders/${item.id}`)}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.orderNumber, { color: theme.text }]}>#{item.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: (statusColors[item.status] || "#6B7280") + "20" }]}>
              <Text style={[styles.statusText, { color: statusColors[item.status] || "#6B7280" }]}>
                {item.status}
              </Text>
            </View>
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.orderDate, { color: theme.textMuted }]}>
              {new Date(item.createdAt).toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric",
              })}
            </Text>
            <Text style={[styles.itemCount, { color: theme.textSecondary }]}>
              {item.itemCount} item{item.itemCount !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.cardFooter}>
            <Text style={[styles.amount, { color: theme.primary }]}>
              {item.currency} {item.totalAmount.toLocaleString()}
            </Text>
            <View style={styles.paymentRow}>
              <Text style={[styles.paymentStatus, {
                color: item.paymentStatus === "SUCCESSFUL" ? theme.success : item.paymentStatus === "FAILED" ? theme.error : theme.warning,
              }]}>
                {item.paymentStatus}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </View>
          </View>
        </TouchableOpacity>
      )}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} tintColor={theme.primary} />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.md },
  card: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  orderNumber: { fontSize: FontSize.lg, fontWeight: "700" },
  statusBadge: { borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: FontSize.xs, fontWeight: "700" },
  cardBody: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.md },
  orderDate: { fontSize: FontSize.sm },
  itemCount: { fontSize: FontSize.sm },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amount: { fontSize: FontSize.lg, fontWeight: "700" },
  paymentRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  paymentStatus: { fontSize: FontSize.sm, fontWeight: "600" },
});
