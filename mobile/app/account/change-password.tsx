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

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert("Success", "Password changed successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to change password.");
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
        {[
          { label: "Current Password", value: currentPassword, setter: setCurrentPassword, placeholder: "Enter current password" },
          { label: "New Password", value: newPassword, setter: setNewPassword, placeholder: "Enter new password" },
          { label: "Confirm New Password", value: confirmPassword, setter: setConfirmPassword, placeholder: "Repeat new password" },
        ].map((field) => (
          <View key={field.label} style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>{field.label}</Text>
            <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Ionicons name="key-outline" size={20} color={theme.textMuted} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.placeholder}
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPasswords}
              />
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.showRow} onPress={() => setShowPasswords(!showPasswords)}>
          <Ionicons
            name={showPasswords ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={theme.textMuted}
          />
          <Text style={[styles.showText, { color: theme.textMuted }]}>
            {showPasswords ? "Hide passwords" : "Show passwords"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: theme.primary }, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.saveBtnText}>{loading ? "Changing..." : "Change Password"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.xxl, gap: Spacing.lg },
  inputGroup: { gap: Spacing.sm },
  label: { fontSize: FontSize.md, fontWeight: "600" },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, gap: Spacing.sm,
  },
  input: { flex: 1, fontSize: FontSize.base, paddingVertical: Spacing.md },
  showRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  showText: { fontSize: FontSize.md },
  saveBtn: {
    paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg,
    alignItems: "center", marginTop: Spacing.md,
  },
  saveBtnText: { color: "#FFF", fontSize: FontSize.lg, fontWeight: "700" },
});
