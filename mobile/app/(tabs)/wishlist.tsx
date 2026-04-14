import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  TextInput, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useTheme } from "@/lib/hooks";
import { storage } from "@/lib/storage";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import ProductCard from "@/components/ProductCard";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { WishlistItem } from "@/lib/types";

export default function WishlistScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [showSetPinModal, setShowSetPinModal] = useState(false);
  const [newPin, setNewPin] = useState("");

  const loadWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const pinStatus = await api.getWishlistPinStatus();
      setHasPin(pinStatus.hasPin);

      if (pinStatus.hasPin) {
        const verified = await storage.isWishlistPinVerified();
        if (!verified) {
          setShowPinModal(true);
          setLoading(false);
          return;
        }
        setPinVerified(true);
      }

      const data = await api.getWishlist();
      setItems(data.items);
    } catch {} finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadWishlist(); }, [loadWishlist]);

  const handleVerifyPin = async () => {
    if (!pin || pin.length < 4) {
      setPinError("PIN must be at least 4 digits");
      return;
    }
    try {
      const result = await api.verifyWishlistPin(pin);
      if (result.valid) {
        await storage.setWishlistPinVerified(true);
        setPinVerified(true);
        setShowPinModal(false);
        setPin("");
        // Load wishlist items now
        const data = await api.getWishlist();
        setItems(data.items);
      } else {
        setPinError("Invalid PIN");
      }
    } catch (err: any) {
      setPinError(err.message || "Verification failed");
    }
  };

  const handleSetPin = async () => {
    if (!newPin || newPin.length < 4) {
      Alert.alert("Error", "PIN must be at least 4 digits");
      return;
    }
    try {
      await api.setWishlistPin(newPin);
      setHasPin(true);
      setShowSetPinModal(false);
      setNewPin("");
      Alert.alert("Success", "PIN has been set for your wishlist.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to set PIN");
    }
  };

  const handleRemove = async (productId: string) => {
    try {
      await api.removeFromWishlist(productId);
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } catch {}
  };

  const handleMoveToCart = async (item: WishlistItem) => {
    try {
      await addItem(item.productId);
      await api.removeFromWishlist(item.productId);
      setItems((prev) => prev.filter((i) => i.productId !== item.productId));
      Alert.alert("Added to Cart", `${item.product.name} moved to cart.`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to move to cart");
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <EmptyState
          icon="heart-outline"
          title="Sign In Required"
          message="Please sign in to view your wishlist."
        />
        <TouchableOpacity
          style={[styles.signInBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push("/auth/login")}
        >
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) return <LoadingSpinner message="Loading wishlist..." />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* PIN Verification Modal */}
      <Modal visible={showPinModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <Ionicons name="lock-closed" size={48} color={theme.primary} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Enter Wishlist PIN</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Your wishlist is protected with a PIN.
            </Text>
            <TextInput
              style={[styles.pinInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              value={pin}
              onChangeText={(v) => { setPin(v); setPinError(""); }}
              placeholder="Enter PIN"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
            />
            {pinError ? <Text style={[styles.pinError, { color: theme.error }]}>{pinError}</Text> : null}
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              onPress={handleVerifyPin}
            >
              <Text style={styles.modalBtnText}>Verify</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowPinModal(false); router.back(); }}>
              <Text style={[styles.cancelText, { color: theme.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Set PIN Modal */}
      <Modal visible={showSetPinModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <Ionicons name="shield-checkmark" size={48} color={theme.primary} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Set Wishlist PIN</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Protect your wishlist with a 4-6 digit PIN.
            </Text>
            <TextInput
              style={[styles.pinInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              value={newPin}
              onChangeText={setNewPin}
              placeholder="Enter new PIN"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              onPress={handleSetPin}
            >
              <Text style={styles.modalBtnText}>Set PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSetPinModal(false)}>
              <Text style={[styles.cancelText, { color: theme.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header with PIN toggle */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {items.length} item{items.length !== 1 ? "s" : ""}
        </Text>
        {!hasPin && (
          <TouchableOpacity onPress={() => setShowSetPinModal(true)}>
            <Text style={[styles.setPinText, { color: theme.primary }]}>
              <Ionicons name="lock-closed-outline" size={14} /> Set PIN
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <EmptyState icon="heart-outline" title="Wishlist is Empty" message="Save items you love for later." />
      ) : (
        <FlatList
          data={items}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ProductCard
                product={item.product}
                isWishlisted
                onToggleWishlist={() => handleRemove(item.productId)}
                onAddToCart={() => handleMoveToCart(item)}
              />
            </View>
          )}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: "600" },
  setPinText: { fontSize: FontSize.md, fontWeight: "600" },
  list: { paddingHorizontal: Spacing.lg },
  row: { gap: Spacing.lg },
  cardWrapper: { flex: 1 },
  signInBtn: {
    marginHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  signInBtnText: { color: "#FFF", fontSize: FontSize.lg, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: "85%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: "center",
    gap: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: "700" },
  modalSubtitle: { fontSize: FontSize.md, textAlign: "center" },
  pinInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: FontSize.xl,
    textAlign: "center",
    letterSpacing: 8,
  },
  pinError: { fontSize: FontSize.sm },
  modalBtn: {
    width: "100%",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  modalBtnText: { color: "#FFF", fontSize: FontSize.lg, fontWeight: "700" },
  cancelText: { fontSize: FontSize.md, marginTop: Spacing.sm },
});
