import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, Modal, TextInput, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import type { OrderListItem, OrderStatus } from "@/lib/types";

const statusColors: Record<string, string> = {
  PENDING: "#F59E0B", CONFIRMED: "#3B82F6", PROCESSING: "#8B5CF6",
  SHIPPED: "#6366F1", DELIVERED: "#10B981", CANCELLED: "#EF4444", REFUNDED: "#6B7280",
};

const ALL_STATUSES: OrderStatus[] = [
  "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED",
];

export default function AdminOrdersScreen() {
  const theme = useTheme();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Update status modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderListItem | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [updating, setUpdating] = useState(false);

  const loadOrders = useCallback(async (pageNum = 1, reset = true) => {
    try {
      const params: Record<string, string> = { page: pageNum.toString(), limit: "20" };
      if (statusFilter) params.status = statusFilter;
      const data = await api.admin.getOrders(params);
      setOrders(reset ? data.orders : [...orders, ...data.orders]);
      setTotalPages(data.pagination.totalPages);
      setPage(pageNum);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    loadOrders(1, true);
  }, [statusFilter]);

  const openStatusModal = (order: OrderListItem) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setStatusNote("");
    setTrackingNumber("");
    setShowStatusModal(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;
    setUpdating(true);
    try {
      await api.admin.updateOrderStatus(selectedOrder.id, newStatus, statusNote || undefined, trackingNumber || undefined);
      setShowStatusModal(false);
      loadOrders(1, true);
      Alert.alert("Success", "Order status updated.");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkPaid = (orderId: string) => {
    Alert.alert("Mark as Paid", "Mark this order as paid?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            await api.admin.markOrderPaid(orderId);
            loadOrders(1, true);
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingSpinner message="Loading orders..." />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        <TouchableOpacity
          style={[styles.filterChip, { borderColor: !statusFilter ? theme.primary : theme.border }, !statusFilter && { backgroundColor: theme.primary + "15" }]}
          onPress={() => setStatusFilter("")}
        >
          <Text style={[styles.filterText, { color: !statusFilter ? theme.primary : theme.textMuted }]}>All</Text>
        </TouchableOpacity>
        {ALL_STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, { borderColor: statusFilter === s ? theme.primary : theme.border }, statusFilter === s && { backgroundColor: theme.primary + "15" }]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterText, { color: statusFilter === s ? theme.primary : theme.textMuted }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Status update modal */}
      <Modal visible={showStatusModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Update Order #{selectedOrder?.orderNumber}
            </Text>
            <Text style={[styles.subLabel, { color: theme.text }]}>Status</Text>
            <View style={styles.statusGrid}>
              {ALL_STATUSES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusChip,
                    { borderColor: newStatus === s ? statusColors[s] : theme.border },
                    newStatus === s && { backgroundColor: statusColors[s] + "20" },
                  ]}
                  onPress={() => setNewStatus(s)}
                >
                  <Text style={[styles.statusChipText, { color: newStatus === s ? statusColors[s] : theme.textMuted }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {newStatus === "SHIPPED" && (
              <>
                <Text style={[styles.subLabel, { color: theme.text }]}>Tracking Number</Text>
                <TextInput
                  style={[styles.modalInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
                  value={trackingNumber}
                  onChangeText={setTrackingNumber}
                  placeholder="Enter tracking number"
                  placeholderTextColor={theme.textMuted}
                />
              </>
            )}
            <Text style={[styles.subLabel, { color: theme.text }]}>Note (optional)</Text>
            <TextInput
              style={[styles.modalInput, styles.noteInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              value={statusNote}
              onChangeText={setStatusNote}
              placeholder="Add a note..."
              placeholderTextColor={theme.textMuted}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={() => setShowStatusModal(false)}>
                <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: theme.primary }, updating && { opacity: 0.6 }]}
                onPress={handleUpdateStatus}
                disabled={updating}
              >
                <Text style={styles.confirmBtnText}>{updating ? "Updating..." : "Update"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        data={orders}
        renderItem={({ item }) => (
          <View style={[styles.orderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.orderHeader}>
              <Text style={[styles.orderNum, { color: theme.text }]}>#{item.orderNumber}</Text>
              <TouchableOpacity
                style={[styles.statusBadge, { backgroundColor: (statusColors[item.status] || "#6B7280") + "20" }]}
                onPress={() => openStatusModal(item)}
              >
                <Text style={[styles.statusBadgeText, { color: statusColors[item.status] || "#6B7280" }]}>
                  {item.status} ✏️
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.customerName, { color: theme.textSecondary }]}>{item.customerName}</Text>
            <Text style={[styles.customerEmail, { color: theme.textMuted }]}>{item.customerEmail}</Text>
            <View style={styles.orderFooter}>
              <Text style={[styles.orderAmount, { color: theme.primary }]}>
                {item.currency} {item.totalAmount.toLocaleString()}
              </Text>
              <View style={styles.orderActions}>
                {item.paymentStatus !== "SUCCESSFUL" && (
                  <TouchableOpacity onPress={() => handleMarkPaid(item.id)}>
                    <Text style={[styles.actionLink, { color: theme.success }]}>Mark Paid</Text>
                  </TouchableOpacity>
                )}
                <Text style={[styles.paymentBadge, {
                  color: item.paymentStatus === "SUCCESSFUL" ? theme.success : item.paymentStatus === "FAILED" ? theme.error : theme.warning,
                }]}>
                  {item.paymentStatus}
                </Text>
              </View>
            </View>
            <Text style={[styles.orderDate, { color: theme.textMuted }]}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(1, true); }} tintColor={theme.primary} />
        }
        onEndReached={() => { if (page < totalPages) loadOrders(page + 1, false); }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No Orders" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { maxHeight: 50 },
  filterContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, alignItems: "center" },
  filterChip: {
    borderWidth: 1, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  filterText: { fontSize: FontSize.xs, fontWeight: "600" },
  list: { padding: Spacing.lg, gap: Spacing.md },
  orderCard: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xs },
  orderNum: { fontSize: FontSize.lg, fontWeight: "700" },
  statusBadge: { borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusBadgeText: { fontSize: FontSize.xs, fontWeight: "700" },
  customerName: { fontSize: FontSize.md },
  customerEmail: { fontSize: FontSize.sm },
  orderFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md },
  orderAmount: { fontSize: FontSize.lg, fontWeight: "700" },
  orderActions: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  actionLink: { fontSize: FontSize.sm, fontWeight: "600" },
  paymentBadge: { fontSize: FontSize.xs, fontWeight: "600" },
  orderDate: { fontSize: FontSize.xs, marginTop: Spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: Spacing.lg },
  modal: { borderRadius: BorderRadius.xl, padding: Spacing.xxl, gap: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: "700" },
  subLabel: { fontSize: FontSize.md, fontWeight: "600" },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  statusChip: {
    borderWidth: 1, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  statusChipText: { fontSize: FontSize.xs, fontWeight: "600" },
  modalInput: {
    borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, fontSize: FontSize.base,
  },
  noteInput: { minHeight: 80, textAlignVertical: "top" },
  modalBtns: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, alignItems: "center" },
  cancelBtnText: { fontSize: FontSize.base, fontWeight: "600" },
  confirmBtn: { flex: 1, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, alignItems: "center" },
  confirmBtnText: { color: "#FFF", fontSize: FontSize.base, fontWeight: "700" },
});
