import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StatusBar as RNStatusBar,
  Alert,
  Modal,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import {
  Contact,
  addContactToUserFirestore,
  removeContactFromUserFirestore,
  subscribeToUserContacts,
  findUserByPhone,
  UserProfile,
} from '../services/firestoreService';
import { SmartImage } from '../components/SmartImage';
import { OutlinedInput } from '../components/OutlinedInput';

export default function ContactsScreen() {
  const { colors, isDark } = useTheme();
  const currentUser = auth.currentUser;

  const [myContacts, setMyContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Manual Add Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [addingManual, setAddingManual] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToUserContacts(currentUser.uid, (contacts) => {
      setMyContacts(contacts.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  const handleSyncContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please enable contacts permission in settings to sync your phonebook.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });

      if (data.length > 0) {
        let count = 0;
        for (const c of data) {
          if (c.phoneNumbers && c.phoneNumbers.length > 0) {
            const phone = c.phoneNumbers[0].number || '';
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.length >= 10) {
              await addContactToUserFirestore(currentUser!.uid, {
                name: c.name,
                phone: phone,
                email: c.emails?.[0]?.email,
              });
              count++;
            }
          }
        }
        Alert.alert('Sync Complete', `Successfully imported ${count} contacts.`);
      }
    } catch (e) {
      console.error('Sync error:', e);
      Alert.alert('Error', 'Failed to sync contacts.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddManual = async () => {
    if (!manualName || !manualPhone) {
      Alert.alert('Error', 'Please fill in both name and phone number.');
      return;
    }

    setAddingManual(true);
    try {
      // Try to see if this user exists on SplitMate
      const existingUser = await findUserByPhone(manualPhone);

      await addContactToUserFirestore(currentUser!.uid, {
        name: manualName,
        phone: manualPhone,
        uid: existingUser?.uid,
        photoUrl: existingUser?.photoUrl,
      });

      setModalVisible(false);
      setManualName('');
      setManualPhone('');
      Alert.alert('Success', 'Contact added successfully.');
    } catch (e) {
      Alert.alert('Error', 'Failed to add contact.');
    } finally {
      setAddingManual(false);
    }
  };

  const handleRemoveContact = (contact: Contact) => {
    Alert.alert('Remove Contact', `Are you sure you want to remove ${contact.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeContactFromUserFirestore(currentUser!.uid, contact.phone) },
    ]);
  };

  const handleInvite = (contact: Contact) => {
    const msg = `Hey ${contact.name}! Join me on SplitMate to easily split bills. Download: https://splitmate.app`;
    const url = `sms:${contact.phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(msg)}`;
    Linking.openURL(url);
  };

  const filteredContacts = myContacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const renderContact = ({ item }: { item: Contact }) => (
    <View style={[styles.contactCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
      <SmartImage uri={item.photoUrl} name={item.name} size={48} style={{ borderRadius: 24 }} />
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: colors.onSurface }]}>{item.name}</Text>
        <Text style={[styles.contactSub, { color: colors.onSurfaceVariant }]}>{item.phone}</Text>
        {item.uid && (
          <View style={[styles.badge, { backgroundColor: colors.primaryContainer }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>On SplitMate</Text>
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {!item.uid && (
          <TouchableOpacity onPress={() => handleInvite(item)} style={styles.inviteBtn}>
            <Text style={[styles.inviteBtnText, { color: colors.primary }]}>Invite</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => handleRemoveContact(item)} style={styles.moreBtn}>
          <MaterialIcons name="delete-outline" size={20} color={colors.outline} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Contacts</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surfaceContainerHigh }]}
            onPress={handleSyncContacts}
          >
            <MaterialIcons name="sync" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => setModalVisible(true)}
          >
            <MaterialIcons name="add" size={20} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
        <MaterialIcons name="search" size={22} color={colors.outline} />
        <TextInput
          style={[styles.searchInput, { color: colors.onSurface }]}
          placeholder="Search contacts..."
          placeholderTextColor={colors.outline}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.phone}
          renderItem={renderContact}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="contacts" size={64} color={colors.outlineVariant} />
              <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                {searchQuery ? 'No matching contacts' : 'No contacts added yet. Sync your phonebook or add manually!'}
              </Text>
            </View>
          }
        />
      )}

      {/* Manual Add Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onBackground }]}>Add Contact</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <OutlinedInput
                label="Full Name"
                value={manualName}
                onChangeText={setManualName}
                placeholder="e.g. John Doe"
              />
              <OutlinedInput
                label="Phone Number"
                value={manualPhone}
                onChangeText={setManualPhone}
                keyboardType="phone-pad"
                placeholder="e.g. +91 9876543210"
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddManual}
                disabled={addingManual}
              >
                {addingManual ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>Add Contact</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  headerTitle: { ...Typography.headlineSm, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', ...Shadows.button },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, paddingHorizontal: 12, height: 48, borderRadius: BorderRadius.lg, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, ...Typography.bodyLg },
  list: { padding: Spacing.md, paddingBottom: 100 },
  contactCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1, gap: 12, marginBottom: Spacing.sm },
  contactInfo: { flex: 1 },
  contactName: { ...Typography.titleSm, fontWeight: '700' },
  contactSub: { ...Typography.bodySm, opacity: 0.7 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inviteBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'transparent' },
  inviteBtnText: { ...Typography.labelMd, fontWeight: '700' },
  moreBtn: { padding: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { marginTop: 80, alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', marginTop: 16, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, padding: Spacing.lg, minHeight: '50%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  modalTitle: { ...Typography.titleLg, fontWeight: '700' },
  modalBody: { gap: Spacing.md },
  saveBtn: { height: 52, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg },
  saveBtnText: { ...Typography.titleMd, fontWeight: '700' },
});
