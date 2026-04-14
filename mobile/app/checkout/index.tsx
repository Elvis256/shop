import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import type { Address, CheckoutRequest } from "@/lib/types";

type PaymentType = "card" | "mobile_money";
type MobileNetwork = "MPESA" | "AIRTEL" | "MTN";

export default function CheckoutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { cart, clearCart } = useCart();
  const { user, profile } = useAuth();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("mobile_money");
  const [mobileNetwork, setMobileNetwork] = useState<MobileNetwork>("MPESA");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [discreet, setDiscreet] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1=address, 2=payment, 3=review

  useEffect(() => {
    (async () => {
      try {
        const addrs = await api.getAddresses();
        setAddresses(addrs);
        const defaultAddr = addrs.find((a) => a.isDefault) || addrs[0];
        if (defaultAddr) setSelectedAddress(defaultAddr);
      } catch {}
    })();
  }, []);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !cart) return;
    try {
      const result = await api.validateCoupon(couponCode.trim(), cart.total);
      if (result.valid) {
        setDiscount(result.discount);
        setCouponMessage(`Coupon applied! -KES ${result.discount.toLocaleString()}`);
      } else {
        setCouponMessage(result.message || "Invalid coupon");
        setDiscount(0);
      }
    } catch (err: any) {
      setCouponMessage(err.message || "Failed to validate coupon");
      setDiscount(0);
    }
  };

  const handleCheckout = async () => {
    if (!cart || !user) return;

    if (!selectedAddress) {
      Alert.alert("Error", "Please select a shipping address.");
      return;
    }

    if (paymentType === "mobile_money" && !phone.trim()) {
      Alert.alert("Error", "Please enter your mobile money phone number.");
      return;
    }

    setLoading(true);
    try {
      const addressStr = `${selectedAddress.name}, ${selectedAddress.street}, ${selectedAddress.city}${selectedAddress.county ? `, ${selectedAddress.county}` : ""}`;

      const checkoutData: CheckoutRequest = {
        cartId: cart.id,
        currency: "KES",
        amount: cart.total - discount,
        paymentMethod: paymentType,
        customer: {
          name: user.name || "",
          email: user.email,
        },
        discreet,
        shippingAddress: addressStr,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
        ...(paymentType === "mobile_money"
          ? { mobileMoney: { network: mobileNetwork, phone: phone.trim() } }
          : {}),
      };

      const result = await api.createCheckout(checkoutData);

      await clearCart();

      Alert.alert(
        "Order Placed! 🎉",
        `Order #${result.orderId} has been created.\n\n${
          paymentType === "mobile_money"
            ? "Please check your phone to complete the payment."
            : result.paymentLink
            ? "You will be redirected to complete payment."
            : "Your order is being processed."
        }`,
        [{ text: "View Order", onPress: () => router.replace(`/orders/${result.orderId}`) }]
      );
    } catch (err: any) {
      Alert.alert("Checkout Failed", err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!cart || cart.items.length === 0) {
    router.replace("/(tabs)/cart");
    return null;
  }

  const finalTotal = cart.total - discount;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
        {/* Step indicators */}
        <View style={styles.steps}>
          {["Address", "Payment", "Review"].map((label, i) => (
            <TouchableOpacity key={label} style={styles.stepItem} onPress={() => setStep(i + 1)} disabled={i + 1 > step}>
              <View style={[styles.stepCircle, { backgroundColor: step >= i + 1 ? theme.primary : theme.border }]}>
                <Text style={styles.stepNum}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepLabel, { color: step >= i + 1 ? theme.primary : theme.textMuted }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Step 1: Address */}
        {step === 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Shipping Address</Text>
            {addresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                style={[
                  styles.addressCard,
                  { borderColor: selectedAddress?.id === addr.id ? theme.primary : theme.border },
                  selectedAddress?.id === addr.id && { backgroundColor: theme.primary + "10" },
                ]}
                onPress={() => setSelectedAddress(addr)}
              >
                <View style={styles.radioRow}>
                  <Ionicons
                    name={selectedAddress?.id === addr.id ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={selectedAddress?.id === addr.id ? theme.primary : theme.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.addressName, { color: theme.text }]}>{addr.name}</Text>
                    <Text style={[styles.addressDetail, { color: theme.textSecondary }]}>
                      {addr.street}, {addr.city}
                      {addr.county ? `, ${addr.county}` : ""}
                    </Text>
                    <Text style={[styles.addressDetail, { color: theme.textSecondary }]}>{addr.phone}</Text>
                  </View>
                  {addr.isDefault && (
                    <Text style={[styles.defaultBadge, { color: theme.primary }]}>Default</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            {addresses.length === 0 && (
              <TouchableOpacity
                style={[styles.addAddressBtn, { borderColor: theme.border }]}
                onPress={() => router.push("/account/addresses")}
              >
                <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
                <Text style={[styles.addAddressText, { color: theme.primary }]}>Add New Address</Text>
              </TouchableOpacity>
            )}

            {/* Discreet packaging */}
            <TouchableOpacity style={styles.discreetRow} onPress={() => setDiscreet(!discreet)}>
              <Ionicons name={discreet ? "checkbox" : "square-outline"} size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.discreetLabel, { color: theme.text }]}>Discreet Packaging</Text>
                <Text style={[styles.discreetHint, { color: theme.textMuted }]}>
                  Plain package, no branding or product description visible
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: theme.primary }]}
              onPress={() => setStep(2)}
            >
              <Text style={styles.nextBtnText}>Continue to Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Payment */}
        {step === 2 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment Method</Text>

            {/* Mobile Money */}
            <TouchableOpacity
              style={[
                styles.paymentCard,
                { borderColor: paymentType === "mobile_money" ? theme.primary : theme.border },
                paymentType === "mobile_money" && { backgroundColor: theme.primary + "10" },
              ]}
              onPress={() => setPaymentType("mobile_money")}
            >
              <Ionicons
                name={paymentType === "mobile_money" ? "radio-button-on" : "radio-button-off"}
                size={20} color={paymentType === "mobile_money" ? theme.primary : theme.textMuted}
              />
              <Ionicons name="phone-portrait-outline" size={24} color={theme.text} />
              <Text style={[styles.paymentLabel, { color: theme.text }]}>Mobile Money</Text>
            </TouchableOpacity>

            {paymentType === "mobile_money" && (
              <View style={styles.mobileOptions}>
                <Text style={[styles.subLabel, { color: theme.text }]}>Select Network</Text>
                <View style={styles.networkRow}>
                  {(["MPESA", "AIRTEL", "MTN"] as MobileNetwork[]).map((net) => (
                    <TouchableOpacity
                      key={net}
                      style={[
                        styles.networkChip,
                        { borderColor: mobileNetwork === net ? theme.primary : theme.border },
                        mobileNetwork === net && { backgroundColor: theme.primary + "15" },
                      ]}
                      onPress={() => setMobileNetwork(net)}
                    >
                      <Text style={[styles.networkText, { color: mobileNetwork === net ? theme.primary : theme.text }]}>
                        {net === "MPESA" ? "M-Pesa" : net === "AIRTEL" ? "Airtel Money" : "MTN MoMo"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.subLabel, { color: theme.text }]}>Phone Number</Text>
                <TextInput
                  style={[styles.phoneInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g. 254712345678"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                />
              </View>
            )}

            {/* Card */}
            <TouchableOpacity
              style={[
                styles.paymentCard,
                { borderColor: paymentType === "card" ? theme.primary : theme.border },
                paymentType === "card" && { backgroundColor: theme.primary + "10" },
              ]}
              onPress={() => setPaymentType("card")}
            >
              <Ionicons
                name={paymentType === "card" ? "radio-button-on" : "radio-button-off"}
                size={20} color={paymentType === "card" ? theme.primary : theme.textMuted}
              />
              <Ionicons name="card-outline" size={24} color={theme.text} />
              <Text style={[styles.paymentLabel, { color: theme.text }]}>Debit / Credit Card</Text>
            </TouchableOpacity>

            {/* Coupon */}
            <Text style={[styles.subLabel, { color: theme.text, marginTop: Spacing.lg }]}>Coupon Code</Text>
            <View style={styles.couponRow}>
              <TextInput
                style={[styles.couponInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
                value={couponCode}
                onChangeText={setCouponCode}
                placeholder="Enter code"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: theme.primary }]}
                onPress={handleApplyCoupon}
              >
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
            {couponMessage ? (
              <Text style={[styles.couponMsg, { color: discount > 0 ? theme.success : theme.error }]}>
                {couponMessage}
              </Text>
            ) : null}

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.backBtn, { borderColor: theme.border }]} onPress={() => setStep(1)}>
                <Text style={[styles.backBtnText, { color: theme.text }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: theme.primary, flex: 1 }]}
                onPress={() => setStep(3)}
              >
                <Text style={styles.nextBtnText}>Review Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Order Summary</Text>

            {/* Items */}
            {cart.items.map((item) => (
              <View key={item.id} style={[styles.summaryItem, { borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.itemQty, { color: theme.textMuted }]}>Qty: {item.quantity}</Text>
                </View>
                <Text style={[styles.itemPrice, { color: theme.text }]}>
                  KES {(item.price * item.quantity).toLocaleString()}
                </Text>
              </View>
            ))}

            {/* Totals */}
            <View style={[styles.totalsCard, { backgroundColor: theme.surface }]}>
              <View style={styles.totalLine}>
                <Text style={[styles.totalLineLabel, { color: theme.textSecondary }]}>Subtotal</Text>
                <Text style={[styles.totalLineValue, { color: theme.text }]}>KES {cart.total.toLocaleString()}</Text>
              </View>
              {discount > 0 && (
                <View style={styles.totalLine}>
                  <Text style={[styles.totalLineLabel, { color: theme.success }]}>Discount</Text>
                  <Text style={[styles.totalLineValue, { color: theme.success }]}>-KES {discount.toLocaleString()}</Text>
                </View>
              )}
              <View style={[styles.totalLine, styles.grandTotal]}>
                <Text style={[styles.grandTotalLabel, { color: theme.text }]}>Total</Text>
                <Text style={[styles.grandTotalValue, { color: theme.primary }]}>KES {finalTotal.toLocaleString()}</Text>
              </View>
            </View>

            {/* Address summary */}
            {selectedAddress && (
              <View style={[styles.reviewBox, { borderColor: theme.border }]}>
                <Text style={[styles.reviewBoxLabel, { color: theme.textMuted }]}>Ship to</Text>
                <Text style={[styles.reviewBoxValue, { color: theme.text }]}>
                  {selectedAddress.name}, {selectedAddress.street}, {selectedAddress.city}
                </Text>
              </View>
            )}

            {/* Payment summary */}
            <View style={[styles.reviewBox, { borderColor: theme.border }]}>
              <Text style={[styles.reviewBoxLabel, { color: theme.textMuted }]}>Payment</Text>
              <Text style={[styles.reviewBoxValue, { color: theme.text }]}>
                {paymentType === "mobile_money"
                  ? `${mobileNetwork === "MPESA" ? "M-Pesa" : mobileNetwork === "AIRTEL" ? "Airtel Money" : "MTN MoMo"} — ${phone}`
                  : "Credit / Debit Card"}
              </Text>
            </View>

            {discreet && (
              <View style={[styles.reviewBox, { borderColor: theme.border }]}>
                <Text style={[styles.reviewBoxLabel, { color: theme.textMuted }]}>Packaging</Text>
                <Text style={[styles.reviewBoxValue, { color: theme.success }]}>✓ Discreet packaging</Text>
              </View>
            )}

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.backBtn, { borderColor: theme.border }]} onPress={() => setStep(2)}>
                <Text style={[styles.backBtnText, { color: theme.text }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: theme.primary, flex: 1 }, loading && { opacity: 0.6 }]}
                onPress={handleCheckout}
                disabled={loading}
              >
                <Ionicons name="lock-closed" size={18} color="#FFF" />
                <Text style={styles.nextBtnText}>{loading ? "Processing..." : "Place Order"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  steps: {
    flexDirection: "row", justifyContent: "center",
    padding: Spacing.lg, gap: Spacing.xxl,
  },
  stepItem: { alignItems: "center", gap: Spacing.xs },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  stepNum: { color: "#FFF", fontWeight: "700", fontSize: FontSize.md },
  stepLabel: { fontSize: FontSize.xs, fontWeight: "600" },
  section: { padding: Spacing.lg, gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: "700", marginBottom: Spacing.sm },
  addressCard: {
    borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md,
  },
  radioRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  addressName: { fontSize: FontSize.base, fontWeight: "600" },
  addressDetail: { fontSize: FontSize.md, marginTop: 2 },
  defaultBadge: { fontSize: FontSize.xs, fontWeight: "700" },
  addAddressBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderStyle: "dashed", borderRadius: BorderRadius.lg,
    padding: Spacing.lg, gap: Spacing.sm,
  },
  addAddressText: { fontSize: FontSize.base, fontWeight: "600" },
  discreetRow: {
    flexDirection: "row", alignItems: "flex-start", gap: Spacing.md, marginTop: Spacing.md,
  },
  discreetLabel: { fontSize: FontSize.base, fontWeight: "600" },
  discreetHint: { fontSize: FontSize.sm, marginTop: 2 },
  paymentCard: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, gap: Spacing.md,
  },
  paymentLabel: { fontSize: FontSize.base, fontWeight: "600" },
  mobileOptions: { paddingLeft: Spacing.xl, gap: Spacing.sm },
  subLabel: { fontSize: FontSize.md, fontWeight: "600" },
  networkRow: { flexDirection: "row", gap: Spacing.sm },
  networkChip: {
    borderWidth: 1, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  networkText: { fontSize: FontSize.md, fontWeight: "500" },
  phoneInput: {
    borderWidth: 1, borderRadius: BorderRadius.lg,
    padding: Spacing.md, fontSize: FontSize.base,
  },
  couponRow: { flexDirection: "row", gap: Spacing.sm },
  couponInput: {
    flex: 1, borderWidth: 1, borderRadius: BorderRadius.lg,
    padding: Spacing.md, fontSize: FontSize.base,
  },
  applyBtn: {
    paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.lg,
    justifyContent: "center",
  },
  applyBtnText: { color: "#FFF", fontWeight: "700", fontSize: FontSize.md },
  couponMsg: { fontSize: FontSize.sm, fontWeight: "600" },
  summaryItem: {
    flexDirection: "row", alignItems: "center",
    borderBottomWidth: 1, paddingVertical: Spacing.md,
  },
  itemName: { fontSize: FontSize.md, fontWeight: "500" },
  itemQty: { fontSize: FontSize.sm },
  itemPrice: { fontSize: FontSize.base, fontWeight: "600" },
  totalsCard: {
    borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.sm,
  },
  totalLine: {
    flexDirection: "row", justifyContent: "space-between",
  },
  totalLineLabel: { fontSize: FontSize.md },
  totalLineValue: { fontSize: FontSize.md, fontWeight: "600" },
  grandTotal: {
    borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: Spacing.sm, marginTop: Spacing.sm,
  },
  grandTotalLabel: { fontSize: FontSize.lg, fontWeight: "700" },
  grandTotalValue: { fontSize: FontSize.xl, fontWeight: "700" },
  reviewBox: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md },
  reviewBoxLabel: { fontSize: FontSize.xs, fontWeight: "600", textTransform: "uppercase", marginBottom: Spacing.xs },
  reviewBoxValue: { fontSize: FontSize.md },
  btnRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
  backBtn: {
    borderWidth: 1, borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
  },
  backBtnText: { fontSize: FontSize.base, fontWeight: "600" },
  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, gap: Spacing.sm,
  },
  nextBtnText: { color: "#FFF", fontSize: FontSize.lg, fontWeight: "700" },
});
