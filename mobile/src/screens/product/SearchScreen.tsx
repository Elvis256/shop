import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
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
import EmptyState from '../../components/EmptyState';

export default function SearchScreen({route, navigation}: any) {
  const {addItem} = useCart();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState(route.params?.query || '');
  const [results, setResults] = useState<ProductListItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
    if (route.params?.query) {
      doSearch(route.params.query);
    }
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    setSuggestions([]);
    try {
      const res = await api.products.search(q.trim());
      setResults(res.products);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await api.products.suggestions(q);
      setSuggestions(res.suggestions || []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const onChangeText = (text: string) => {
    setQuery(text);
    setSearched(false);
    fetchSuggestions(text);
  };

  const selectSuggestion = (s: string) => {
    setQuery(s);
    doSearch(s);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      {/* Search Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Icon name="search" size={20} color={Colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={onChangeText}
            onSubmitEditing={() => doSearch(query)}
            placeholder="Search products..."
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => {setQuery(''); setResults([]); setSearched(false); setSuggestions([]);}}>
              <Icon name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Suggestions */}
      {suggestions.length > 0 && !searched && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((s, i) => (
            <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => selectSuggestion(s)}>
              <Icon name="search-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : searched && results.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No Results"
          message={`No products found for "${query}"`}
        />
      ) : (
        <FlatList
          data={results}
          numColumns={2}
          keyExtractor={item => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({item}) => (
            <ProductCard
              product={item}
              onPress={() => navigation.navigate('ProductDetail', {slug: item.slug})}
              onAddToCart={() => addItem(item.id)}
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
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 0,
  },
  suggestionsBox: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionText: {
    fontSize: Fonts.sizes.md,
    color: Colors.text,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  row: {
    justifyContent: 'space-between',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
