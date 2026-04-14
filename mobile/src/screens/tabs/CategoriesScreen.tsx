import React, {useState, useEffect} from 'react';
import {View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius, Shadows} from '../../lib/theme';
import {api} from '../../lib/api';
import type {Category} from '../../lib/types';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

const CATEGORY_ICONS: Record<string, string> = {
  toys: 'game-controller',
  lingerie: 'shirt',
  wellness: 'leaf',
  accessories: 'diamond',
  lubricants: 'water',
  bondage: 'lock-closed',
  vibrators: 'pulse',
  dildos: 'fitness',
  couples: 'heart',
  massage: 'hand-left',
  hygiene: 'sparkles',
  clothing: 'shirt',
};

function getCategoryIcon(slug: string): string {
  const key = Object.keys(CATEGORY_ICONS).find(k => slug.toLowerCase().includes(k));
  return key ? CATEGORY_ICONS[key] : 'grid-outline';
}

const CATEGORY_COLORS = [
  '#0071e3', '#ec4899', '#059669', '#d97706',
  '#6366f1', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#14b8a6', '#f43f5e', '#3b82f6',
];

export default function CategoriesScreen({navigation}: any) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.products.categories();
      setCategories(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <EmptyState icon="alert-circle-outline" title="Error" message={error} />
        <TouchableOpacity style={styles.retryBtn} onPress={loadCategories}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
      </View>
      <FlatList
        data={categories}
        numColumns={2}
        keyExtractor={item => item.id}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({item, index}) => {
          const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('CategoryProducts', {slug: item.slug, name: item.name})}>
              <View style={[styles.iconCircle, {backgroundColor: color + '15'}]}>
                <Icon name={getCategoryIcon(item.slug)} size={28} color={color} />
              </View>
              <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              {item.productCount !== undefined && (
                <Text style={styles.cardCount}>{item.productCount} products</Text>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState icon="grid-outline" title="No Categories" message="No categories available yet." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: Fonts.sizes['3xl'],
    fontWeight: '700',
    color: Colors.text,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  card: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  cardName: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  cardCount: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  retryBtn: {
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Radius.full,
  },
  retryText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: Fonts.sizes.md,
  },
});
