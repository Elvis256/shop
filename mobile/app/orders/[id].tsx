import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { OrderDetail } from "@/lib/types";

const statusColors: Record<string, string> = {
  PENDING: "#F59E0B", CONFIRMED: "#3B82F6", PROCESSING: "#8B5CF6",
  SHIPPED: "#6366F1", DELIVERED: "#10B981", CANCELLED: "#EF4444", REFUNDED: "#6B7280",
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await api.getOrder(id);
        setOrder(data);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <LoadingSpinner message="Loading order..." />;
  if (!order) return null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: `Order #${order.orderNumber}` }} />

      {/* Status */}
      <View style={[styles.statusCard, { backgroundColor: (statusColors[order.status] || "#6B7280") + "15" }]}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[order.status] || "#6B7280" }]}>
          <Text style={styles.statusText}>{order.status}</Text>
        </View>
        <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>
          Payment: {order.paymentStatus}
        </Text>
        {order.trackingNumber && (
          <Text style={[styles.tracking, { color: theme.primary }]}>
            Tracking: {order.trackingNumber}
          </Text>
        )}
      </View>

      {/* Items */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Items</Text>
        {order.items.map((item) => (
          <View key={item.id} style={[styles.itemRow, { borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.itemQty, { color: theme.textMuted }]}>Qty: {item.quantity}</Text>
            </View>
            <Text style={[styles.itemPrice, { color: theme.text }]}>
              KES {(item.price * item.quantity).toLocaleString()}
            </Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={[styles.totals, { backgroundColor: theme.surface }]}>
        <View style={styles.totalLine}>
          <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Subtotal</Text>
          <Text style={[styles.totalValue, { color: theme.text }]}>KES {order.subtotal.toLocaleString()}</Text>
        </View>
        {order.discount > 0 && (
          <View style={styles.totalLine}>
            <Text style={[styles.totalLabel, { color: theme.success }]}>Discount</Text>
            <Text style={[styles.totalValue, { color: theme.success }]}>-KES {order.discount.toLocaleString()}</Text>
          </View>
        )}
        {order.shippingCost > 0 && (
          <View style={styles.totalLine}>
            <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Shipping</Text>
            <Text style={[styles.totalValue, { color: theme.text }]}>KES {order.shippingCost.toLocaleString()}</Text>
          </View>
        )}
        {order.tax > 0 && (
          <View style={styles.totalLine}>
            <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Tax</Text>
            <Text style={[styles.totalValue, { color: theme.text }]}>KES {order.tax.toLocaleString()}</Text>
          </View>
        )}
        <View style={[styles.totalLine, styles.grandTotal]}>
          <Text style={[styles.grandLabel, { color: theme.text }]}>Total</Text>
          <Text style={[styles.grandValue, { color: theme.primary }]}>
            {order.currency} {order.totalAmount.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Shipping */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Shipping Address</Text>
        <Text style={[styles.addressText, { color: theme.textSecondary }]}>{order.shippingAddress}</Text>
        {order.discreet && (
          <View style={styles.discreetRow}>
            <Ionicons name="eye-off" size={16} color={theme.success} />
            <Text style={[styles.discreetText, { color: theme.success }]}>Discreet packaging</Text>
          </View>
        )}
      </View>

      {/* Timeline */}
      {order.timeline.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Timeline</Text>
          {order.timeline.map((event, i) => (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineDot}>
                <View style={[styles.dot, { backgroundColor: i === 0 ? theme.primary : theme.border }]} />
                {i < order.timeline.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                )}
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineStatus, { color: theme.text }]}>{event.status}</Text>
                {event.note && (
                  <Text style={[styles.timelineNote, { color: theme.textSecondary }]}>{event.note}</Text>
                )}
                <Text style={[styles.timelineDate, { color: theme.textMuted }]}>
                  {new Date(event.createdAt).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusCard: {
    margin: Spacing.lg, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, alignItems: "center", gap: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full,
  },
  statusText: { color: "#FFF", fontSize: FontSize.md, fontWeight: "700" },
  statusLabel: { fontSize: FontSize.md },
  tracking: { fontSize: FontSize.md, fontWeight: "600" },
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xxl },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: "700", marginBottom: Spacing.md },
  itemRow: {
    flexDirection: "row", alignItems: "center",
    borderBottomWidth: 1, paddingVertical: Spacing.md,
  },
  itemName: { fontSize: FontSize.md, fontWeight: "500" },
  itemQty: { fontSize: FontSize.sm },
  itemPrice: { fontSize: FontSize.base, fontWeight: "600" },
  totals: { margin: Spacing.lg, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.sm },
  totalLine: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: FontSize.md },
  totalValue: { fontSize: FontSize.md, fontWeight: "500" },
  grandTotal: { borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: Spacing.sm, marginTop: Spacing.sm },
  grandLabel: { fontSize: FontSize.lg, fontWeight: "700" },
  grandValue: { fontSize: FontSize.xl, fontWeight: "700" },
  addressText: { fontSize: FontSize.md, lineHeight: 22 },
  discreetRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm },
  discreetText: { fontSize: FontSize.sm, fontWeight: "600" },
  timelineItem: { flexDirection: "row", gap: Spacing.md },
  timelineDot: { alignItems: "center", width: 20 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: { width: 2, flex: 1, marginVertical: 4 },
  timelineContent: { flex: 1, paddingBottom: Spacing.lg },
  timelineStatus: { fontSize: FontSize.md, fontWeight: "600" },
  timelineNote: { fontSize: FontSize.sm, marginTop: 2 },
  timelineDate: { fontSize: FontSize.xs, marginTop: 2 },
});
