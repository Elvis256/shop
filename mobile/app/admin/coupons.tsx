import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, Modal, TextInput, ScrollView, Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import type { Coupon } from "@/lib/types";

export default function AdminCouponsScreen() {
  const theme = useTheme();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: "",
    description: "",
    type: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
    value: "",
    minOrderAmount: "",
    maxDiscount: "",
    active: true,
  });

  const loadCoupons = useCallback(async () => {
    try {
      const data = await api.admin.getCoupons();
      setCoupons(data.coupons);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadCoupons(); }, [loadCoupons]);

  const resetForm = () => {
    setForm({ code: "", description: "", type: "PERCENTAGE", value: "", minOrderAmount: "", maxDiscount: "", active: true });
    setEditingId(null);
  };

  const handleEdit = (coupon: Coupon) => {
    setForm({
      code: coupon.code,
      description: coupon.description || "",
      type: coupon.type,
      value: coupon.value.toString(),
      minOrderAmount: coupon.minOrderAmount?.toString() || "",
      maxDiscount: coupon.maxDiscount?.toString() || "",
      active: coupon.active,
    });
    setEditingId(coupon.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.value) {
      Alert.alert("Error", "Code and value are required.");
      return;
    }
    setSaving(true);
    try {
      const data: any = {
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        type: form.type,
        value: parseFloat(form.value),
        minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : null,
        maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : null,
        active: form.active,
      };

      if (editingId) {
        await api.admin.updateCoupon(editingId, data);
      } else {
        await api.admin.createCoupon(data);
      }
      setShowForm(false);
      resetForm();
      await loadCoupons();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save coupon.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, code: string) => {
    Alert.alert("Delete Coupon", `Delete coupon "${code}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.admin.deleteCoupon(id);
            setCoupons((prev) => prev.filter((c) => c.id !== id));
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingSpinner message="Loading coupons..." />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Form modal */}
      <Modal visible={showForm} animationType="slide">
        <ScrollView style={[styles.formContainer, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}>
            <Text style={[styles.formTitle, { color: theme.text }]}>
              {editingId ? "Edit Coupon" : "Create Coupon"}
            </Text>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Code *</Text>
            <TextInput
              style={[styles.fieldInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              value={form.code}
              onChangeText={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))}
              placeholder="e.g. SAVE20"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Description</Text>
            <TextInput
              style={[styles.fieldInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              value={form.description}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              placeholder="Coupon description"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Type</Text>
            <View style={styles.typeRow}>
              {(["PERCENTAGE", "FIXED"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeChip,
                    { borderColor: form.type === t ? theme.primary : theme.border },
                    form.type === t && { backgroundColor: theme.primary + "15" },
                  ]}
                  onPress={() => setForm((f) => ({ ...f, type: t }))}
                >
                  <Text style={[styles.typeText, { color: form.type === t ? theme.primary : theme.text }]}>
                    {t === "PERCENTAGE" ? "Percentage (%)" : "Fixed (KES)"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Value * {form.type === "PERCENTAGE" ? "(%)" : "(KES)"}
            </Text>
            <TextInput
              style={[styles.fieldInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              value={form.value}
              onChangeText={(v) => setForm((f) => ({ ...f, value: v }))}
              placeholder={form.type === "PERCENTAGE" ? "e.g. 20" : "e.g. 500"}
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Min Order Amount (KES)</Text>
            <TextInput
              style={[styles.fieldInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              value={form.minOrderAmount}
              onChangeText={(v) => setForm((f) => ({ ...f, minOrderAmount: v }))}
              placeholder="Optional"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
            />
          </View>

          {form.type === "PERCENTAGE" && (
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Max Discount (KES)</Text>
              <TextInput
                style={[styles.fieldInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
                value={form.maxDiscount}
                onChangeText={(v) => setForm((f) => ({ ...f, maxDiscount: v }))}
                placeholder="Optional cap"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
              />
            </View>
          )}

          <View style={[styles.field, styles.switchRow]}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Active</Text>
            <Switch
              value={form.active}
              onValueChange={(v) => setForm((f) => ({ ...f, active: v }))}
              trackColor={{ true: theme.primary }}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Coupon"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      <FlatList
        data={coupons}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.code, { color: theme.primary }]}>{item.code}</Text>
                {item.description && (
                  <Text style={[styles.desc, { color: theme.textSecondary }]}>{item.description}</Text>
                )}
              </View>
              <View style={[styles.activeBadge, { backgroundColor: item.active ? theme.success + "20" : theme.error + "20" }]}>
                <Text style={[styles.activeBadgeText, { color: item.active ? theme.success : theme.error }]}>
                  {item.active ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>
            <Text style={[styles.valueText, { color: theme.text }]}>
              {item.type === "PERCENTAGE" ? `${item.value}% off` : `KES ${item.value} off`}
              {item.minOrderAmount ? ` (min KES ${item.minOrderAmount.toLocaleString()})` : ""}
            </Text>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => handleEdit(item)}>
                <Text style={[styles.actionLink, { color: theme.primary }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id, item.code)}>
                <Text style={[styles.actionLink, { color: theme.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCoupons(); }} tintColor={theme.primary} />
        }
        ListEmptyComponent={<EmptyState icon="pricetag-outline" title="No Coupons" message="Create your first coupon." />}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => { resetForm(); setShowForm(true); }}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 80 },
  card: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md, marginBottom: Spacing.sm },
  code: { fontSize: FontSize.lg, fontWeight: "700" },
  desc: { fontSize: FontSize.sm, marginTop: 2 },
  activeBadge: { borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  activeBadgeText: { fontSize: FontSize.xs, fontWeight: "700" },
  valueText: { fontSize: FontSize.md, fontWeight: "500" },
  cardActions: { flexDirection: "row", gap: Spacing.lg, marginTop: Spacing.md },
  actionLink: { fontSize: FontSize.md, fontWeight: "600" },
  fab: {
    position: "absolute", bottom: Spacing.xxl, right: Spacing.xxl,
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  formContainer: { flex: 1, padding: Spacing.xxl },
  formHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: Spacing.xxl, paddingTop: Spacing.xxl,
  },
  formTitle: { fontSize: FontSize.xxl, fontWeight: "700" },
  field: { marginBottom: Spacing.lg },
  fieldLabel: { fontSize: FontSize.md, fontWeight: "600", marginBottom: Spacing.sm },
  fieldInput: {
    borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, fontSize: FontSize.base,
  },
  typeRow: { flexDirection: "row", gap: Spacing.md },
  typeChip: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: "center" },
  typeText: { fontSize: FontSize.md, fontWeight: "600" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  saveBtn: {
    paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: "center", marginBottom: Spacing.xxxl,
  },
  saveBtnText: { color: "#FFF", fontSize: FontSize.lg, fontWeight: "700" },
});
