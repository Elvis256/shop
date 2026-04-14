import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";

interface Props {
  onVerified: () => void;
}

export default function AgeGate({ onVerified }: Props) {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: theme.surface }]}>
          <Ionicons name="shield-checkmark" size={64} color={theme.primary} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Age Verification</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          You must be 18 years or older to access this store. By entering, you confirm that you meet the legal age requirement.
        </Text>

        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
          onPress={onVerified}
        >
          <Text style={styles.confirmText}>I am 18 or older — Enter</Text>
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy. This site contains adult content.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: Spacing.xxxl,
    alignItems: "center",
    maxWidth: 400,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.base,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: Spacing.xxxl,
  },
  confirmBtn: {
    width: "100%",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  confirmText: {
    color: "#FFF",
    fontSize: FontSize.lg,
    fontWeight: "700",
  },
  disclaimer: {
    fontSize: FontSize.xs,
    textAlign: "center",
    lineHeight: 18,
  },
});
