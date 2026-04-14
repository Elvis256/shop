import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import type { Address } from "@/lib/types";

export default function AddressesScreen() {
  const theme = useTheme();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", street: "", city: "", county: "", postalCode: "" });
  const [saving, setSaving] = useState(false);

  const loadAddresses = useCallback(async () => {
    try {
      const data = await api.getAddresses();
      setAddresses(data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAddresses(); }, [loadAddresses]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.street.trim() || !form.city.trim()) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.updateAddress(editingId, form);
      } else {
        await api.createAddress(form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", phone: "", street: "", city: "", county: "", postalCode: "" });
      await loadAddresses();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save address.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (addr: Address) => {
    setForm({
      name: addr.name, phone: addr.phone, street: addr.street,
      city: addr.city, county: addr.county || "", postalCode: addr.postalCode || "",
    });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Address", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.deleteAddress(id);
            setAddresses((prev) => prev.filter((a) => a.id !== id));
          } catch {}
        },
      },
    ]);
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.setDefaultAddress(id);
      await loadAddresses();
    } catch {}
  };

  if (loading) return <LoadingSpinner message="Loading addresses..." />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Add/Edit modal */}
      <Modal visible={showForm} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView style={[styles.formContainer, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
            <View style={styles.formHeader}>
              <Text style={[styles.formTitle, { color: theme.text }]}>
                {editingId ? "Edit Address" : "Add Address"}
              </Text>
              <TouchableOpacity onPress={() => { setShowForm(false); setEditingId(null); }}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
            </View>

            {[
              { key: "name", label: "Full Name *", placeholder: "John Doe", keyboard: "default" as const },
              { key: "phone", label: "Phone *", placeholder: "254712345678", keyboard: "phone-pad" as const },
              { key: "street", label: "Street Address *", placeholder: "123 Main St", keyboard: "default" as const },
              { key: "city", label: "City *", placeholder: "Nairobi", keyboard: "default" as const },
              { key: "county", label: "County", placeholder: "Nairobi County", keyboard: "default" as const },
              { key: "postalCode", label: "Postal Code", placeholder: "00100", keyboard: "default" as const },
            ].map((field) => (
              <View key={field.key} style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>{field.label}</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
                  value={(form as any)[field.key]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={theme.textMuted}
                  keyboardType={field.keyboard}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Address"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <FlatList
        data={addresses}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.addrName, { color: theme.text }]}>{item.name}</Text>
              {item.isDefault && (
                <View style={[styles.defaultBadge, { backgroundColor: theme.primary + "20" }]}>
                  <Text style={[styles.defaultText, { color: theme.primary }]}>Default</Text>
                </View>
              )}
            </View>
            <Text style={[styles.addrDetail, { color: theme.textSecondary }]}>
              {item.street}, {item.city}{item.county ? `, ${item.county}` : ""}
              {item.postalCode ? ` ${item.postalCode}` : ""}
            </Text>
            <Text style={[styles.addrPhone, { color: theme.textMuted }]}>{item.phone}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => handleEdit(item)}>
                <Text style={[styles.actionText, { color: theme.primary }]}>Edit</Text>
              </TouchableOpacity>
              {!item.isDefault && (
                <TouchableOpacity onPress={() => handleSetDefault(item.id)}>
                  <Text style={[styles.actionText, { color: theme.info }]}>Set Default</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={[styles.actionText, { color: theme.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="location-outline" title="No Addresses" message="Add a shipping address to get started." />
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => {
          setForm({ name: "", phone: "", street: "", city: "", county: "", postalCode: "" });
          setEditingId(null);
          setShowForm(true);
        }}
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
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xs },
  addrName: { fontSize: FontSize.base, fontWeight: "600" },
  defaultBadge: { borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  defaultText: { fontSize: FontSize.xs, fontWeight: "700" },
  addrDetail: { fontSize: FontSize.md, lineHeight: 20 },
  addrPhone: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  cardActions: { flexDirection: "row", gap: Spacing.lg, marginTop: Spacing.md },
  actionText: { fontSize: FontSize.md, fontWeight: "600" },
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
  fieldGroup: { marginBottom: Spacing.lg },
  fieldLabel: { fontSize: FontSize.md, fontWeight: "600", marginBottom: Spacing.sm },
  fieldInput: {
    borderWidth: 1, borderRadius: BorderRadius.lg,
    padding: Spacing.md, fontSize: FontSize.base,
  },
  saveBtn: {
    paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg,
    alignItems: "center", marginTop: Spacing.md, marginBottom: Spacing.xxxl,
  },
  saveBtnText: { color: "#FFF", fontSize: FontSize.lg, fontWeight: "700" },
});
