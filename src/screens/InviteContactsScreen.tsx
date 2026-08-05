import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { getAllUsersFromFirestore, UserProfile } from '../services/firestoreService';
import { useNavigation } from '@react-navigation/native';

interface ContactItem {
  id: string;
  name: string;
  phoneNumber: string;
  rawNumber: string;
  imageUri?: string;
  isOnboarded: boolean;
  onboardedUser?: UserProfile;
}

export default function InviteContactsScreen() {
  const navigation = useNavigation();
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    loadContactsAndOnboardedStatus();
  }, []);

  const normalizePhone = (num: string) => {
    return num.replace(/[^0-9]/g, '').slice(-10);
  };

  const loadContactsAndOnboardedStatus = async () => {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionGranted(false);
        setLoading(false);
        return;
      }
      setPermissionGranted(true);

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Image],
      });

      const onboardedUsers = await getAllUsersFromFirestore();
      const onboardedPhoneMap = new Map<string, UserProfile>();
      onboardedUsers.forEach((user) => {
        if (user.mobile) {
          const norm = normalizePhone(user.mobile);
          if (norm) onboardedPhoneMap.set(norm, user);
        }
      });

      const parsedContacts: ContactItem[] = [];
      data.forEach((c) => {
        if (c.phoneNumbers && c.phoneNumbers.length > 0) {
          const phoneObj = c.phoneNumbers[0];
          const rawNum = phoneObj.number || '';
          const norm = normalizePhone(rawNum);
          const onboardedUser = norm ? onboardedPhoneMap.get(norm) : undefined;
          const imageUri = c.imageAvailable && c.image?.uri ? c.image.uri : undefined;

          parsedContacts.push({
            id: c.id || Math.random().toString(),
            name: c.name || 'Unknown Contact',
            phoneNumber: rawNum,
            rawNumber: norm,
            imageUri: imageUri || onboardedUser?.photoUrl,
            isOnboarded: !!onboardedUser,
            onboardedUser: onboardedUser,
          });
        }
      });

      // Sort onboarded users first, then alphabetically
      parsedContacts.sort((a, b) => {
        if (a.isOnboarded && !b.isOnboarded) return -1;
        if (!a.isOnboarded && b.isOnboarded) return 1;
        return a.name.localeCompare(b.name);
      });

      setContacts(parsedContacts);
      setFilteredContacts(parsedContacts);
    } catch (e: any) {
      console.log('Error loading contacts:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredContacts(contacts);
      return;
    }
    const lower = query.toLowerCase();
    const filtered = contacts.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.phoneNumber.includes(lower)
    );
    setFilteredContacts(filtered);
  };

  const handleInvite = async (contact: ContactItem) => {
    try {
      await Share.share({
        message: `Hey ${contact.name}! Join me on SplitMate to track & split expenses effortlessly: https://splitmate.app/download`,
      });
    } catch (error: any) {
      Alert.alert('Share Failed', error.message || 'Unable to share invite link.');
    }
  };

  const handleAddContact = (contact: ContactItem) => {
    Alert.alert('Add Friend', `${contact.name} is on SplitMate! Added to your SplitMate contacts.`);
  };

  const renderContactItem = ({ item }: { item: ContactItem }) => {
    const avatarLetter = item.name.charAt(0).toUpperCase();

    return (
      <View style={styles.contactCard}>
        <View style={[styles.avatarCircle, item.isOnboarded && styles.avatarCircleOnboarded]}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.contactAvatarImg} />
          ) : (
            <Text style={[styles.avatarText, item.isOnboarded && styles.avatarTextOnboarded]}>
              {avatarLetter}
            </Text>
          )}
        </View>

        <View style={styles.contactInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
            {item.isOnboarded && (
              <View style={styles.onboardedBadge}>
                <Text style={styles.onboardedBadgeText}>On SplitMate</Text>
              </View>
            )}
          </View>
          <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
        </View>

        {item.isOnboarded ? (
          <TouchableOpacity
            style={styles.addIconCircle}
            onPress={() => handleAddContact(item)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add" size={22} color={Colors.onPrimary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => handleInvite(item)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="send" size={14} color={Colors.primary} />
            <Text style={styles.inviteButtonText}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  return (
    <SafeAreaView style={styles.container}>
      <RNStatusBar backgroundColor={Colors.background} barStyle="dark-content" translucent />
      <View style={[styles.topHeader, { paddingTop: topPadding }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onBackground} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>All Contacts</Text>
          <Text style={styles.headerSubtitle}>Invite friends or add them to SplitMate</Text>
        </View>
      </View>

      {/* Search Bar */}
      {permissionGranted && contacts.length > 0 && (
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={22} color={Colors.outline} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor={Colors.outline}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <MaterialIcons name="close" size={20} color={Colors.outline} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      ) : !permissionGranted ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="contacts" size={64} color={Colors.primary} />
          <Text style={styles.emptyTitle}>Contacts Permission Required</Text>
          <Text style={styles.emptySub}>Grant access to invite friends directly from your phone contacts.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadContactsAndOnboardedStatus}>
            <Text style={styles.retryBtnText}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContactItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No contacts found</Text>
              <Text style={styles.emptySub}>Try searching for another name or number.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: { flex: 1 },
  headerTitle: { ...Typography.headlineLgMobile, color: Colors.onBackground, fontWeight: '700' },
  headerSubtitle: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    marginHorizontal: Spacing.containerMargin,
    marginVertical: Spacing.sm,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: 10,
    ...Shadows.card,
  },
  searchInput: { flex: 1, ...Typography.bodyLg, color: Colors.onSurface },
  listContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xs,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    marginVertical: 4,
    gap: 12,
    ...Shadows.card,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleOnboarded: { backgroundColor: Colors.primaryContainer },
  avatarText: { ...Typography.titleMd, color: Colors.onSurfaceVariant, fontWeight: '600' },
  avatarTextOnboarded: { color: Colors.onPrimaryContainer },
  contactInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactName: { ...Typography.titleSm, color: Colors.onSurface, fontWeight: '600', maxWidth: 160 },
  onboardedBadge: {
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  onboardedBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: '700' },
  contactPhone: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: 2 },
  addIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  inviteButtonText: { ...Typography.titleSm, color: Colors.primary, fontWeight: '600' },
  contactAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  loadingText: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: Spacing.md },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl },
  emptyTitle: { ...Typography.titleLg, color: Colors.onSurface, fontWeight: '600', marginTop: Spacing.md },
  emptySub: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, textAlign: 'center', marginTop: Spacing.xs },
  retryBtn: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: BorderRadius.md, marginTop: Spacing.lg },
  retryBtnText: { ...Typography.titleSm, color: Colors.onPrimary, fontWeight: '600' },
});
