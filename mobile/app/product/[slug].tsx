import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, Alert, Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import ProductSection from "@/components/ProductSection";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { ProductDetail, ProductVariant, Review, ReviewsResponse } from "@/lib/types";

const { width } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "reviews">("description");

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const [prod, rel] = await Promise.all([
          api.getProduct(slug),
          api.getRelatedProducts(slug).catch(() => ({ products: [] })),
        ]);
        setProduct(prod);
        setRelated(rel.products);
        if (prod.hasVariants && prod.variants.length > 0) {
          setSelectedVariant(prod.variants[0]);
        }
        // Load reviews
        try {
          const rev = await api.getProductReviews(prod.id);
          setReviews(rev);
        } catch {}
      } catch (err: any) {
        Alert.alert("Error", "Product not found.");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleAddToCart = async () => {
    if (!product) return;
    setAddingToCart(true);
    try {
      await addItem(product.id, quantity, selectedVariant?.id);
      Alert.alert("Added to Cart", `${product.name} added to your cart.`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add to cart.");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleAddToWishlist = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      Alert.alert("Login Required", "Please sign in to add items to your wishlist.", [
        { text: "Cancel" },
        { text: "Sign In", onPress: () => router.push("/auth/login") },
      ]);
      return;
    }
    try {
      await api.addToWishlist(product.id);
      Alert.alert("Added", "Added to your wishlist.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add to wishlist.");
    }
  };

  const handleShare = async () => {
    if (!product) return;
    try {
      await Share.share({ message: `Check out ${product.name}!`, title: product.name });
    } catch {}
  };

  if (loading) return <LoadingSpinner message="Loading product..." />;
  if (!product) return null;

  const images = product.images.length > 0 ? product.images : (product.imageUrl ? [product.imageUrl] : []);
  const currentPrice = selectedVariant?.price ?? product.price;
  const inStock = selectedVariant ? selectedVariant.stock > 0 : product.inStock;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image gallery */}
        <View style={styles.gallery}>
          {images.length > 0 ? (
            <>
              <FlatList
                data={images}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={styles.mainImage} resizeMode="cover" />
                )}
                keyExtractor={(_, i) => `img-${i}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  setSelectedImageIndex(Math.round(e.nativeEvent.contentOffset.x / width));
                }}
              />
              {images.length > 1 && (
                <View style={styles.dots}>
                  {images.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        { backgroundColor: i === selectedImageIndex ? theme.primary : theme.border },
                      ]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={[styles.mainImage, styles.imagePlaceholder, { backgroundColor: theme.surface }]}>
              <Ionicons name="image-outline" size={64} color={theme.textMuted} />
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Category & badges */}
          <View style={styles.metaRow}>
            {product.category && (
              <TouchableOpacity onPress={() => router.push(`/category/${product.category!.slug}`)}>
                <Text style={[styles.categoryTag, { color: theme.primary, borderColor: theme.primary }]}>
                  {product.category.name}
                </Text>
              </TouchableOpacity>
            )}
            {product.isNew && (
              <Text style={[styles.badgeTag, { backgroundColor: theme.info }]}>NEW</Text>
            )}
            {product.isBestseller && (
              <Text style={[styles.badgeTag, { backgroundColor: theme.warning }]}>BESTSELLER</Text>
            )}
          </View>

          {/* Name */}
          <Text style={[styles.productName, { color: theme.text }]}>{product.name}</Text>

          {/* Rating */}
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= product.rating ? "star" : star - 0.5 <= product.rating ? "star-half" : "star-outline"}
                size={18}
                color={theme.star}
              />
            ))}
            <Text style={[styles.ratingText, { color: theme.textSecondary }]}>
              {product.rating.toFixed(1)} ({product.reviewCount} reviews)
            </Text>
          </View>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: theme.primary }]}>
              {product.currency} {currentPrice.toLocaleString()}
            </Text>
            {product.comparePrice && (
              <>
                <Text style={[styles.comparePrice, { color: theme.textMuted }]}>
                  {product.currency} {product.comparePrice.toLocaleString()}
                </Text>
                <View style={[styles.discountBadge, { backgroundColor: theme.error }]}>
                  <Text style={styles.discountText}>
                    -{Math.round(((product.comparePrice - currentPrice) / product.comparePrice) * 100)}%
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Stock status */}
          <View style={styles.stockRow}>
            <Ionicons
              name={inStock ? "checkmark-circle" : "close-circle"}
              size={18}
              color={inStock ? theme.success : theme.error}
            />
            <Text style={{ color: inStock ? theme.success : theme.error, fontSize: FontSize.md, fontWeight: "600" }}>
              {inStock ? "In Stock" : "Out of Stock"}
            </Text>
            {inStock && product.stock <= product.lowStockAlert && (
              <Text style={[styles.lowStock, { color: theme.warning }]}>
                Only {product.stock} left!
              </Text>
            )}
          </View>

          {/* Variants */}
          {product.hasVariants && product.variants.length > 0 && (
            <View style={styles.variantSection}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Options</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {product.variants.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.variantChip,
                      { borderColor: selectedVariant?.id === v.id ? theme.primary : theme.border },
                      selectedVariant?.id === v.id && { backgroundColor: theme.primary + "15" },
                    ]}
                    onPress={() => setSelectedVariant(v)}
                  >
                    <Text
                      style={[
                        styles.variantText,
                        { color: selectedVariant?.id === v.id ? theme.primary : theme.text },
                      ]}
                    >
                      {v.name}
                      {v.size ? ` (${v.size})` : ""}
                      {v.color ? ` - ${v.color}` : ""}
                    </Text>
                    {v.stock === 0 && (
                      <Text style={[styles.variantOos, { color: theme.error }]}>Sold out</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Quantity */}
          <View style={styles.quantitySection}>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Quantity</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={[styles.qtyBtn, { borderColor: theme.border }]}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Ionicons name="remove" size={20} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.qtyText, { color: theme.text }]}>{quantity}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, { borderColor: theme.border }]}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Ionicons name="add" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tabs: Description / Reviews */}
          <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "description" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab("description")}
            >
              <Text style={[styles.tabText, { color: activeTab === "description" ? theme.primary : theme.textMuted }]}>
                Description
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "reviews" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab("reviews")}
            >
              <Text style={[styles.tabText, { color: activeTab === "reviews" ? theme.primary : theme.textMuted }]}>
                Reviews ({product.reviewCount})
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === "description" ? (
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {product.description || "No description available."}
            </Text>
          ) : (
            <View style={styles.reviewsSection}>
              {reviews && (
                <View style={styles.reviewStats}>
                  <Text style={[styles.reviewAvg, { color: theme.text }]}>
                    {reviews.stats.average.toFixed(1)}
                  </Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons key={s} name={s <= reviews.stats.average ? "star" : "star-outline"} size={16} color={theme.star} />
                    ))}
                  </View>
                  <Text style={[styles.reviewTotal, { color: theme.textMuted }]}>
                    {reviews.stats.total} reviews
                  </Text>
                </View>
              )}
              {reviews?.reviews.map((r) => (
                <View key={r.id} style={[styles.reviewCard, { borderColor: theme.border }]}>
                  <View style={styles.reviewHeader}>
                    <Text style={[styles.reviewAuthor, { color: theme.text }]}>
                      {r.user.name || "Anonymous"}
                    </Text>
                    <View style={{ flexDirection: "row" }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons key={s} name={s <= r.rating ? "star" : "star-outline"} size={12} color={theme.star} />
                      ))}
                    </View>
                  </View>
                  {r.title && <Text style={[styles.reviewTitle, { color: theme.text }]}>{r.title}</Text>}
                  {r.content && <Text style={[styles.reviewContent, { color: theme.textSecondary }]}>{r.content}</Text>}
                  <Text style={[styles.reviewDate, { color: theme.textMuted }]}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Tags */}
          {product.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {product.tags.map((tag) => (
                <Text key={tag} style={[styles.tag, { backgroundColor: theme.surface, color: theme.textSecondary }]}>
                  #{tag}
                </Text>
              ))}
            </View>
          )}

          {/* Related products */}
          {related.length > 0 && (
            <ProductSection title="You Might Also Like" products={related} />
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.actionBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.actionIcon} onPress={handleAddToWishlist}>
          <Ionicons name="heart-outline" size={24} color={theme.error} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionIcon} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.addToCartBtn,
            { backgroundColor: inStock ? theme.primary : theme.textMuted },
          ]}
          onPress={handleAddToCart}
          disabled={!inStock || addingToCart}
        >
          <Ionicons name="cart-outline" size={20} color="#FFF" />
          <Text style={styles.addToCartText}>
            {addingToCart ? "Adding..." : inStock ? "Add to Cart" : "Out of Stock"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gallery: { position: "relative" },
  mainImage: { width, height: width, },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  dots: {
    flexDirection: "row", justifyContent: "center",
    position: "absolute", bottom: Spacing.md, left: 0, right: 0, gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  content: { padding: Spacing.lg },
  metaRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: "wrap" },
  categoryTag: {
    fontSize: FontSize.xs, fontWeight: "600", borderWidth: 1,
    borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  badgeTag: {
    fontSize: FontSize.xs, fontWeight: "700", color: "#FFF",
    borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  productName: { fontSize: FontSize.xxl, fontWeight: "700", marginBottom: Spacing.sm },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: Spacing.md },
  ratingText: { fontSize: FontSize.md, marginLeft: Spacing.xs },
  priceRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md },
  price: { fontSize: FontSize.xxxl, fontWeight: "700" },
  comparePrice: { fontSize: FontSize.lg, textDecorationLine: "line-through" },
  discountBadge: { borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  discountText: { color: "#FFF", fontSize: FontSize.sm, fontWeight: "700" },
  stockRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.lg },
  lowStock: { fontSize: FontSize.sm, fontWeight: "600" },
  variantSection: { marginBottom: Spacing.lg },
  sectionLabel: { fontSize: FontSize.base, fontWeight: "600", marginBottom: Spacing.sm },
  variantChip: {
    borderWidth: 1, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginRight: Spacing.sm,
  },
  variantText: { fontSize: FontSize.md, fontWeight: "500" },
  variantOos: { fontSize: FontSize.xs, marginTop: 2 },
  quantitySection: { marginBottom: Spacing.lg },
  quantityControls: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  qtyBtn: {
    width: 36, height: 36, borderRadius: BorderRadius.md, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  qtyText: { fontSize: FontSize.xl, fontWeight: "600", minWidth: 30, textAlign: "center" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, marginBottom: Spacing.lg },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: "center" },
  tabText: { fontSize: FontSize.base, fontWeight: "600" },
  description: { fontSize: FontSize.md, lineHeight: 24, marginBottom: Spacing.xxl },
  reviewsSection: { marginBottom: Spacing.xxl },
  reviewStats: { alignItems: "center", marginBottom: Spacing.lg, gap: Spacing.xs },
  reviewAvg: { fontSize: FontSize.display, fontWeight: "700" },
  reviewStars: { flexDirection: "row", gap: 2 },
  reviewTotal: { fontSize: FontSize.sm },
  reviewCard: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.xs },
  reviewAuthor: { fontSize: FontSize.md, fontWeight: "600" },
  reviewTitle: { fontSize: FontSize.md, fontWeight: "600", marginBottom: Spacing.xs },
  reviewContent: { fontSize: FontSize.md, lineHeight: 22, marginBottom: Spacing.xs },
  reviewDate: { fontSize: FontSize.xs },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.xxl },
  tag: { fontSize: FontSize.sm, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  actionBar: {
    flexDirection: "row", alignItems: "center", padding: Spacing.lg,
    borderTopWidth: 1, gap: Spacing.md,
  },
  actionIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  addToCartBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.sm,
  },
  addToCartText: { color: "#FFF", fontSize: FontSize.lg, fontWeight: "700" },
});
