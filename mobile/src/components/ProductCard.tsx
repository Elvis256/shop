import React from 'react';
import {View, Text, Image, TouchableOpacity, StyleSheet, Dimensions} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius, Shadows} from '../lib/theme';
import type {ProductListItem} from '../lib/types';

const {width} = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.lg * 3) / 2;

interface Props {
  product: ProductListItem;
  onPress: () => void;
  onAddToCart?: () => void;
  onWishlist?: () => void;
  isWishlisted?: boolean;
}

function getImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://ugsex.com${url}`;
}

function formatPrice(price: number, currency: string = 'UGX'): string {
  return `${currency} ${price.toLocaleString()}`;
}

export default function ProductCard({product, onPress, onAddToCart, onWishlist, isWishlisted}: Props) {
  const discount = product.comparePrice
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        <Image
          source={{uri: getImageUrl(product.imageUrl)}}
          style={styles.image}
          resizeMode="cover"
        />
        {/* Badges */}
        <View style={styles.badges}>
          {discount > 0 && (
            <View style={[styles.badge, {backgroundColor: Colors.badge.discount}]}>
              <Text style={styles.badgeText}>-{discount}%</Text>
            </View>
          )}
          {product.isNew && (
            <View style={[styles.badge, {backgroundColor: Colors.badge.newItem}]}>
              <Text style={styles.badgeText}>New</Text>
            </View>
          )}
          {product.flashSalePrice && (
            <View style={[styles.badge, {backgroundColor: Colors.badge.discount}]}>
              <Text style={styles.badgeText}>Flash Sale</Text>
            </View>
          )}
        </View>

        {/* Wishlist button */}
        {onWishlist && (
          <TouchableOpacity style={styles.wishlistBtn} onPress={onWishlist}>
            <Icon
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={18}
              color={isWishlisted ? Colors.danger : Colors.text}
            />
          </TouchableOpacity>
        )}

        {/* Shipping badge */}
        {product.shippingBadge && (
          <View style={[styles.shippingBadge, {
            backgroundColor: product.shippingBadge === 'Express' ? Colors.badge.express : Colors.badge.abroad,
          }]}>
            <Text style={styles.shippingText}>{product.shippingBadge}</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {formatPrice(product.flashSalePrice || product.price, product.currency)}
          </Text>
          {(product.comparePrice || product.flashSalePrice) && (
            <Text style={styles.comparePrice}>
              {formatPrice(product.flashSalePrice ? product.price : product.comparePrice!, product.currency)}
            </Text>
          )}
        </View>
        {product.category && (
          <Text style={styles.category}>{product.category}</Text>
        )}
      </View>

      {onAddToCart && product.inStock && (
        <TouchableOpacity style={styles.addBtn} onPress={onAddToCart}>
          <Icon name="add" size={18} color={Colors.white} />
        </TouchableOpacity>
      )}

      {!product.inStock && (
        <View style={styles.soldOut}>
          <Text style={styles.soldOutText}>Sold Out</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: Colors.surfaceSecondary,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badges: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    gap: 4,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    marginBottom: 4,
  },
  badgeText: {
    color: Colors.white,
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
  },
  wishlistBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shippingBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  shippingText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '600',
  },
  info: {
    padding: Spacing.md,
  },
  name: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '500',
    color: Colors.text,
    lineHeight: 16,
    marginBottom: Spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  price: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  comparePrice: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  category: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  addBtn: {
    position: 'absolute',
    bottom: 60,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  soldOut: {
    position: 'absolute',
    bottom: 60,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.badge.soldOut,
  },
  soldOutText: {
    color: Colors.white,
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
  },
});
