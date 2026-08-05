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
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import { getAllUsersFromFirestore, addContactToUserFirestore, getSavedUserContactsFromFirestore, UserProfile } from '../services/firestoreService';
import { useNavigation } from '@react-navigation/native';

interface ContactItem {
  id: string;
  name: string;
  phoneNumber: string;
  rawNumber: string;
  imageUri?: string;
  isOnboarded: boolean;
  onboardedUser?: UserProfile;
  isAdded?: boolean;
}

export default function InviteContactsScreen() {
  const navigation = useNavigation();
  const currentUser = auth.currentUser;
  const { colors, isDark } = useTheme();

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
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
      });

      const registeredUsers = await getAllUsersFromFirestore();
      const registeredPhoneMap = new Map<string, UserProfile>();
      registeredUsers.forEach((user) => {
        if (user.phoneNumber) {
          const norm = normalizePhone(user.phoneNumber);
          if (norm.length === 10) registeredPhoneMap.set(norm, user);
        }
      });

      let savedContactsUids = new Set<string>();
      if (currentUser?.uid) {
        const saved = await getSavedUserContactsFromFirestore(currentUser.uid);
        saved.forEach((c) => savedContactsUids.add(c.uid));
      }

      const parsed: ContactItem[] = [];
      const seenNumbers = new Set<string>();

      if (data) {
        for (const c of data) {
          if (!c.name || !c.phoneNumbers || c.phoneNumbers.length === 0) continue;
          const phone = c.phoneNumbers[0].number || '';
          const norm = normalizePhone(phone);
          if (!norm || norm.length < 10 || seenNumbers.has(norm)) continue;
          seenNumbers.add(norm);

          const onboardedUser = registeredPhoneMap.get(norm);
          const isAdded = onboardedUser ? savedContactsUids.has(onboardedUser.uid) : false;

          parsed.push({
            id: c.id || norm,
            name: c.name,
            phoneNumber: phone,
            rawNumber: norm,
            imageUri: c.imageAvailable && c.image?.uri ? c.image.uri : undefined,
            isOnboarded: !!onboardedUser,
            onboardedUser: onboardedUser,
            isAdded,
          });
        }
      }

      parsed.sort((a, b) => (b.isOnboarded ? 1 : 0) - (a.isOnboarded ? 1 : 0));

      setContacts(parsed);
      setFilteredContacts(parsed);
    } catch (e) {
      console.log('Error fetching contacts:', e);
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
    const q = query.toLowerCase();
    const filtered = contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phoneNumber.includes(q)
    );
    setFilteredContacts(filtered);
  };

  const handleAddContact = async (item: ContactItem) => {
    if (!currentUser?.uid || !item.onboardedUser) return;

    try {
      await addContactToUserFirestore(currentUser.uid, item.onboardedUser);
      setContacts((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, isAdded: true } : c))
      );
      setFilteredContacts((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, isAdded: true } : c))
      );
    } catch (e) {
      console.log('Error adding contact:', e);
    }
  };

  const handleInvite = async (item: ContactItem) => {
    try {
      const shareMessage = `Hey ${item.name}! Join me on SplitMate to easily split bills & track group expenses. Download the app today: https://splitmate.app/invite`;
      await Share.share({
        message: shareMessage,
        title: 'Invite to SplitMate',
      });
    } catch (error) {
      console.log('Error sharing invite:', error);
    }
  };

  const renderItem = ({ item }: { item: ContactItem }) => {
    const avatarLetter = item.name.charAt(0).toUpperCase();

    return (
      <View style={[styles.contactCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
        <View style={{ position: 'relative' }}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.contactAvatarImg} />
          ) : (
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: item.isOnboarded ? colors.primaryContainer : colors.surfaceContainerHighest },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: item.isOnboarded ? colors.onPrimaryContainer : colors.onSurfaceVariant },
                ]}
              >
                {avatarLetter}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.contactInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.contactName, { color: colors.onSurface }]} numberOfLines={1}>{item.name}</Text>
            {item.isOnboarded && (
              <View style={[styles.onboardedBadge, { backgroundColor: colors.primaryFixed }]}>
                <Text style={[styles.onboardedBadgeText, { color: colors.primary }]}>On SplitMate</Text>
              </View>
            )}
          </View>
          <Text style={[styles.contactPhone, { color: colors.onSurfaceVariant }]}>{item.phoneNumber}</Text>
        </View>

        {item.isOnboarded ? (
          item.isAdded ? (
            <View style={[styles.addIconCircle, { backgroundColor: colors.positive }]}>
              <MaterialIcons name="check" size={20} color={colors.onPrimary} />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addIconCircle, { backgroundColor: colors.primary }]}
              onPress={() => handleAddContact(item)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add" size={22} color={colors.onPrimary} />
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity
            style={[styles.inviteButton, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.primary }]}
            onPress={() => handleInvite(item)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="send" size={14} color={colors.primary} />
            <Text style={[styles.inviteButtonText, { color: colors.primary }]}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />
      <View style={[styles.topHeader, { paddingTop: topPadding }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerTitle, { color: colors.onBackground }]}>All Contacts</Text>
          <Text style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>Invite friends or add them to SplitMate</Text>
        </View>
      </View>

      {/* Search Bar */}
      {permissionGranted && contacts.length > 0 && (
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
          <MaterialIcons name="search" size={22} color={colors.outline} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder="Search contacts..."
            placeholderTextColor={colors.outline}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <MaterialIcons name="close" size={20} color={colors.outline} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>Loading contacts...</Text>
        </View>
      ) : !permissionGranted ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="contacts" size={64} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Permission Required</Text>
          <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
            Please grant contacts permission to invite and add friends on SplitMate.
          </Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={loadContactsAndOnboardedStatus}>
            <Text style={[styles.retryBtnText, { color: colors.onPrimary }]}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      ) : filteredContacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No contacts found</Text>
          <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>Try searching with a different name or number.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitleBox: { flex: 1 },
  headerTitle: { ...Typography.headlineLgMobile, fontWeight: '700' },
  headerSubtitle: { ...Typography.bodyMd, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.containerMargin,
    marginVertical: Spacing.sm,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 10,
    ...Shadows.card,
  },
  searchInput: { flex: 1, ...Typography.bodyLg },
  listContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xs,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginVertical: 4,
    gap: 12,
    ...Shadows.card,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleOnboarded: {},
  avatarText: { ...Typography.titleMd, fontWeight: '600' },
  avatarTextOnboarded: {},
  contactInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactName: { ...Typography.titleSm, fontWeight: '600', maxWidth: 160 },
  onboardedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  onboardedBadgeText: { fontSize: 10, fontWeight: '700' },
  contactPhone: { ...Typography.bodyMd, marginTop: 2 },
  addIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  inviteButtonText: { ...Typography.titleSm, fontWeight: '600' },
  contactAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  loadingText: { ...Typography.bodyMd, marginTop: Spacing.md },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl },
  emptyTitle: { ...Typography.titleLg, fontWeight: '600', marginTop: Spacing.md },
  emptySub: { ...Typography.bodyMd, textAlign: 'center', marginTop: Spacing.xs },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: BorderRadius.md, marginTop: Spacing.lg },
  retryBtnText: { ...Typography.titleSm, fontWeight: '600' },
});
