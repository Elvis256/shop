import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, profile, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      Alert.alert("Success", "Profile updated successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>
              {(name || user?.email || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.email, { color: theme.textSecondary }]}>{user?.email}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Name</Text>
            <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Ionicons name="person-outline" size={20} color={theme.textMuted} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Phone</Text>
            <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Ionicons name="call-outline" size={20} color={theme.textMuted} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 254712345678"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.primary }, loading && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveBtnText}>{loading ? "Saving..." : "Save Changes"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.xxl },
  avatarSection: { alignItems: "center", marginBottom: Spacing.xxl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center", marginBottom: Spacing.sm,
  },
  avatarText: { color: "#FFF", fontSize: FontSize.xxxl, fontWeight: "700" },
  email: { fontSize: FontSize.md },
  form: { gap: Spacing.lg },
  inputGroup: { gap: Spacing.sm },
  label: { fontSize: FontSize.md, fontWeight: "600" },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, gap: Spacing.sm,
  },
  input: { flex: 1, fontSize: FontSize.base, paddingVertical: Spacing.md },
  saveBtn: {
    paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: "center", marginTop: Spacing.md,
  },
  saveBtnText: { color: "#FFF", fontSize: FontSize.lg, fontWeight: "700" },
});
