import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar as RNStatusBar,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import {
  Contact,
  findUserByPhone,
  getAllUsersFromFirestore,
  getSavedUserContactsFromFirestore,
} from '../services/firestoreService';
import { ContactService, normalizePhoneNumber } from '../services/ContactService';
import { SmartImage } from '../components/SmartImage';
import { M3SearchBar } from '../components/M3SearchBar';
import { useNavigation } from '@react-navigation/native';

interface SyncContact extends Contact {
  isRegistered?: boolean;
  isAdded?: boolean;
  platformData?: any;
}

/**
 * Contact Sync Screen - Senior Engineering Implementation
 * Features: Permission handling, normalization, Platform matching, and performance optimization.
 */
export default function ContactSyncScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const currentUser = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceContacts, setDeviceContacts] = useState<SyncContact[]>([]);
  const [matchedProfiles, setMatchedProfiles] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      // 1. Fetch device contacts
      const rawContacts = await ContactService.getDeviceContacts();

      // 2. Fetch all platform users & user's existing contacts
      const [allUsers, existingContacts] = await Promise.all([
        getAllUsersFromFirestore(),
        currentUser?.uid ? getSavedUserContactsFromFirestore(currentUser.uid) : Promise.resolve([]),
      ]);

      const existingPhoneSet = new Set(existingContacts.map(c => c.phone));

      // 3. Deduplicate by phone number and mark if already added
      const uniqueMap = new Map<string, SyncContact>();
      rawContacts.forEach(c => {
        if (!uniqueMap.has(c.phone)) {
          uniqueMap.set(c.phone, {
            ...c,
            isAdded: existingPhoneSet.has(c.phone)
          });
        }
      });
      const contacts = Array.from(uniqueMap.values());

      // 4. Create platform map for instant matching
      const platformMap: Record<string, UserProfile> = {};
      allUsers.forEach(u => {
        if (u.mobile) {
          const clean = normalizePhoneNumber(u.mobile);
          if (clean) platformMap[clean] = u;
        }
      });

      setMatchedProfiles(platformMap);
      setDeviceContacts(contacts);
    } catch (e: any) {
      if (e.message === 'Permission denied') {
        // Handled in service alert
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (item: SyncContact) => {
    if (!currentUser?.uid) return;
    try {
      const { success } = await ContactService.addContact(item.name, item.phone);
      if (success) {
        setDeviceContacts(prev => prev.map(c => c.phone === item.phone ? { ...c, isAdded: true } : c));
        Alert.alert('Success', `${item.name} is now in your contacts.`);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to add contact');
    }
  };

  const handleInvite = (item: SyncContact) => {
    ContactService.inviteContact(item.phone, item.name);
  };

  const filteredContacts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    // Initial filtering by search query
    let list = query
      ? deviceContacts.filter(c =>
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query)
        )
      : [...deviceContacts];

    // Sort:
    // 1. Already Added (Green Check)
    // 2. On Platform but not added (+Add)
    // 3. Not on platform (Invite)
    // 4. Alphabetical within tiers
    return list.sort((a, b) => {
      const getPriority = (contact: SyncContact) => {
        if (contact.isAdded) return 2;
        if (matchedProfiles[contact.phone]) return 1;
        return 0;
      };

      const pA = getPriority(a);
      const pB = getPriority(b);

      if (pA !== pB) return pB - pA; // Higher priority first
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [deviceContacts, searchQuery, matchedProfiles]);

  const renderItem = useCallback(({ item }: { item: SyncContact }) => {
    const platformUser = matchedProfiles[item.phone];
    const isOnPlatform = !!platformUser;

    // Priority Logic:
    // 1. Platform Photo (from Firestore profile)
    // 2. Device Photo (from phonebook sync)
    // 3. Initials (handled automatically by SmartImage)
    const priorityPhoto = platformUser?.photoUrl || (platformUser as any)?.photoURL || item.photoUrl;

    return (
      <View style={[styles.contactCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
        <SmartImage uri={priorityPhoto} name={platformUser?.name || item.name} size={48} style={{ borderRadius: 24 }} />

        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: colors.onSurface }]} numberOfLines={1}>
            {platformUser?.name || item.name || item.phone}
          </Text>
          <Text style={[styles.contactSub, { color: colors.onSurfaceVariant }]}>{item.phone}</Text>
          {isOnPlatform && (
            <View style={[styles.platformBadge, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.platformBadgeText, { color: colors.primary }]}>SplitMate</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {item.isAdded ? (
            <View style={styles.addedState}>
              <MaterialIcons name="check-circle" size={24} color={colors.primary} />
            </View>
          ) : isOnPlatform ? (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleAdd(item)}
            >
              <MaterialIcons name="add" size={20} color={colors.onPrimary} />
              <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>Add</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.inviteBtn, { borderColor: colors.primary }]}
              onPress={() => handleInvite(item)}
            >
              <Text style={[styles.inviteBtnText, { color: colors.primary }]}>Invite</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [colors, matchedProfiles]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Add Friends</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.searchContainer}>
        <M3SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search name or phone..."
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>Syncing phonebook...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => `sync_${item.phone}`}
          renderItem={renderItem}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="person-search" size={64} color={colors.outlineVariant} />
              <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                {searchQuery ? 'No contacts match your search' : 'No contacts found in phonebook'}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.titleLg, fontWeight: '700' },
  searchContainer: { paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  list: { padding: Spacing.md, paddingBottom: 40 },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: 12,
    marginBottom: Spacing.sm,
    ...Shadows.card
  },
  contactInfo: { flex: 1 },
  contactName: { ...Typography.titleSm, fontWeight: '700' },
  contactSub: { ...Typography.bodySm, opacity: 0.6, marginTop: 2 },
  platformBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  platformBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  actions: { minWidth: 80, alignItems: 'flex-end' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md, gap: 4 },
  addBtnText: { ...Typography.labelLg, fontWeight: '700' },
  inviteBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1 },
  inviteBtnText: { ...Typography.labelLg, fontWeight: '700' },
  addedState: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { ...Typography.bodyMd },
  empty: { marginTop: 100, alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', marginTop: 16, lineHeight: 22 },
});
