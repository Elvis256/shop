import React from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize } from "@/constants/theme";
import ProductCard from "./ProductCard";
import type { ProductListItem } from "@/lib/types";

interface Props {
  title: string;
  products: ProductListItem[];
  onSeeAll?: () => void;
  onAddToCart?: (productId: string) => void;
}

export default function ProductSection({ title, products, onSeeAll, onAddToCart }: Props) {
  const theme = useTheme();

  if (products.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={[styles.seeAll, { color: theme.primary }]}>See All</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={products}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <ProductCard
              product={item}
              onAddToCart={onAddToCart ? () => onAddToCart(item.id) : undefined}
            />
          </View>
        )}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xxl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: "700",
  },
  seeAll: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  cardWrapper: {
    width: 170,
  },
});
