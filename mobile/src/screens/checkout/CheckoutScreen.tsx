import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius, Shadows} from '../../lib/theme';
import {api} from '../../lib/api';
import {useCart} from '../../contexts/CartContext';
import {useAuth} from '../../contexts/AuthContext';
import type {Address} from '../../lib/types';

function getImageUrl(url: string): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://ugsex.com${url}`;
}

function formatPrice(price: number, currency: string = 'UGX'): string {
  return `${currency} ${price.toLocaleString()}`;
}

const PAYMENT_METHODS = [
  {id: 'mobile_money', label: 'Mobile Money', icon: 'phone-portrait-outline'},
  {id: 'card', label: 'Card Payment', icon: 'card-outline'},
  {id: 'cod', label: 'Cash on Delivery', icon: 'cash-outline'},
];

const MM_NETWORKS = ['MTN', 'Airtel', 'M-Pesa'];

export default function CheckoutScreen({navigation}: any) {
  const {cart, clearCart, total, itemCount} = useCart();
  const {user, isAuthenticated} = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // Shipping form
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [mmNetwork, setMmNetwork] = useState('MTN');
  const [mmPhone, setMmPhone] = useState(user?.phone || '');

  // Extras
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [discreet, setDiscreet] = useState(true);

  const shippingCost = 5000;
  const grandTotal = total - couponDiscount + shippingCost;

  useEffect(() => {
    if (isAuthenticated) {
      api.addresses.list()
        .then(res => {
          setSavedAddresses(res.addresses);
          const def = res.addresses.find(a => a.isDefault);
          if (def) {
            setSelectedAddressId(def.id);
            setName(def.name);
            setPhone(def.phone);
            setStreet(def.street);
            setCity(def.city);
            setPostalCode(def.postalCode || '');
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const selectAddress = (addr: Address) => {
    setSelectedAddressId(addr.id);
    setName(addr.name);
    setPhone(addr.phone);
    setStreet(addr.street);
    setCity(addr.city);
    setPostalCode(addr.postalCode || '');
  };

  const validateStep1 = () => {
    if (!name.trim() || !phone.trim() || !street.trim() || !city.trim()) {
      Alert.alert('Missing Info', 'Please fill in all required address fields.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (paymentMethod === 'mobile_money' && !mmPhone.trim()) {
      Alert.alert('Missing Info', 'Please enter your mobile money phone number.');
      return false;
    }
    return true;
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const res = await api.coupons.validate(couponCode.trim(), total);
      if (res.valid) {
        setCouponDiscount(res.discount);
        setCouponApplied(true);
        Alert.alert('Coupon Applied', res.message);
      } else {
        Alert.alert('Invalid Coupon', res.message);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to validate coupon');
    }
  };

  const placeOrder = async () => {
    setLoading(true);
    try {
      const orderItems = cart?.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.product.price,
      })) || [];

      const res = await api.checkout.create({
        cartId: cart?.id,
        items: orderItems,
        currency: 'UGX',
        amount: grandTotal,
        shipping: shippingCost,
        paymentMethod,
        mobileMoney: paymentMethod === 'mobile_money' ? {network: mmNetwork, phone: mmPhone} : undefined,
        customer: {name, email, phone},
        couponCode: couponApplied ? couponCode : undefined,
        discreet,
        shippingAddress: {name, phone, street, city, postalCode},
      });

      await clearCart();
      Alert.alert('Order Placed!', `Your order #${res.orderNumber} has been placed successfully.`, [
        {text: 'View Order', onPress: () => navigation.replace('OrderDetail', {orderId: res.orderId, orderNumber: res.orderNumber})},
        {text: 'OK', onPress: () => navigation.popToTop()},
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>
        <View style={{width: 40}} />
      </View>

      {/* Steps Indicator */}
      <View style={styles.steps}>
        {['Shipping', 'Payment', 'Review'].map((s, i) => (
          <View key={i} style={styles.stepItem}>
            <View style={[styles.stepCircle, step > i && styles.stepCircleActive, step === i + 1 && styles.stepCircleCurrent]}>
              {step > i + 1 ? (
                <Icon name="checkmark" size={14} color={Colors.white} />
              ) : (
                <Text style={[styles.stepNum, (step >= i + 1) && styles.stepNumActive]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, step >= i + 1 && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Step 1: Shipping */}
        {step === 1 && (
          <View>
            {savedAddresses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Saved Addresses</Text>
                {savedAddresses.map(addr => (
                  <TouchableOpacity
                    key={addr.id}
                    style={[styles.addressCard, selectedAddressId === addr.id && styles.addressCardActive]}
                    onPress={() => selectAddress(addr)}>
                    <Icon name={selectedAddressId === addr.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={Colors.primary} />
                    <View style={{flex: 1, marginLeft: Spacing.md}}>
                      <Text style={styles.addressName}>{addr.name}</Text>
                      <Text style={styles.addressDetail}>{addr.street}, {addr.city}</Text>
                      <Text style={styles.addressDetail}>{addr.phone}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shipping Address</Text>
              {renderInput('Full Name', name, setName, 'person-outline')}
              {renderInput('Email', email, setEmail, 'mail-outline', 'email-address')}
              {renderInput('Phone', phone, setPhone, 'call-outline', 'phone-pad')}
              {renderInput('Street Address', street, setStreet, 'location-outline')}
              {renderInput('City', city, setCity, 'business-outline')}
              {renderInput('Postal Code (optional)', postalCode, setPostalCode, 'map-outline')}
            </View>
          </View>
        )}

        {/* Step 2: Payment */}
        {step === 2 && (
          <View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              {PAYMENT_METHODS.map(method => (
                <TouchableOpacity
                  key={method.id}
                  style={[styles.paymentCard, paymentMethod === method.id && styles.paymentCardActive]}
                  onPress={() => setPaymentMethod(method.id)}>
                  <Icon name={method.icon} size={24} color={paymentMethod === method.id ? Colors.primary : Colors.textMuted} />
                  <Text style={[styles.paymentLabel, paymentMethod === method.id && {color: Colors.primary, fontWeight: '600'}]}>{method.label}</Text>
                  <Icon name={paymentMethod === method.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </View>

            {paymentMethod === 'mobile_money' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mobile Money Details</Text>
                <Text style={styles.fieldLabel}>Network</Text>
                <View style={styles.networkRow}>
                  {MM_NETWORKS.map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.networkBtn, mmNetwork === n && styles.networkBtnActive]}
                      onPress={() => setMmNetwork(n)}>
                      <Text style={[styles.networkText, mmNetwork === n && styles.networkTextActive]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {renderInput('Phone Number', mmPhone, setMmPhone, 'call-outline', 'phone-pad')}
              </View>
            )}

            {/* Coupon */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Coupon Code</Text>
              <View style={styles.couponRow}>
                <TextInput
                  style={styles.couponInput}
                  value={couponCode}
                  onChangeText={setCouponCode}
                  placeholder="Enter coupon code"
                  placeholderTextColor={Colors.textMuted}
                  editable={!couponApplied}
                />
                <TouchableOpacity
                  style={[styles.couponBtn, couponApplied && {backgroundColor: Colors.success}]}
                  onPress={couponApplied ? () => {setCouponApplied(false); setCouponDiscount(0); setCouponCode('');} : applyCoupon}>
                  <Text style={styles.couponBtnText}>{couponApplied ? 'Remove' : 'Apply'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Discreet */}
            <View style={styles.discreetRow}>
              <View style={{flex: 1}}>
                <Text style={styles.discreetLabel}>Discreet Packaging</Text>
                <Text style={styles.discreetHint}>No product details on the package</Text>
              </View>
              <Switch
                value={discreet}
                onValueChange={setDiscreet}
                trackColor={{true: Colors.primary, false: Colors.border}}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Items</Text>
              {cart?.items.map(item => (
                <View key={item.id} style={styles.reviewItem}>
                  <Image source={{uri: getImageUrl(item.product.imageUrl)}} style={styles.reviewImage} />
                  <View style={{flex: 1}}>
                    <Text style={styles.reviewName} numberOfLines={1}>{item.product.name}</Text>
                    <Text style={styles.reviewMeta}>{formatPrice(item.product.price)} × {item.quantity}</Text>
                  </View>
                  <Text style={styles.reviewSubtotal}>{formatPrice(item.subtotal)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shipping To</Text>
              <View style={styles.infoCard}>
                <Text style={styles.infoLine}>{name}</Text>
                <Text style={styles.infoLine}>{street}, {city}</Text>
                <Text style={styles.infoLine}>{phone}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment</Text>
              <View style={styles.infoCard}>
                <Text style={styles.infoLine}>
                  {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}
                  {paymentMethod === 'mobile_money' && ` (${mmNetwork})`}
                </Text>
              </View>
            </View>

            {/* Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatPrice(total)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Shipping</Text>
                <Text style={styles.summaryValue}>{formatPrice(shippingCost)}</Text>
              </View>
              {couponDiscount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, {color: Colors.success}]}>Discount</Text>
                  <Text style={[styles.summaryValue, {color: Colors.success}]}>-{formatPrice(couponDiscount)}</Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatPrice(grandTotal)}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom */}
      <View style={styles.bottomBar}>
        {step < 3 ? (
          <TouchableOpacity style={styles.nextBtn} onPress={nextStep} activeOpacity={0.8}>
            <Text style={styles.nextBtnText}>Continue</Text>
            <Icon name="arrow-forward" size={20} color={Colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, loading && {opacity: 0.7}]}
            onPress={placeOrder}
            disabled={loading}
            activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Icon name="checkmark-circle" size={20} color={Colors.white} />
                <Text style={styles.nextBtnText}>Place Order • {formatPrice(grandTotal)}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function renderInput(
  placeholder: string,
  value: string,
  onChange: (t: string) => void,
  icon: string,
  keyboardType?: any,
) {
  return (
    <View style={inputStyles.wrap}>
      <Icon name={icon} size={20} color={Colors.textMuted} />
      <TextInput
        style={inputStyles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}

const inputStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: Fonts.sizes.base,
    color: Colors.text,
    paddingVertical: 0,
  },
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.md,
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
  steps: {
    flexDirection: 'row', justifyContent: 'center',
    paddingVertical: Spacing.md, gap: Spacing.xxxl,
  },
  stepItem: {alignItems: 'center'},
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  stepCircleActive: {backgroundColor: Colors.primary, borderColor: Colors.primary},
  stepCircleCurrent: {borderColor: Colors.primary, backgroundColor: Colors.primaryLight},
  stepNum: {fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textMuted},
  stepNumActive: {color: Colors.primary},
  stepLabel: {fontSize: Fonts.sizes.xs, color: Colors.textMuted, marginTop: 4},
  stepLabelActive: {color: Colors.text, fontWeight: '500'},
  content: {paddingHorizontal: Spacing.lg, paddingBottom: 120},
  section: {marginBottom: Spacing.xxl},
  sectionTitle: {
    fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm,
  },
  addressCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.lg, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  addressCardActive: {borderColor: Colors.primary, backgroundColor: Colors.primaryLight},
  addressName: {fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.text},
  addressDetail: {fontSize: Fonts.sizes.sm, color: Colors.textMuted, marginTop: 2},
  paymentCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.lg, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  paymentCardActive: {borderColor: Colors.primary, backgroundColor: Colors.primaryLight},
  paymentLabel: {flex: 1, fontSize: Fonts.sizes.lg, color: Colors.text},
  networkRow: {flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg},
  networkBtn: {
    flex: 1, paddingVertical: Spacing.md,
    borderRadius: Radius.full, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  networkBtnActive: {borderColor: Colors.primary, backgroundColor: Colors.primaryLight},
  networkText: {fontSize: Fonts.sizes.md, fontWeight: '500', color: Colors.text},
  networkTextActive: {color: Colors.primary, fontWeight: '600'},
  couponRow: {flexDirection: 'row', gap: Spacing.sm},
  couponInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, height: 44,
    fontSize: Fonts.sizes.md, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },
  couponBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl, justifyContent: 'center',
  },
  couponBtnText: {color: Colors.white, fontWeight: '600', fontSize: Fonts.sizes.md},
  discreetRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.lg, marginBottom: Spacing.xxl,
    ...Shadows.sm,
  },
  discreetLabel: {fontSize: Fonts.sizes.lg, fontWeight: '600', color: Colors.text},
  discreetHint: {fontSize: Fonts.sizes.sm, color: Colors.textMuted, marginTop: 2},
  reviewItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    gap: Spacing.md,
  },
  reviewImage: {width: 50, height: 62, borderRadius: Radius.md, backgroundColor: Colors.surfaceSecondary},
  reviewName: {fontSize: Fonts.sizes.md, fontWeight: '500', color: Colors.text},
  reviewMeta: {fontSize: Fonts.sizes.sm, color: Colors.textMuted, marginTop: 2},
  reviewSubtotal: {fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.text},
  infoCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.lg, ...Shadows.sm,
  },
  infoLine: {fontSize: Fonts.sizes.md, color: Colors.text, lineHeight: 22},
  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xxl,
    padding: Spacing.xl, ...Shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  summaryLabel: {fontSize: Fonts.sizes.md, color: Colors.textMuted},
  summaryValue: {fontSize: Fonts.sizes.md, fontWeight: '500', color: Colors.text},
  summaryTotal: {
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    marginTop: Spacing.sm, paddingTop: Spacing.md,
  },
  totalLabel: {fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.text},
  totalValue: {fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.text},
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xxl,
    borderTopWidth: 1, borderTopColor: Colors.borderLight, ...Shadows.md,
  },
  nextBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: Radius.full, gap: Spacing.sm,
  },
  nextBtnText: {color: Colors.white, fontSize: Fonts.sizes.lg, fontWeight: '600'},
});
