import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize } from "@/constants/theme";

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
}

export default function EmptyState({ icon = "cube-outline", title, message }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color={theme.textMuted} />
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {message && (
        <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xxxl,
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: "600",
    textAlign: "center",
  },
  message: {
    fontSize: FontSize.md,
    textAlign: "center",
    lineHeight: 22,
  },
});
