import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  RefreshControl,
} from 'react-native';
import {Colors, Fonts, Spacing, Radius} from '../../lib/theme';
import {api} from '../../lib/api';
import {useAuth} from '../../contexts/AuthContext';
import {useCart} from '../../contexts/CartContext';
import type {WishlistItem} from '../../lib/types';
import ProductCard from '../../components/ProductCard';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function WishlistScreen({navigation}: any) {
  const {isAuthenticated} = useAuth();
  const {addItem} = useCart();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.wishlist.list();
      setItems(data.items);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWishlist();
    setRefreshing(false);
  };

  const handleRemove = async (productId: string) => {
    try {
      await api.wishlist.remove(productId);
      setItems(prev => prev.filter(i => i.product.id !== productId));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to remove item');
    }
  };

  const handleMoveToCart = async (item: WishlistItem) => {
    try {
      await addItem(item.product.id);
      await api.wishlist.remove(item.product.id);
      setItems(prev => prev.filter(i => i.product.id !== item.product.id));
      Alert.alert('Added to Cart', `${item.product.name} has been added to your cart.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to move to cart');
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <View style={styles.header}>
          <Text style={styles.title}>Wishlist</Text>
        </View>
        <View style={styles.authPrompt}>
          <EmptyState
            icon="heart-outline"
            title="Sign in Required"
            message="Please log in to view your wishlist."
          />
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <Text style={styles.title}>Wishlist</Text>
        <Text style={styles.count}>{items.length} items</Text>
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="Your Wishlist is Empty"
          message="Items you save will appear here."
        />
      ) : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={item => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({item}) => (
            <ProductCard
              product={item.product}
              onPress={() => navigation.navigate('ProductDetail', {slug: item.product.slug})}
              onAddToCart={() => handleMoveToCart(item)}
              onWishlist={() => handleRemove(item.product.id)}
              isWishlisted
            />
          )}
        />
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
  count: {
    fontSize: Fonts.sizes.md,
    color: Colors.textMuted,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  row: {
    justifyContent: 'space-between',
  },
  authPrompt: {
    flex: 1,
    justifyContent: 'center',
  },
  loginBtn: {
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: Radius.full,
    marginTop: Spacing.lg,
  },
  loginBtnText: {
    color: Colors.white,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
  },
});
