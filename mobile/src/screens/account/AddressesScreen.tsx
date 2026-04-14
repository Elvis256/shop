import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts, Spacing, Radius, Shadows} from '../../lib/theme';
import {api} from '../../lib/api';
import type {Address} from '../../lib/types';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

const emptyForm = {name: '', phone: '', street: '', city: '', postalCode: '', isDefault: false};

export default function AddressesScreen({navigation}: any) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      const res = await api.addresses.list();
      setAddresses(res.addresses);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEdit = (addr: Address) => {
    setEditing(addr);
    setForm({
      name: addr.name,
      phone: addr.phone,
      street: addr.street,
      city: addr.city,
      postalCode: addr.postalCode || '',
      isDefault: addr.isDefault || false,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.street.trim() || !form.city.trim()) {
      Alert.alert('Missing Info', 'Please fill in all required fields.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await api.addresses.update(editing.id, form);
        setAddresses(prev => prev.map(a => a.id === editing.id ? res.address : a));
      } else {
        const res = await api.addresses.create(form);
        setAddresses(prev => [...prev, res.address]);
      }
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addr: Address) => {
    Alert.alert('Delete Address', `Delete "${addr.name}" address?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.addresses.delete(addr.id);
            setAddresses(prev => prev.filter(a => a.id !== addr.id));
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Addresses</Text>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Icon name="add" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {addresses.length === 0 ? (
        <View style={{flex: 1}}>
          <EmptyState
            icon="location-outline"
            title="No Addresses"
            message="Add a shipping address to get started."
          />
          <TouchableOpacity style={styles.addFirstBtn} onPress={openAdd}>
            <Text style={styles.addFirstText}>Add Address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({item}) => (
            <View style={styles.addressCard}>
              <View style={{flex: 1}}>
                <View style={styles.nameRow}>
                  <Text style={styles.addressName}>{item.name}</Text>
                  {item.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultText}>Default</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.addressLine}>{item.street}</Text>
                <Text style={styles.addressLine}>{item.city}{item.postalCode ? `, ${item.postalCode}` : ''}</Text>
                <Text style={styles.addressLine}>{item.phone}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
                  <Icon name="create-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                  <Icon name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Form Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Address' : 'New Address'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {renderField('Name *', form.name, (v: string) => setForm({...form, name: v}), 'person-outline')}
              {renderField('Phone *', form.phone, (v: string) => setForm({...form, phone: v}), 'call-outline', 'phone-pad')}
              {renderField('Street *', form.street, (v: string) => setForm({...form, street: v}), 'location-outline')}
              {renderField('City *', form.city, (v: string) => setForm({...form, city: v}), 'business-outline')}
              {renderField('Postal Code', form.postalCode, (v: string) => setForm({...form, postalCode: v}), 'map-outline')}

              <TouchableOpacity
                style={styles.defaultToggle}
                onPress={() => setForm({...form, isDefault: !form.isDefault})}>
                <Icon name={form.isDefault ? 'checkbox' : 'square-outline'} size={22} color={Colors.primary} />
                <Text style={styles.defaultToggleText}>Set as default address</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, saving && {opacity: 0.7}]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}>
                {saving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>{editing ? 'Update Address' : 'Save Address'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function renderField(placeholder: string, value: string, onChange: (v: string) => void, icon: string, keyboard?: any) {
  return (
    <View style={fieldStyles.wrap}>
      <Icon name={icon} size={20} color={Colors.textMuted} />
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboard || 'default'}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, height: 50,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  input: {
    flex: 1, fontSize: Fonts.sizes.base, color: Colors.text, paddingVertical: 0,
  },
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: {
    flex: 1, textAlign: 'center',
    fontSize: Fonts.sizes['2xl'], fontWeight: '700', color: Colors.text,
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  list: {paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl},
  addressCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface, borderRadius: Radius.xxl,
    padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.sm,
  },
  nameRow: {flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4},
  addressName: {fontSize: Fonts.sizes.lg, fontWeight: '600', color: Colors.text},
  defaultBadge: {
    backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm,
    paddingVertical: 2, borderRadius: Radius.sm,
  },
  defaultText: {fontSize: Fonts.sizes.xs, color: Colors.primary, fontWeight: '600'},
  addressLine: {fontSize: Fonts.sizes.md, color: Colors.textMuted, lineHeight: 20},
  actions: {justifyContent: 'center', gap: Spacing.md},
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  addFirstBtn: {
    alignSelf: 'center', backgroundColor: Colors.primary,
    paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: Radius.full,
  },
  addFirstText: {color: Colors.white, fontSize: Fonts.sizes.lg, fontWeight: '600'},
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    padding: Spacing.xxl, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  modalTitle: {fontSize: Fonts.sizes['2xl'], fontWeight: '700', color: Colors.text},
  defaultToggle: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  defaultToggleText: {fontSize: Fonts.sizes.md, color: Colors.text},
  saveBtn: {
    backgroundColor: Colors.primary, paddingVertical: 14,
    borderRadius: Radius.full, alignItems: 'center', marginBottom: Spacing.xxl,
  },
  saveBtnText: {color: Colors.white, fontSize: Fonts.sizes.lg, fontWeight: '600'},
});
