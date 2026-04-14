import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius} from '../../lib/theme';
import {api} from '../../lib/api';
import {useCart} from '../../contexts/CartContext';
import type {ProductListItem} from '../../lib/types';
import ProductCard from '../../components/ProductCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

type SortOption = {label: string; key: string; order: string};
const SORT_OPTIONS: SortOption[] = [
  {label: 'Newest', key: 'createdAt', order: 'desc'},
  {label: 'Price: Low to High', key: 'price', order: 'asc'},
  {label: 'Price: High to Low', key: 'price', order: 'desc'},
  {label: 'Rating', key: 'rating', order: 'desc'},
];

export default function CategoryProductsScreen({route, navigation}: any) {
  const {slug, name} = route.params;
  const {addItem} = useCart();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeSort, setActiveSort] = useState(0);
  const [showSort, setShowSort] = useState(false);

  const fetchProducts = useCallback(async (p: number, sort: SortOption, reset: boolean) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await api.products.list({
        category: slug,
        page: String(p),
        limit: '10',
        sort: sort.key,
        order: sort.order,
      });
      setProducts(prev => reset ? res.products : [...prev, ...res.products]);
      setTotalPages(res.pagination.totalPages);
      setPage(p);
    } catch {
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchProducts(1, SORT_OPTIONS[activeSort], true);
  }, [slug, activeSort]);

  const loadMore = () => {
    if (!loadingMore && page < totalPages) {
      fetchProducts(page + 1, SORT_OPTIONS[activeSort], false);
    }
  };

  const changeSort = (idx: number) => {
    setActiveSort(idx);
    setShowSort(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <TouchableOpacity onPress={() => setShowSort(!showSort)} style={styles.sortBtn}>
          <Icon name="funnel-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Sort Options */}
      {showSort && (
        <View style={styles.sortMenu}>
          {SORT_OPTIONS.map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.sortItem, activeSort === idx && styles.sortItemActive]}
              onPress={() => changeSort(idx)}>
              <Text style={[styles.sortItemText, activeSort === idx && styles.sortItemTextActive]}>
                {opt.label}
              </Text>
              {activeSort === idx && <Icon name="checkmark" size={18} color={Colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {products.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="No Products"
          message={`No products found in ${name}.`}
        />
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={item => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          renderItem={({item}) => (
            <ProductCard
              product={item}
              onPress={() => navigation.navigate('ProductDetail', {slug: item.slug})}
              onAddToCart={() => addItem(item.id)}
            />
          )}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{paddingVertical: Spacing.lg}} />
            ) : null
          }
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
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    flex: 1,
    fontSize: Fonts.sizes['2xl'],
    fontWeight: '700',
    color: Colors.text,
  },
  sortBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortMenu: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  sortItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sortItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  sortItemText: {
    fontSize: Fonts.sizes.md,
    color: Colors.text,
  },
  sortItemTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  row: {
    justifyContent: 'space-between',
  },
});
