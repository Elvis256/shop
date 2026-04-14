import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import SearchBar from "@/components/SearchBar";
import ProductCard from "@/components/ProductCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import type { ProductListItem } from "@/lib/types";

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const theme = useTheme();
  const { addItem } = useCart();

  const [query, setQuery] = useState(params.q || "");
  const [results, setResults] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState("relevance");

  const doSearch = useCallback(async (q: string, pageNum = 1, reset = true) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const sortParams: Record<string, string> = {};
      if (sort === "price_asc") { sortParams.sortBy = "price"; sortParams.sortOrder = "asc"; }
      else if (sort === "price_desc") { sortParams.sortBy = "price"; sortParams.sortOrder = "desc"; }
      else if (sort === "rating") { sortParams.sortBy = "rating"; sortParams.sortOrder = "desc"; }
      else if (sort === "newest") { sortParams.sortBy = "createdAt"; sortParams.sortOrder = "desc"; }

      const data = await api.search(q, { page: pageNum.toString(), limit: "20", ...sortParams });
      setResults(reset ? data.products : [...results, ...data.products]);
      setTotalPages(data.pagination.totalPages);
      setPage(pageNum);
    } catch {} finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    if (params.q) {
      setQuery(params.q);
      doSearch(params.q);
    }
  }, [params.q]);

  const handleSearch = (q: string) => {
    setQuery(q);
    doSearch(q, 1, true);
  };

  const sortOptions = [
    { key: "relevance", label: "Relevance" },
    { key: "newest", label: "Newest" },
    { key: "price_asc", label: "Price ↑" },
    { key: "price_desc", label: "Price ↓" },
    { key: "rating", label: "Rating" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.searchContainer}>
        <SearchBar initialValue={query} onSearch={handleSearch} autoFocus={!params.q} />
      </View>

      {/* Sort chips */}
      {searched && results.length > 0 && (
        <View style={styles.sortRow}>
          {sortOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.sortChip,
                { borderColor: sort === opt.key ? theme.primary : theme.border },
                sort === opt.key && { backgroundColor: theme.primary + "15" },
              ]}
              onPress={() => { setSort(opt.key); doSearch(query, 1, true); }}
            >
              <Text style={[styles.sortText, { color: sort === opt.key ? theme.primary : theme.textMuted }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading && !results.length ? (
        <LoadingSpinner message="Searching..." />
      ) : searched && results.length === 0 ? (
        <EmptyState icon="search-outline" title="No Results" message={`No products found for "${query}".`} />
      ) : (
        <FlatList
          data={results}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ProductCard product={item} onAddToCart={() => addItem(item.id)} />
            </View>
          )}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (page < totalPages) doSearch(query, page + 1, false);
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loading ? <LoadingSpinner fullScreen={false} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: { padding: Spacing.lg },
  sortRow: {
    flexDirection: "row", paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md, gap: Spacing.sm, flexWrap: "wrap",
  },
  sortChip: {
    borderWidth: 1, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  sortText: { fontSize: FontSize.sm, fontWeight: "500" },
  list: { paddingHorizontal: Spacing.lg },
  row: { gap: Spacing.lg },
  cardWrapper: { flex: 1 },
});
