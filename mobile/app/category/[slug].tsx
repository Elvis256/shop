import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import ProductCard from "@/components/ProductCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import type { ProductListItem } from "@/lib/types";

type SortOption = "newest" | "price_asc" | "price_desc" | "rating" | "name";

export default function CategoryProductsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { addItem } = useCart();

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<SortOption>("newest");
  const [categoryName, setCategoryName] = useState(slug || "");

  const sortOptions: { key: SortOption; label: string }[] = [
    { key: "newest", label: "Newest" },
    { key: "price_asc", label: "Price: Low to High" },
    { key: "price_desc", label: "Price: High to Low" },
    { key: "rating", label: "Top Rated" },
    { key: "name", label: "Name A-Z" },
  ];

  const getSortParams = (s: SortOption): Record<string, string> => {
    switch (s) {
      case "newest": return { sortBy: "createdAt", sortOrder: "desc" };
      case "price_asc": return { sortBy: "price", sortOrder: "asc" };
      case "price_desc": return { sortBy: "price", sortOrder: "desc" };
      case "rating": return { sortBy: "rating", sortOrder: "desc" };
      case "name": return { sortBy: "name", sortOrder: "asc" };
    }
  };

  const loadProducts = useCallback(async (pageNum = 1, reset = false) => {
    try {
      const params: Record<string, string> = {
        category: slug || "",
        page: pageNum.toString(),
        limit: "20",
        ...getSortParams(sort),
      };
      const data = await api.getProducts(params);
      setProducts(reset ? data.products : [...products, ...data.products]);
      setTotalPages(data.pagination.totalPages);
      setCategoryName(slug?.replace(/-/g, " ") || "");
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug, sort]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadProducts(1, true);
  }, [slug, sort]);

  const handleLoadMore = () => {
    if (page < totalPages) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadProducts(nextPage);
    }
  };

  if (loading) return <LoadingSpinner message="Loading products..." />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: categoryName.charAt(0).toUpperCase() + categoryName.slice(1) }} />

      {/* Sort bar */}
      <View style={styles.sortBar}>
        <Text style={[styles.resultCount, { color: theme.textSecondary }]}>
          {products.length} products
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortOptions}>
          {sortOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.sortChip,
                { borderColor: sort === opt.key ? theme.primary : theme.border },
                sort === opt.key && { backgroundColor: theme.primary + "15" },
              ]}
              onPress={() => setSort(opt.key)}
            >
              <Text style={[styles.sortChipText, { color: sort === opt.key ? theme.primary : theme.textSecondary }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {products.length === 0 ? (
        <EmptyState icon="cube-outline" title="No Products" message="No products found in this category." />
      ) : (
        <FlatList
          data={products}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ProductCard product={item} onAddToCart={() => addItem(item.id)} />
            </View>
          )}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProducts(1, true); }} tintColor={theme.primary} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
        />
      )}
    </View>
  );
}

const ScrollView = require("react-native").ScrollView;

const styles = StyleSheet.create({
  container: { flex: 1 },
  sortBar: { padding: Spacing.lg, gap: Spacing.sm },
  resultCount: { fontSize: FontSize.sm },
  sortOptions: { gap: Spacing.sm },
  sortChip: {
    borderWidth: 1, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  sortChipText: { fontSize: FontSize.sm, fontWeight: "500" },
  list: { paddingHorizontal: Spacing.lg },
  row: { gap: Spacing.lg },
  cardWrapper: { flex: 1 },
});
