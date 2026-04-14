import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import SearchBar from "@/components/SearchBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import type { CustomerListItem } from "@/lib/types";

export default function AdminCustomersScreen() {
  const theme = useTheme();
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadCustomers = useCallback(async (pageNum = 1, reset = true) => {
    try {
      const params: Record<string, string> = { page: pageNum.toString(), limit: "20" };
      if (search) params.search = search;
      const data = await api.admin.getCustomers(params);
      setCustomers(reset ? data.customers : [...customers, ...data.customers]);
      setTotalPages(data.pagination.totalPages);
      setPage(pageNum);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    loadCustomers(1, true);
  }, [search]);

  const handleBlock = (customer: CustomerListItem) => {
    const action = customer.isBlocked ? "unblock" : "block";
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Customer`,
      `${action} ${customer.email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: customer.isBlocked ? "default" : "destructive",
          onPress: async () => {
            try {
              if (customer.id) {
                await api.admin.updateCustomer(customer.id, { isBlocked: !customer.isBlocked });
                loadCustomers(1, true);
              }
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  if (loading) return <LoadingSpinner message="Loading customers..." />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.searchRow}>
        <SearchBar initialValue={search} onSearch={setSearch} placeholder="Search customers..." />
      </View>

      <FlatList
        data={customers}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.avatar, { backgroundColor: item.isBlocked ? theme.error + "20" : theme.primary + "20" }]}>
                <Ionicons
                  name={item.isBlocked ? "ban" : "person"}
                  size={20}
                  color={item.isBlocked ? theme.error : theme.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.text }]}>{item.name || "Guest"}</Text>
                <Text style={[styles.email, { color: theme.textSecondary }]}>{item.email}</Text>
              </View>
              <TouchableOpacity onPress={() => handleBlock(item)}>
                <Ionicons
                  name={item.isBlocked ? "lock-open-outline" : "ban-outline"}
                  size={20}
                  color={item.isBlocked ? theme.success : theme.error}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: theme.text }]}>{item.orderCount}</Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>Orders</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: theme.primary }]}>
                  KES {item.totalSpent.toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>Total Spent</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {item.isRegistered ? "✓" : "Guest"}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>Status</Text>
              </View>
            </View>
            {item.lastOrderDate && (
              <Text style={[styles.lastOrder, { color: theme.textMuted }]}>
                Last order: {new Date(item.lastOrderDate).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
        keyExtractor={(item) => item.id || item.email}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCustomers(1, true); }} tintColor={theme.primary} />
        }
        onEndReached={() => { if (page < totalPages) loadCustomers(page + 1, false); }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No Customers" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { padding: Spacing.lg },
  list: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  card: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  name: { fontSize: FontSize.base, fontWeight: "600" },
  email: { fontSize: FontSize.sm },
  statsRow: { flexDirection: "row", gap: Spacing.lg },
  stat: { alignItems: "center" },
  statValue: { fontSize: FontSize.md, fontWeight: "700" },
  statLabel: { fontSize: FontSize.xs },
  lastOrder: { fontSize: FontSize.xs, marginTop: Spacing.sm },
});
