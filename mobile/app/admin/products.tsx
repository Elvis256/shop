import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import SearchBar from "@/components/SearchBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import type { ProductListItem } from "@/lib/types";

export default function AdminProductsScreen() {
  const theme = useTheme();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadProducts = useCallback(async (pageNum = 1, reset = true) => {
    try {
      const params: Record<string, string> = { page: pageNum.toString(), limit: "20" };
      if (search) params.search = search;
      const data = await api.admin.getProducts(params);
      setProducts(reset ? data.products : [...products, ...data.products]);
      setTotalPages(data.pagination.totalPages);
      setPage(pageNum);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    loadProducts(1, true);
  }, [search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkAction = (action: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const actionLabel = action === "delete" ? "delete" : action === "activate" ? "activate" : "deactivate";
    Alert.alert(
      `${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} Products`,
      `${actionLabel} ${ids.length} product(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: action === "delete" ? "destructive" : "default",
          onPress: async () => {
            try {
              await api.admin.bulkProductAction(action, ids);
              setSelectedIds(new Set());
              loadProducts(1, true);
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Delete Product", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.admin.deleteProduct(id);
            setProducts((prev) => prev.filter((p) => p.id !== id));
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingSpinner message="Loading products..." />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.searchRow}>
        <SearchBar initialValue={search} onSearch={setSearch} placeholder="Search products..." />
      </View>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <View style={[styles.bulkBar, { backgroundColor: theme.surface }]}>
          <Text style={[styles.bulkText, { color: theme.text }]}>{selectedIds.size} selected</Text>
          <TouchableOpacity onPress={() => handleBulkAction("activate")}>
            <Text style={[styles.bulkAction, { color: theme.success }]}>Activate</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleBulkAction("deactivate")}>
            <Text style={[styles.bulkAction, { color: theme.warning }]}>Deactivate</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleBulkAction("delete")}>
            <Text style={[styles.bulkAction, { color: theme.error }]}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedIds(new Set())}>
            <Text style={[styles.bulkAction, { color: theme.textMuted }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={products}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.productRow,
              { borderColor: theme.border },
              selectedIds.has(item.id) && { backgroundColor: theme.primary + "10" },
            ]}
            onPress={() => toggleSelect(item.id)}
            onLongPress={() => toggleSelect(item.id)}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumbPlaceholder, { backgroundColor: theme.surface }]}>
                <Ionicons name="image-outline" size={20} color={theme.textMuted} />
              </View>
            )}
            <View style={styles.productInfo}>
              <Text style={[styles.productName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.productPrice, { color: theme.primary }]}>
                {item.currency} {item.price.toLocaleString()}
              </Text>
              <Text style={[styles.productStock, { color: item.inStock ? theme.success : theme.error }]}>
                {item.inStock ? `${item.stock} in stock` : "Out of stock"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id, item.name)}>
              <Ionicons name="trash-outline" size={20} color={theme.error} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProducts(1, true); }} tintColor={theme.primary} />
        }
        onEndReached={() => {
          if (page < totalPages) loadProducts(page + 1, false);
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState icon="cube-outline" title="No Products" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { padding: Spacing.lg },
  bulkBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  bulkText: { fontWeight: "600", flex: 1 },
  bulkAction: { fontSize: FontSize.sm, fontWeight: "600" },
  list: { paddingHorizontal: Spacing.lg },
  productRow: {
    flexDirection: "row", alignItems: "center",
    borderBottomWidth: 1, paddingVertical: Spacing.md, gap: Spacing.md,
  },
  thumb: { width: 50, height: 50, borderRadius: BorderRadius.md },
  thumbPlaceholder: {
    width: 50, height: 50, borderRadius: BorderRadius.md,
    alignItems: "center", justifyContent: "center",
  },
  productInfo: { flex: 1 },
  productName: { fontSize: FontSize.md, fontWeight: "600" },
  productPrice: { fontSize: FontSize.sm, fontWeight: "700" },
  productStock: { fontSize: FontSize.xs },
});
