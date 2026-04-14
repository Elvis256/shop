import React from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius, Shadows} from '../../lib/theme';
import {useCart} from '../../contexts/CartContext';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import type {CartItem} from '../../lib/types';

function getImageUrl(url: string): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://ugsex.com${url}`;
}

function formatPrice(price: number, currency: string = 'UGX'): string {
  return `${currency} ${price.toLocaleString()}`;
}

export default function CartScreen({navigation}: any) {
  const {cart, isLoading, updateItem, removeItem, clearCart, total, itemCount} = useCart();

  const handleRemove = (itemId: string, name: string) => {
    Alert.alert('Remove Item', `Remove "${name}" from cart?`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Remove', style: 'destructive', onPress: () => removeItem(itemId)},
    ]);
  };

  const handleClearCart = () => {
    Alert.alert('Clear Cart', 'Remove all items from your cart?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Clear', style: 'destructive', onPress: clearCart},
    ]);
  };

  const renderItem = ({item}: {item: CartItem}) => (
    <View style={styles.cartItem}>
      <Image source={{uri: getImageUrl(item.product.imageUrl)}} style={styles.itemImage} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
        <Text style={styles.itemPrice}>{formatPrice(item.product.price, item.product.currency)}</Text>
        <View style={styles.quantityRow}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => item.quantity > 1 ? updateItem(item.id, item.quantity - 1) : handleRemove(item.id, item.product.name)}>
            <Icon name="remove" size={16} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => updateItem(item.id, item.quantity + 1)}>
            <Icon name="add" size={16} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.subtotal}>{formatPrice(item.subtotal, item.product.currency)}</Text>
        <TouchableOpacity onPress={() => handleRemove(item.id, item.product.name)} style={styles.removeBtn}>
          <Icon name="trash-outline" size={18} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <Text style={styles.title}>Cart</Text>
        {itemCount > 0 && (
          <TouchableOpacity onPress={handleClearCart}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {!cart || cart.items.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="Your Cart is Empty"
          message="Add some products to get started!"
        />
      ) : (
        <>
          <FlatList
            data={cart.items}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total ({itemCount} items)</Text>
              <Text style={styles.totalValue}>{formatPrice(total)}</Text>
            </View>
            <TouchableOpacity
              style={styles.checkoutBtn}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Checkout')}>
              <Text style={styles.checkoutText}>Proceed to Checkout</Text>
              <Icon name="arrow-forward" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: Fonts.sizes['3xl'],
    fontWeight: '700',
    color: Colors.text,
  },
  clearText: {
    color: Colors.danger,
    fontSize: Fonts.sizes.md,
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  itemImage: {
    width: 80,
    height: 100,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceSecondary,
  },
  itemInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: Fonts.sizes.md,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  itemPrice: {
    fontSize: Fonts.sizes.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qtyText: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
  itemRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: Spacing.sm,
  },
  subtotal: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  removeBtn: {
    padding: Spacing.xs,
  },
  footer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    ...Shadows.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  totalLabel: {
    fontSize: Fonts.sizes.lg,
    color: Colors.textMuted,
  },
  totalValue: {
    fontSize: Fonts.sizes['2xl'],
    fontWeight: '700',
    color: Colors.text,
  },
  checkoutBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.full,
    gap: Spacing.sm,
  },
  checkoutText: {
    color: Colors.white,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
  },
});
