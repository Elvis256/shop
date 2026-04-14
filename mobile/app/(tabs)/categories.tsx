import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, RefreshControl } from "react-native";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/hooks";
import { Spacing } from "@/constants/theme";
import CategoryList from "@/components/CategoryList";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import type { Category } from "@/lib/types";

export default function CategoriesScreen() {
  const theme = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const data = await api.getCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  if (loading) return <LoadingSpinner message="Loading categories..." />;

  if (categories.length === 0) {
    return <EmptyState icon="grid-outline" title="No Categories" message="No categories available yet." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <CategoryList categories={categories} horizontal={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
