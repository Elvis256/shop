import React from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useTheme } from "@/lib/hooks";
import { FontSize, Spacing } from "@/constants/theme";

interface Props {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ message, fullScreen = true }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={theme.primary} />
      {message && (
        <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  fullScreen: {
    flex: 1,
  },
  message: {
    fontSize: FontSize.md,
  },
});
