import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.iconCircle, { backgroundColor: theme.surface }]}>
          <Ionicons name="mail" size={48} color={theme.success} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Check Your Email</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          We've sent a password reset link to {email}. Please check your inbox and follow the instructions.
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.btnText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.iconCircle, { backgroundColor: theme.surface }]}>
          <Ionicons name="key" size={48} color={theme.primary} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Forgot Password?</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Enter your email address and we'll send you a link to reset your password.
        </Text>

        <View style={styles.form}>
          <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Ionicons name="mail-outline" size={20} color={theme.textMuted} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.primary }, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.btnText}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, padding: Spacing.xxl, justifyContent: "center", alignItems: "center",
  },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: "center", justifyContent: "center", marginBottom: Spacing.xxl,
  },
  title: { fontSize: FontSize.xxl, fontWeight: "700", marginBottom: Spacing.md, textAlign: "center" },
  subtitle: {
    fontSize: FontSize.md, textAlign: "center", lineHeight: 22, marginBottom: Spacing.xxl, maxWidth: 300,
  },
  form: { width: "100%", gap: Spacing.lg },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, gap: Spacing.sm,
  },
  input: { flex: 1, fontSize: FontSize.base, paddingVertical: Spacing.md },
  btn: { paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: "center" },
  btnText: { color: "#FFF", fontSize: FontSize.lg, fontWeight: "700" },
});
