import React, {useState} from 'react';
import {View, TextInput, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Spacing, Radius} from '../lib/theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}

export default function SearchBar({value, onChangeText, onSubmit, placeholder}: Props) {
  return (
    <View style={styles.container}>
      <Icon name="search" size={20} color={Colors.textMuted} style={styles.icon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder || 'Search products...'}
        placeholderTextColor={Colors.textMuted}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearBtn}>
          <Icon name="close-circle" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  icon: {marginRight: Spacing.sm},
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 0,
  },
  clearBtn: {marginLeft: Spacing.sm},
});
