import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius, Shadows} from '../../lib/theme';
import {api} from '../../lib/api';
import type {Order} from '../../lib/types';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

function formatPrice(price: number, currency: string = 'UGX'): string {
  return `${currency} ${price.toLocaleString()}`;
}

const STATUS_COLORS: Record<string, {bg: string; text: string}> = {
  pending: {bg: Colors.warningLight, text: Colors.warning},
  processing: {bg: Colors.primaryLight, text: Colors.primary},
  shipped: {bg: '#eef2ff', text: '#6366f1'},
  delivered: {bg: Colors.successLight, text: Colors.success},
  cancelled: {bg: Colors.dangerLight, text: Colors.danger},
};

export default function OrdersScreen({navigation}: any) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.orders.list();
      setOrders(res.orders);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Orders</Text>
        <View style={{width: 40}} />
      </View>

      {orders.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="No Orders Yet"
          message="Your order history will appear here."
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({item}) => {
            const status = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
            return (
              <TouchableOpacity
                style={styles.orderCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('OrderDetail', {orderId: item.id, orderNumber: item.orderNumber})}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
                  <View style={[styles.statusBadge, {backgroundColor: status.bg}]}>
                    <Text style={[styles.statusText, {color: status.text}]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderDate}>
                    {new Date(item.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.orderItems}>{item.items.length} item{item.items.length !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.orderFooter}>
                  <Text style={styles.orderTotal}>{formatPrice(item.totalAmount, item.currency)}</Text>
                  <Icon name="chevron-forward" size={18} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: {
    flex: 1, textAlign: 'center',
    fontSize: Fonts.sizes['2xl'], fontWeight: '700', color: Colors.text,
  },
  list: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl,
  },
  orderCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xxl,
    padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.sm,
  },
  orderHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  orderNumber: {
    fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full,
  },
  statusText: {
    fontSize: Fonts.sizes.xs, fontWeight: '600',
  },
  orderInfo: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  orderDate: {fontSize: Fonts.sizes.sm, color: Colors.textMuted},
  orderItems: {fontSize: Fonts.sizes.sm, color: Colors.textMuted},
  orderFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.md,
  },
  orderTotal: {fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.text},
});
