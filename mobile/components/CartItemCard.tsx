import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import type { CartItem as CartItemType } from "@/lib/types";

interface Props {
  item: CartItemType;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export default function CartItemCard({ item, onUpdateQuantity, onRemove }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: theme.surface }]}>
          <Ionicons name="image-outline" size={24} color={theme.textMuted} />
        </View>
      )}

      <View style={styles.details}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.price, { color: theme.primary }]}>
          KES {item.price.toLocaleString()}
        </Text>

        <View style={styles.quantityRow}>
          <TouchableOpacity
            style={[styles.qtyBtn, { borderColor: theme.border }]}
            onPress={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
            disabled={item.quantity <= 1}
          >
            <Ionicons name="remove" size={16} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.qtyText, { color: theme.text }]}>{item.quantity}</Text>
          <TouchableOpacity
            style={[styles.qtyBtn, { borderColor: theme.border }]}
            onPress={() => onUpdateQuantity(item.quantity + 1)}
          >
            <Ionicons name="add" size={16} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
        <Ionicons name="trash-outline" size={20} color={theme.error} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  details: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  price: {
    fontSize: FontSize.base,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: FontSize.base,
    fontWeight: "600",
    minWidth: 20,
    textAlign: "center",
  },
  removeBtn: {
    padding: Spacing.sm,
  },
});
