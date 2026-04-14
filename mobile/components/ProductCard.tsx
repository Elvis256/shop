import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import type { ProductListItem } from "@/lib/types";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - Spacing.lg * 3) / 2;

interface Props {
  product: ProductListItem;
  onAddToCart?: () => void;
  onToggleWishlist?: () => void;
  isWishlisted?: boolean;
}

export default function ProductCard({
  product,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
}: Props) {
  const theme = useTheme();
  const router = useRouter();
  const discount = product.comparePrice
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => router.push(`/product/${product.slug}`)}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: theme.surface }]}>
            <Ionicons name="image-outline" size={40} color={theme.textMuted} />
          </View>
        )}

        {/* Badges */}
        {product.badgeText ? (
          <View style={[styles.badge, { backgroundColor: theme.secondary }]}>
            <Text style={styles.badgeText}>{product.badgeText}</Text>
          </View>
        ) : product.isNew ? (
          <View style={[styles.badge, { backgroundColor: theme.info }]}>
            <Text style={styles.badgeText}>NEW</Text>
          </View>
        ) : discount > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.error }]}>
            <Text style={styles.badgeText}>-{discount}%</Text>
          </View>
        ) : null}

        {/* Wishlist toggle */}
        {onToggleWishlist && (
          <TouchableOpacity
            style={[styles.wishlistBtn, { backgroundColor: theme.card }]}
            onPress={onToggleWishlist}
          >
            <Ionicons
              name={isWishlisted ? "heart" : "heart-outline"}
              size={20}
              color={isWishlisted ? theme.error : theme.textMuted}
            />
          </TouchableOpacity>
        )}

        {/* Out of stock overlay */}
        {!product.inStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        {product.category && (
          <Text style={[styles.category, { color: theme.textMuted }]} numberOfLines={1}>
            {product.category}
          </Text>
        )}
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Rating */}
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color={theme.star} />
          <Text style={[styles.rating, { color: theme.textSecondary }]}>
            {product.rating.toFixed(1)}
          </Text>
        </View>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: theme.primary }]}>
            {product.currency} {product.price.toLocaleString()}
          </Text>
          {product.comparePrice && (
            <Text style={[styles.comparePrice, { color: theme.textMuted }]}>
              {product.currency} {product.comparePrice.toLocaleString()}
            </Text>
          )}
        </View>

        {/* Add to cart */}
        {onAddToCart && product.inStock && (
          <TouchableOpacity
            style={[styles.addToCartBtn, { backgroundColor: theme.primary }]}
            onPress={onAddToCart}
          >
            <Ionicons name="cart-outline" size={16} color="#FFF" />
            <Text style={styles.addToCartText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  imageContainer: {
    width: "100%",
    height: CARD_WIDTH,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    color: "#FFF",
    fontSize: FontSize.xs,
    fontWeight: "700",
  },
  wishlistBtn: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  outOfStockText: {
    color: "#FFF",
    fontSize: FontSize.md,
    fontWeight: "700",
  },
  info: {
    padding: Spacing.md,
  },
  category: {
    fontSize: FontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: Spacing.xs,
  },
  rating: {
    fontSize: FontSize.sm,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  price: {
    fontSize: FontSize.base,
    fontWeight: "700",
  },
  comparePrice: {
    fontSize: FontSize.sm,
    textDecorationLine: "line-through",
  },
  addToCartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  addToCartText: {
    color: "#FFF",
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
});
