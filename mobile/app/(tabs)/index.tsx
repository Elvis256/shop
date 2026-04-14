import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import SearchBar from "@/components/SearchBar";
import ProductSection from "@/components/ProductSection";
import CategoryList from "@/components/CategoryList";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { ProductListItem, Category } from "@/lib/types";

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { addItem } = useCart();

  const [trending, setTrending] = useState<ProductListItem[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductListItem[]>([]);
  const [topRated, setTopRated] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [trendingRes, newRes, topRes, catRes] = await Promise.allSettled([
        api.getTrending(),
        api.getNewArrivals(),
        api.getTopRated(),
        api.getCategories(),
      ]);

      if (trendingRes.status === "fulfilled") setTrending(trendingRes.value.products);
      if (newRes.status === "fulfilled") setNewArrivals(newRes.value.products);
      if (topRes.status === "fulfilled") setTopRated(topRes.value.products);
      if (catRes.status === "fulfilled") setCategories(catRes.value);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleAddToCart = useCallback(async (productId: string) => {
    try {
      await addItem(productId);
    } catch {}
  }, [addItem]);

  if (loading) return <LoadingSpinner message="Loading..." />;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Search */}
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <SearchBar placeholder="Search products..." />
        </View>
      </View>

      {/* Welcome banner */}
      <View style={[styles.banner, { backgroundColor: theme.primary }]}>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle}>Welcome to the Shop</Text>
          <Text style={styles.bannerSubtitle}>
            Discreet packaging • Fast delivery • Secure payments
          </Text>
          <TouchableOpacity
            style={styles.bannerBtn}
            onPress={() => router.push("/search?q=")}
          >
            <Text style={[styles.bannerBtnText, { color: theme.primary }]}>Browse All</Text>
          </TouchableOpacity>
        </View>
        <Ionicons name="bag-handle" size={80} color="rgba(255,255,255,0.2)" />
      </View>

      {/* Categories */}
      {categories.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Categories</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/categories")}>
              <Text style={[styles.seeAll, { color: theme.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          <CategoryList categories={categories.slice(0, 8)} horizontal />
        </View>
      )}

      {/* Trending */}
      <ProductSection
        title="🔥 Trending"
        products={trending.slice(0, 10)}
        onAddToCart={handleAddToCart}
        onSeeAll={() => router.push("/search?sort=trending")}
      />

      {/* New Arrivals */}
      <ProductSection
        title="✨ New Arrivals"
        products={newArrivals.slice(0, 10)}
        onAddToCart={handleAddToCart}
        onSeeAll={() => router.push("/search?sort=newest")}
      />

      {/* Top Rated */}
      <ProductSection
        title="⭐ Top Rated"
        products={topRated.slice(0, 10)}
        onAddToCart={handleAddToCart}
        onSeeAll={() => router.push("/search?sort=rating")}
      />

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: "row",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  banner: {
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xxl,
    overflow: "hidden",
  },
  bannerContent: { flex: 1, gap: Spacing.sm },
  bannerTitle: {
    color: "#FFF",
    fontSize: FontSize.xl,
    fontWeight: "700",
  },
  bannerSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  bannerBtn: {
    backgroundColor: "#FFF",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignSelf: "flex-start",
    marginTop: Spacing.sm,
  },
  bannerBtnText: {
    fontWeight: "700",
    fontSize: FontSize.md,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
  },
  seeAll: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  bottomPadding: { height: 40 },
});
