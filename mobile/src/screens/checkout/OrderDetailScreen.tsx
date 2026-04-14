import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius, Shadows} from '../../lib/theme';
import {api} from '../../lib/api';
import type {Order} from '../../lib/types';
import LoadingSpinner from '../../components/LoadingSpinner';

function formatPrice(price: number, currency: string = 'UGX'): string {
  return `${currency} ${price.toLocaleString()}`;
}

const STATUS_ORDER = ['pending', 'processing', 'shipped', 'delivered'];
const STATUS_ICONS: Record<string, string> = {
  pending: 'time-outline',
  processing: 'cog-outline',
  shipped: 'airplane-outline',
  delivered: 'checkmark-circle-outline',
  cancelled: 'close-circle-outline',
};

export default function OrderDetailScreen({route, navigation}: any) {
  const {orderId, orderNumber} = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const data = await api.orders.get(orderId);
      setOrder(data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      {text: 'No', style: 'cancel'},
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            const res = await api.orders.cancel(orderId);
            setOrder(res.order);
            Alert.alert('Cancelled', 'Your order has been cancelled.');
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to cancel order');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingSpinner />;
  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Order not found</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStatusIdx = STATUS_ORDER.indexOf(order.status);
  const canCancel = ['pending', 'processing'].includes(order.status);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Order #{order.orderNumber}</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.sectionTitle}>Order Status</Text>
          {order.status === 'cancelled' ? (
            <View style={styles.cancelledBanner}>
              <Icon name="close-circle" size={24} color={Colors.danger} />
              <Text style={styles.cancelledText}>Order Cancelled</Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {STATUS_ORDER.map((status, idx) => {
                const isCompleted = idx <= currentStatusIdx;
                const isCurrent = idx === currentStatusIdx;
                return (
                  <View key={status} style={styles.timelineItem}>
                    <View style={styles.timelineDotCol}>
                      <View style={[styles.timelineDot, isCompleted && styles.timelineDotActive, isCurrent && styles.timelineDotCurrent]}>
                        <Icon name={STATUS_ICONS[status]} size={14} color={isCompleted ? Colors.white : Colors.textMuted} />
                      </View>
                      {idx < STATUS_ORDER.length - 1 && (
                        <View style={[styles.timelineLine, isCompleted && styles.timelineLineActive]} />
                      )}
                    </View>
                    <Text style={[styles.timelineLabel, isCompleted && styles.timelineLabelActive]}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Custom Timeline Events */}
        {order.timeline && order.timeline.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            {order.timeline.map((entry, idx) => (
              <View key={idx} style={styles.eventRow}>
                <View style={styles.eventDot} />
                <View style={{flex: 1}}>
                  <Text style={styles.eventStatus}>{entry.status}</Text>
                  <Text style={styles.eventNote}>{entry.note}</Text>
                  <Text style={styles.eventDate}>{new Date(entry.createdAt).toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items ({order.items.length})</Text>
          {order.items.map(item => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemImagePlaceholder}>
                <Icon name="cube-outline" size={24} color={Colors.textMuted} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemMeta}>Qty: {item.quantity} × {formatPrice(item.price)}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatPrice(item.price * item.quantity)}</Text>
            </View>
          ))}
        </View>

        {/* Shipping */}
        {order.shippingAddress && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Shipping Address</Text>
            <Text style={styles.infoLine}>{order.shippingAddress.name}</Text>
            <Text style={styles.infoLine}>{order.shippingAddress.street}</Text>
            <Text style={styles.infoLine}>{order.shippingAddress.city}</Text>
            <Text style={styles.infoLine}>{order.shippingAddress.phone}</Text>
          </View>
        )}

        {/* Totals */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatPrice(order.subtotal, order.currency)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryValue}>{formatPrice(order.shippingCost, order.currency)}</Text>
          </View>
          {order.discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, {color: Colors.success}]}>Discount</Text>
              <Text style={[styles.summaryValue, {color: Colors.success}]}>-{formatPrice(order.discount, order.currency)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(order.totalAmount, order.currency)}</Text>
          </View>
        </View>

        {/* Cancel */}
        {canCancel && (
          <TouchableOpacity
            style={[styles.cancelBtn, cancelling && {opacity: 0.6}]}
            onPress={handleCancel}
            disabled={cancelling}>
            {cancelling ? (
              <ActivityIndicator color={Colors.danger} />
            ) : (
              <>
                <Icon name="close-circle-outline" size={20} color={Colors.danger} />
                <Text style={styles.cancelBtnText}>Cancel Order</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
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
    fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.text,
  },
  content: {paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxxl},
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.xxl,
    padding: Spacing.xl, marginBottom: Spacing.lg, ...Shadows.sm,
  },
  timelineCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xxl,
    padding: Spacing.xl, marginBottom: Spacing.lg, ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.lg,
  },
  timeline: {paddingLeft: Spacing.sm},
  timelineItem: {flexDirection: 'row', alignItems: 'flex-start'},
  timelineDotCol: {alignItems: 'center', marginRight: Spacing.lg},
  timelineDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  timelineDotActive: {backgroundColor: Colors.primary, borderColor: Colors.primary},
  timelineDotCurrent: {borderColor: Colors.primary, backgroundColor: Colors.primary},
  timelineLine: {
    width: 2, height: 24, backgroundColor: Colors.border,
  },
  timelineLineActive: {backgroundColor: Colors.primary},
  timelineLabel: {
    fontSize: Fonts.sizes.md, color: Colors.textMuted, paddingTop: 4,
  },
  timelineLabelActive: {color: Colors.text, fontWeight: '600'},
  cancelledBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.dangerLight, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.sm,
  },
  cancelledText: {fontSize: Fonts.sizes.lg, fontWeight: '600', color: Colors.danger},
  eventRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: Spacing.lg, gap: Spacing.md,
  },
  eventDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.primary, marginTop: 6,
  },
  eventStatus: {fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.text},
  eventNote: {fontSize: Fonts.sizes.sm, color: Colors.textMuted, marginTop: 2},
  eventDate: {fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 2},
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight, gap: Spacing.md,
  },
  itemImagePlaceholder: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  itemName: {fontSize: Fonts.sizes.md, fontWeight: '500', color: Colors.text},
  itemMeta: {fontSize: Fonts.sizes.sm, color: Colors.textMuted, marginTop: 2},
  itemTotal: {fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.text},
  infoLine: {fontSize: Fonts.sizes.md, color: Colors.text, lineHeight: 22},
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs,
  },
  summaryLabel: {fontSize: Fonts.sizes.md, color: Colors.textMuted},
  summaryValue: {fontSize: Fonts.sizes.md, fontWeight: '500', color: Colors.text},
  totalRow: {
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    marginTop: Spacing.sm, paddingTop: Spacing.md,
  },
  totalLabel: {fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.text},
  totalValue: {fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.text},
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.dangerLight, borderRadius: Radius.full,
    paddingVertical: 14, gap: Spacing.sm, marginBottom: Spacing.xxl,
  },
  cancelBtnText: {fontSize: Fonts.sizes.lg, fontWeight: '600', color: Colors.danger},
  errorContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {fontSize: Fonts.sizes.lg, color: Colors.textMuted},
  retryBtn: {
    backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: Radius.full, marginTop: Spacing.lg,
  },
  retryText: {color: Colors.white, fontWeight: '600'},
});
