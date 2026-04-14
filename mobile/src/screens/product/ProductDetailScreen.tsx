import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius, Shadows} from '../../lib/theme';
import {api} from '../../lib/api';
import {useCart} from '../../contexts/CartContext';
import {useAuth} from '../../contexts/AuthContext';
import type {ProductDetail, ProductListItem, ReviewItem} from '../../lib/types';
import ProductCard from '../../components/ProductCard';
import LoadingSpinner from '../../components/LoadingSpinner';

const {width} = Dimensions.get('window');

function getImageUrl(url: string): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://ugsex.com${url}`;
}

function formatPrice(price: number, currency: string = 'UGX'): string {
  return `${currency} ${price.toLocaleString()}`;
}

export default function ProductDetailScreen({route, navigation}: any) {
  const {slug} = route.params;
  const {addItem} = useCart();
  const {isAuthenticated} = useAuth();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [related, setRelated] = useState<ProductListItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [addingToCart, setAddingToCart] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadProduct();
  }, [slug]);

  const loadProduct = async () => {
    setLoading(true);
    setError('');
    try {
      const [prod, rel] = await Promise.all([
        api.products.get(slug),
        api.products.related(slug).catch(() => ({products: []})),
      ]);
      setProduct(prod);
      setRelated(rel.products);
      if (prod.hasVariants && prod.variants.length > 0) {
        const defaults: Record<string, string> = {};
        prod.variants.forEach(v => {
          if (v.values.length > 0) defaults[v.name] = v.values[0];
        });
        setSelectedVariants(defaults);
      }
      // Load reviews
      try {
        const revData = await api.reviews.list(prod.id, {page: '1', limit: '5'});
        setReviews(revData.reviews);
        setAvgRating(revData.averageRating);
        setTotalReviews(revData.totalReviews);
      } catch {}
    } catch (err: any) {
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;
    setAddingToCart(true);
    try {
      await addItem(product.id, quantity);
      Alert.alert('Added to Cart', `${product.name} has been added to your cart.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleWishlist = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    try {
      if (wishlisted) {
        await api.wishlist.remove(product.id);
        setWishlisted(false);
      } else {
        await api.wishlist.add(product.id);
        setWishlisted(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update wishlist');
    }
  };

  const onImageScroll = (event: any) => {
    const idx = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveImage(idx);
  };

  if (loading) return <LoadingSpinner />;
  if (error || !product) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.errorText}>{error || 'Product not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadProduct}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = product.images?.length ? product.images : [product.imageUrl];
  const discount = product.comparePrice
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0;

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          name={i <= rating ? 'star' : i - rating < 1 ? 'star-half' : 'star-outline'}
          size={14}
          color="#f59e0b"
        />,
      );
    }
    return stars;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={handleWishlist}>
          <Icon name={wishlisted ? 'heart' : 'heart-outline'} size={22} color={wishlisted ? Colors.danger : Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onImageScroll}>
          {images.map((img, idx) => (
            <Image key={idx} source={{uri: getImageUrl(img)}} style={styles.productImage} resizeMode="cover" />
          ))}
        </ScrollView>
        {images.length > 1 && (
          <View style={styles.dots}>
            {images.map((_, idx) => (
              <View key={idx} style={[styles.dot, activeImage === idx && styles.dotActive]} />
            ))}
          </View>
        )}

        <View style={styles.details}>
          {/* Badges */}
          <View style={styles.badgeRow}>
            {product.shippingBadge && (
              <View style={[styles.badge, {backgroundColor: Colors.badge.express}]}>
                <Icon name="flash" size={12} color={Colors.white} />
                <Text style={styles.badgeText}>{product.shippingBadge}</Text>
              </View>
            )}
            {discount > 0 && (
              <View style={[styles.badge, {backgroundColor: Colors.badge.discount}]}>
                <Text style={styles.badgeText}>-{discount}%</Text>
              </View>
            )}
          </View>

          {/* Name & Price */}
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(product.price, product.currency)}</Text>
            {product.comparePrice && (
              <Text style={styles.comparePrice}>{formatPrice(product.comparePrice, product.currency)}</Text>
            )}
          </View>

          {/* Rating */}
          {totalReviews > 0 && (
            <View style={styles.ratingRow}>
              <View style={styles.stars}>{renderStars(avgRating)}</View>
              <Text style={styles.ratingText}>{avgRating.toFixed(1)} ({totalReviews} reviews)</Text>
            </View>
          )}

          {/* Variants */}
          {product.hasVariants && product.variants.map(variant => (
            <View key={variant.id} style={styles.variantSection}>
              <Text style={styles.variantLabel}>{variant.name}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variantOptions}>
                {variant.values.map(val => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.variantOption, selectedVariants[variant.name] === val && styles.variantOptionActive]}
                    onPress={() => setSelectedVariants(prev => ({...prev, [variant.name]: val}))}>
                    <Text style={[styles.variantOptionText, selectedVariants[variant.name] === val && styles.variantOptionTextActive]}>{val}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}

          {/* Quantity */}
          <View style={styles.quantitySection}>
            <Text style={styles.variantLabel}>Quantity</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                <Icon name="remove" size={18} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity(quantity + 1)}>
                <Icon name="add" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          <View style={styles.descSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>

          {/* Reviews */}
          {reviews.length > 0 && (
            <View style={styles.reviewsSection}>
              <Text style={styles.sectionTitle}>Reviews ({totalReviews})</Text>
              {reviews.map(review => (
                <View key={review.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewUser}>{review.userName}</Text>
                    <View style={styles.stars}>{renderStars(review.rating)}</View>
                  </View>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                  <Text style={styles.reviewDate}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Related Products */}
          {related.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.sectionTitle}>You May Also Like</Text>
              <FlatList
                data={related}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item.id}
                contentContainerStyle={{gap: Spacing.md}}
                renderItem={({item}) => (
                  <View style={{width: (width - Spacing.lg * 3) / 2}}>
                    <ProductCard
                      product={item}
                      onPress={() => navigation.push('ProductDetail', {slug: item.slug})}
                      onAddToCart={() => addItem(item.id)}
                    />
                  </View>
                )}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.addToCartBtn, addingToCart && {opacity: 0.7}, !product.inStock && {backgroundColor: Colors.textMuted}]}
          onPress={handleAddToCart}
          disabled={addingToCart || !product.inStock}
          activeOpacity={0.8}>
          {addingToCart ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Icon name="cart-outline" size={20} color={Colors.white} />
              <Text style={styles.addToCartText}>
                {product.inStock ? 'Add to Cart' : 'Out of Stock'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxxl,
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  productImage: {
    width: width,
    aspectRatio: 4 / 5,
    backgroundColor: Colors.surfaceSecondary,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  details: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 4,
  },
  badgeText: {
    color: Colors.white,
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
  },
  productName: {
    fontSize: Fonts.sizes['2xl'],
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 28,
    marginBottom: Spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  price: {
    fontSize: Fonts.sizes['3xl'],
    fontWeight: '700',
    color: Colors.text,
  },
  comparePrice: {
    fontSize: Fonts.sizes.lg,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
  },
  variantSection: {
    marginBottom: Spacing.lg,
  },
  variantLabel: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  variantOptions: {
    gap: Spacing.sm,
  },
  variantOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  variantOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  variantOptionText: {
    fontSize: Fonts.sizes.md,
    color: Colors.text,
  },
  variantOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  quantitySection: {
    marginBottom: Spacing.xxl,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qtyText: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 30,
    textAlign: 'center',
  },
  descSection: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: Fonts.sizes.base,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  reviewsSection: {
    marginBottom: Spacing.xxl,
  },
  reviewItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  reviewUser: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  reviewComment: {
    fontSize: Fonts.sizes.md,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  reviewDate: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
  },
  relatedSection: {
    marginBottom: Spacing.xxl,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    ...Shadows.md,
  },
  addToCartBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.full,
    gap: Spacing.sm,
  },
  addToCartText: {
    color: Colors.white,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xxxl,
  },
  errorText: {
    fontSize: Fonts.sizes.lg,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Radius.full,
    marginTop: Spacing.lg,
  },
  retryText: {
    color: Colors.white,
    fontWeight: '600',
  },
});
