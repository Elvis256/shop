import React, { useState, useCallback } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/hooks";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";

interface Props {
  initialValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onSearch?: (query: string) => void;
}

export default function SearchBar({ initialValue = "", placeholder, autoFocus, onSearch }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState(initialValue);

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (onSearch) {
      onSearch(trimmed);
    } else {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  }, [query, onSearch, router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Ionicons name="search" size={20} color={theme.textMuted} />
      <TextInput
        style={[styles.input, { color: theme.text }]}
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder || "Search products..."}
        placeholderTextColor={theme.textMuted}
        returnKeyType="search"
        onSubmitEditing={handleSubmit}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {query.length > 0 && (
        <TouchableOpacity onPress={() => setQuery("")}>
          <Ionicons name="close-circle" size={20} color={theme.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    paddingVertical: Spacing.xs,
  },
});
