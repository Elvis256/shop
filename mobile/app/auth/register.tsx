import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters.");
      return;
    }
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{}|;:,.<>])/;
    if (!strongPasswordRegex.test(password)) {
      Alert.alert("Error", "Password must contain uppercase, lowercase, number, and special character.");
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password, name.trim() || undefined);
      Alert.alert("Success", "Account created successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Registration Failed", err.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: theme.surface }]}>
            <Ionicons name="person-add" size={40} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Sign up to start shopping
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Name (optional)</Text>
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
            <Text style={[styles.label, { color: theme.text }]}>Email *</Text>
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
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Password *</Text>
            <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Ionicons name="key-outline" size={20} color={theme.textMuted} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Strong password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={theme.textMuted}
                />
              </TouchableOpacity>
            </View>
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Min 8 chars with uppercase, lowercase, number, and special character
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Confirm Password *</Text>
            <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Ionicons name="key-outline" size={20} color={theme.textMuted} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPassword}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.registerBtn, { backgroundColor: theme.primary }, loading && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.registerBtnText}>
              {loading ? "Creating account..." : "Create Account"}
            </Text>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={[styles.loginText, { color: theme.textSecondary }]}>
              Already have an account?
            </Text>
            <Link href="/auth/login" asChild>
              <TouchableOpacity>
                <Text style={[styles.loginLink, { color: theme.primary }]}> Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: Spacing.xxl },
  header: { alignItems: "center", marginBottom: Spacing.xxl },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSize.xxl, fontWeight: "700", marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.md },
  form: { gap: Spacing.lg },
  inputGroup: { gap: Spacing.sm },
  label: { fontSize: FontSize.md, fontWeight: "600" },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, gap: Spacing.sm,
  },
  input: { flex: 1, fontSize: FontSize.base, paddingVertical: Spacing.md },
  hint: { fontSize: FontSize.xs },
  registerBtn: {
    paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: "center",
  },
  registerBtnText: { color: "#FFF", fontSize: FontSize.lg, fontWeight: "700" },
  loginRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  loginText: { fontSize: FontSize.md },
  loginLink: { fontSize: FontSize.md, fontWeight: "700" },
});
