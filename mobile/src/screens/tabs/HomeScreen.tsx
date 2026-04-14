import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius, Shadows} from '../../lib/theme';
import {api} from '../../lib/api';
import type {ProductListItem, Category} from '../../lib/types';
import ProductCard from '../../components/ProductCard';
import SearchBar from '../../components/SearchBar';
import LoadingSpinner from '../../components/LoadingSpinner';
import {useCart} from '../../contexts/CartContext';

const {width} = Dimensions.get('window');

const CATEGORY_ICONS: Record<string, string> = {
  toys: 'game-controller',
  lingerie: 'shirt',
  wellness: 'leaf',
  accessories: 'diamond',
  lubricants: 'water',
  bondage: 'lock-closed',
  default: 'grid',
};

export default function HomeScreen({navigation}: any) {
  const {addItem} = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [trending, setTrending] = useState<ProductListItem[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductListItem[]>([]);
  const [allProducts, setAllProducts] = useState<ProductListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [cats, trend, arrivals, prods] = await Promise.all([
        api.products.categories().catch(() => []),
        api.recommendations.trending().catch(() => []),
        api.recommendations.newArrivals().catch(() => []),
        api.products.list({page: '1', limit: '10'}).catch(() => ({products: [], pagination: {total: 0, page: 1, limit: 10, totalPages: 1}})),
      ]);
      setCategories(cats);
      setTrending(trend);
      setNewArrivals(arrivals);
      setAllProducts(prods.products);
      setTotalPages(prods.pagination.totalPages);
      setPage(1);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const params: Record<string, string> = {page: String(page + 1), limit: '10'};
      if (selectedCategory) params.category = selectedCategory;
      const res = await api.products.list(params);
      setAllProducts(prev => [...prev, ...res.products]);
      setPage(page + 1);
    } catch {}
    setLoadingMore(false);
  }, [page, totalPages, loadingMore, selectedCategory]);

  const filterByCategory = useCallback(async (slug: string | null) => {
    setSelectedCategory(slug);
    setLoading(true);
    try {
      const params: Record<string, string> = {page: '1', limit: '10'};
      if (slug) params.category = slug;
      const res = await api.products.list(params);
      setAllProducts(res.products);
      setTotalPages(res.pagination.totalPages);
      setPage(1);
    } catch {}
    setLoading(false);
  }, []);

  const navigateToProduct = (slug: string) => {
    navigation.navigate('ProductDetail', {slug});
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigation.navigate('Search', {query: searchQuery.trim()});
    }
  };

  if (loading && !refreshing) return <LoadingSpinner />;

  const renderHorizontalProduct = ({item}: {item: ProductListItem}) => (
    <View style={styles.horizontalCard}>
      <ProductCard
        product={item}
        onPress={() => navigateToProduct(item.slug)}
        onAddToCart={() => addItem(item.id)}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <FlatList
        data={allProducts}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.productRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            {/* Hero */}
            <View style={styles.hero}>
              <Text style={styles.brand}>PleasureZone</Text>
              <Text style={styles.tagline}>Premium Wellness Products</Text>
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <TouchableOpacity
                style={styles.searchTouchable}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Search')}>
                <View style={styles.fakeSearch}>
                  <Icon name="search" size={20} color={Colors.textMuted} />
                  <Text style={styles.fakeSearchText}>Search products...</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Categories */}
            {categories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
                style={styles.categoryRow}>
                <TouchableOpacity
                  style={[styles.categoryPill, !selectedCategory && styles.categoryPillActive]}
                  onPress={() => filterByCategory(null)}>
                  <Text style={[styles.categoryPillText, !selectedCategory && styles.categoryPillTextActive]}>All</Text>
                </TouchableOpacity>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryPill, selectedCategory === cat.slug && styles.categoryPillActive]}
                    onPress={() => filterByCategory(cat.slug)}>
                    <Text style={[styles.categoryPillText, selectedCategory === cat.slug && styles.categoryPillTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Trending */}
            {trending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔥 Trending</Text>
                <FlatList
                  data={trending}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={item => `trend-${item.id}`}
                  renderItem={renderHorizontalProduct}
                  contentContainerStyle={styles.horizontalList}
                />
              </View>
            )}

            {/* New Arrivals */}
            {newArrivals.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>✨ New Arrivals</Text>
                <FlatList
                  data={newArrivals}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={item => `new-${item.id}`}
                  renderItem={renderHorizontalProduct}
                  contentContainerStyle={styles.horizontalList}
                />
              </View>
            )}

            {/* All Products Header */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Products</Text>
            </View>
          </>
        }
        renderItem={({item}) => (
          <ProductCard
            product={item}
            onPress={() => navigateToProduct(item.slug)}
            onAddToCart={() => addItem(item.id)}
          />
        )}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{paddingVertical: Spacing.lg}} />
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  productRow: {
    justifyContent: 'space-between',
  },
  hero: {
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
  },
  brand: {
    fontSize: Fonts.sizes['4xl'],
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: Fonts.sizes.base,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  searchWrap: {
    marginBottom: Spacing.lg,
  },
  searchTouchable: {
    width: '100%',
  },
  fakeSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fakeSearchText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textMuted,
    marginLeft: Spacing.sm,
  },
  categoryRow: {
    marginBottom: Spacing.lg,
  },
  categoryScroll: {
    paddingRight: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryPillText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  categoryPillTextActive: {
    color: Colors.white,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  horizontalList: {
    gap: Spacing.md,
  },
  horizontalCard: {
    width: (width - Spacing.lg * 3) / 2,
  },
});
