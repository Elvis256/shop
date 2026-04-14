import React, { useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import CartItemCard from "@/components/CartItemCard";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function CartScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { cart, isLoading, itemCount, total, updateItem, removeItem, clearCart } = useCart();
  const { isAuthenticated } = useAuth();

  const handleCheckout = useCallback(() => {
    if (!isAuthenticated) {
      Alert.alert("Login Required", "Please sign in to proceed to checkout.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign In", onPress: () => router.push("/auth/login") },
      ]);
      return;
    }
    if (!cart || cart.items.length === 0) {
      Alert.alert("Empty Cart", "Please add items to your cart first.");
      return;
    }
    router.push("/checkout");
  }, [isAuthenticated, cart, router]);

  const handleClearCart = useCallback(() => {
    Alert.alert("Clear Cart", "Remove all items from your cart?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearCart },
    ]);
  }, [clearCart]);

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      Alert.alert("Remove Item", "Remove this item from your cart?", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeItem(itemId) },
      ]);
    },
    [removeItem]
  );

  if (isLoading) return <LoadingSpinner message="Loading cart..." />;

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        icon="cart-outline"
        title="Your Cart is Empty"
        message="Add some products to get started."
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={cart.items}
        renderItem={({ item }) => (
          <CartItemCard
            item={item}
            onUpdateQuantity={(qty) => updateItem(item.id, qty)}
            onRemove={() => handleRemoveItem(item.id)}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={[styles.headerText, { color: theme.text }]}>
              {itemCount} item{itemCount !== 1 ? "s" : ""} in cart
            </Text>
            <TouchableOpacity onPress={handleClearCart}>
              <Text style={[styles.clearText, { color: theme.error }]}>Clear All</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Checkout footer */}
      <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Total</Text>
          <Text style={[styles.totalAmount, { color: theme.text }]}>
            KES {total.toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutBtn, { backgroundColor: theme.primary }]}
          onPress={handleCheckout}
        >
          <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  headerText: { fontSize: FontSize.lg, fontWeight: "600" },
  clearText: { fontSize: FontSize.md, fontWeight: "600" },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: FontSize.lg },
  totalAmount: { fontSize: FontSize.xxl, fontWeight: "700" },
  checkoutBtn: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  checkoutBtnText: { color: "#FFF", fontSize: FontSize.lg, fontWeight: "700" },
});
