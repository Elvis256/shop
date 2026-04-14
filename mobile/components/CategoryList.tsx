import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import type { Category } from "@/lib/types";

interface Props {
  categories: Category[];
  horizontal?: boolean;
}

export default function CategoryList({ categories, horizontal = true }: Props) {
  const theme = useTheme();
  const router = useRouter();

  const renderCategory = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        horizontal && styles.horizontalCard,
      ]}
      onPress={() => router.push(`/category/${item.slug}`)}
      activeOpacity={0.7}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: theme.surface }]}>
          <Ionicons name="grid-outline" size={24} color={theme.textMuted} />
        </View>
      )}
      <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
        {item.name}
      </Text>
      {item.productCount !== undefined && (
        <Text style={[styles.count, { color: theme.textMuted }]}>
          {item.productCount} items
        </Text>
      )}
    </TouchableOpacity>
  );

  if (horizontal) {
    return (
      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      />
    );
  }

  return (
    <FlatList
      data={categories}
      renderItem={renderCategory}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.gridList}
    />
  );
}

const styles = StyleSheet.create({
  horizontalList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  gridList: {
    padding: Spacing.lg,
  },
  gridRow: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    padding: Spacing.md,
  },
  horizontalCard: {
    width: 100,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: Spacing.sm,
  },
  imagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  name: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    textAlign: "center",
  },
  count: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
});
