import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Share,
  Alert,
  StatusBar as RNStatusBar,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import {
  searchUsersByContact,
  sendFriendRequest,
  getSavedUserContactsFromFirestore,
  UserProfile
} from '../services/firestoreService';
import { useNavigation } from '@react-navigation/native';
import { SmartImage } from '../components/SmartImage';

interface ContactItem {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  isOnboarded: boolean;
  onboardedUser?: UserProfile;
  requestSent?: boolean;
}

export default function InviteContactsScreen() {
  const navigation = useNavigation();
  const currentUser = auth.currentUser;
  const { colors, isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContactItem[]>([]);
  const [localContacts, setLocalContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<Contacts.PermissionStatus | null>(null);

  useEffect(() => {
    checkPermissionAndLoad();
  }, []);

  const checkPermissionAndLoad = async () => {
    const { status } = await Contacts.getPermissionsAsync();
    setPermissionStatus(status);
    if (status === 'granted') {
      loadLocalContacts();
    }
  };

  const requestPermission = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    setPermissionStatus(status);
    if (status === 'granted') {
      loadLocalContacts();
    }
  };

  const loadLocalContacts = async () => {
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });
      if (data) {
        const parsed = data.map(c => ({
          id: c.id,
          name: c.name,
          phoneNumber: c.phoneNumbers?.[0]?.number,
          email: c.emails?.[0]?.email,
          isOnboarded: false
        }));
        setLocalContacts(parsed);
      }
    } catch (e) {
      console.log('Error loading local contacts:', e);
    }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const users = await searchUsersByContact(text);
      const results = users.map(u => ({
        id: u.uid,
        name: u.name,
        email: u.email,
        phoneNumber: u.mobile,
        isOnboarded: true,
        onboardedUser: u
      }));
      setSearchResults(results);
    } catch (e) {
      console.log('Search error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (item: ContactItem) => {
    if (!item.onboardedUser) return;
    try {
      await sendFriendRequest(item.onboardedUser.uid);
      setSearchResults(prev => prev.map(r => r.id === item.id ? { ...r, requestSent: true } : r));
      Alert.alert('Request Sent', `Friend request sent to ${item.name}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send request');
    }
  };

  const handleInviteSMS = (item: ContactItem) => {
    if (!item.phoneNumber) return;
    const msg = `Hey ${item.name}! Join me on SplitMate to easily split bills. Download: https://splitmate.app`;
    const url = `sms:${item.phoneNumber}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(msg)}`;
    Linking.openURL(url);
  };

  const handleInviteWhatsApp = (item: ContactItem) => {
    if (!item.phoneNumber) return;
    const msg = `Hey ${item.name}! Join me on SplitMate to easily split bills. Download: https://splitmate.app`;
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}&phone=${item.phoneNumber.replace(/[^0-9]/g, '')}`;
    Linking.canOpenURL(url).then(can => {
      if (can) Linking.openURL(url);
      else Alert.alert('WhatsApp not installed');
    });
  };

  const renderItem = ({ item }: { item: ContactItem }) => (
    <View style={[styles.contactCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
      <SmartImage
        uri={item.onboardedUser?.photoUrl}
        thumbnailUri={item.onboardedUser?.photoThumbnailUrl}
        name={item.name}
        size={48}
        style={{ borderRadius: 24 }}
      />
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: colors.onSurface }]}>{item.name}</Text>
        <Text style={[styles.contactSub, { color: colors.onSurfaceVariant }]}>{item.email || item.phoneNumber || 'Contact'}</Text>
      </View>
      <View style={styles.actions}>
        {item.isOnboarded ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: item.requestSent ? colors.surfaceContainerLow : colors.primary }]}
            onPress={() => !item.requestSent && handleSendRequest(item)}
            disabled={item.requestSent}
          >
            <Text style={[styles.actionBtnText, { color: item.requestSent ? colors.onSurfaceVariant : colors.onPrimary }]}>
              {item.requestSent ? 'Pending' : 'Add Friend'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.inviteRow}>
            <TouchableOpacity onPress={() => handleInviteWhatsApp(item)} style={styles.inviteIcon}>
              <FontAwesome name="whatsapp" size={20} color="#25D366" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleInviteSMS(item)} style={styles.inviteIcon}>
              <MaterialIcons name="sms" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const displayData = searchQuery.length >= 3 ? searchResults : (searchQuery.length > 0 ? localContacts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())) : localContacts);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Invite Friends</Text>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
        <MaterialIcons name="search" size={22} color={colors.outline} />
        <TextInput
          style={[styles.searchInput, { color: colors.onSurface }]}
          placeholder="Search by name, email or mobile..."
          placeholderTextColor={colors.outline}
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="person-search" size={64} color={colors.outlineVariant} />
              <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                {searchQuery.length < 3 ? 'Start typing to find friends on SplitMate' : 'No users found'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.titleLg, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    paddingHorizontal: 12,
    height: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, ...Typography.bodyLg },
  list: { padding: Spacing.md, gap: Spacing.sm },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: 12,
  },
  contactInfo: { flex: 1 },
  contactName: { ...Typography.titleSm, fontWeight: '700' },
  contactSub: { ...Typography.bodySm, marginTop: 2 },
  actions: { minWidth: 100, alignItems: 'flex-end' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { ...Typography.labelMd, fontWeight: '700' },
  inviteRow: { flexDirection: 'row', gap: 12 },
  inviteIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.03)' },
  empty: { marginTop: 100, alignItems: 'center', gap: 16, paddingHorizontal: 40 },
  emptyText: { ...Typography.bodyMd, textAlign: 'center' }
});
