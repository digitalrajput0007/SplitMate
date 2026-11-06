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
import { useDialog } from '../context/DialogContext';
import { auth } from '../config/firebase';
import {
  Contact,
  findUserByPhone,
  getAllUsersFromFirestore,
  getSavedUserContactsFromFirestore,
  subscribeToUserContacts,
  UserProfile,
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
  const dialog = useDialog();
  const navigation = useNavigation();
  const currentUser = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceContacts, setDeviceContacts] = useState<SyncContact[]>([]);
  const [platformUsers, setPlatformUsers] = useState<UserProfile[]>([]);
  const [matchedProfiles, setMatchedProfiles] = useState<Record<string, UserProfile>>({});
  const [existingPhoneSet, setExistingPhoneSet] = useState<Set<string>>(new Set());
  const [existingUidSet, setExistingUidSet] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'phonebook' | 'splitmate'>('phonebook');

  useEffect(() => {
    // Always load platform users for instant searching
    loadPlatformUsers();
  }, []);

  // Real-time listener for current user's saved contacts
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToUserContacts(currentUser.uid, (contacts) => {
      const phones = new Set<string>();
      const uids = new Set<string>();
      contacts.forEach(c => {
        if (c.phone) {
          const norm = normalizePhoneNumber(c.phone);
          phones.add(norm);
          phones.add(c.phone.replace(/[^0-9]/g, ''));
        }
        if (c.uid) uids.add(c.uid);
      });
      setExistingPhoneSet(phones);
      setExistingUidSet(uids);

      // Also mark deviceContacts as added if already synced
      setDeviceContacts(prev => prev.map(dc => {
        const norm = normalizePhoneNumber(dc.phone);
        const isAdded = phones.has(norm) || phones.has(dc.phone.replace(/[^0-9]/g, '')) || (dc.uid ? uids.has(dc.uid) : false);
        return isAdded !== dc.isAdded ? { ...dc, isAdded } : dc;
      }));
    });

    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    // Only load phonebook if on Phonebook tab and not already loaded
    if (activeTab === 'phonebook' && deviceContacts.length === 0) {
      loadPhonebook();
    }
  }, [activeTab]);

  const loadPlatformUsers = async () => {
    try {
      const [allUsers, existingContacts] = await Promise.all([
        getAllUsersFromFirestore(),
        currentUser?.uid ? getSavedUserContactsFromFirestore(currentUser.uid) : Promise.resolve([]),
      ]);

      const phones = new Set<string>();
      const uids = new Set<string>();
      existingContacts.forEach(c => {
        if (c.phone) {
          const norm = normalizePhoneNumber(c.phone);
          phones.add(norm);
          phones.add(c.phone.replace(/[^0-9]/g, ''));
        }
        if (c.uid) uids.add(c.uid);
      });
      
      const platformMap: Record<string, UserProfile> = {};
      allUsers.forEach(u => {
        if (u.mobile) {
          const clean = normalizePhoneNumber(u.mobile);
          if (clean) platformMap[clean] = u;
        }
      });

      setMatchedProfiles(platformMap);
      setPlatformUsers(allUsers);
      setExistingPhoneSet(phones);
      setExistingUidSet(uids);
    } catch (e) {
      console.error('Error loading platform users', e);
    }
  };

  const loadPhonebook = async () => {
    setLoading(true);
    try {
      const rawContacts = await ContactService.getDeviceContacts();
      
      const uniqueMap = new Map<string, SyncContact>();
      rawContacts.forEach(c => {
        const norm = normalizePhoneNumber(c.phone);
        const isAlreadyAdded = existingPhoneSet.has(norm) || existingPhoneSet.has(c.phone.replace(/[^0-9]/g, ''));
        if (!uniqueMap.has(c.phone)) {
          uniqueMap.set(c.phone, {
            ...c,
            isAdded: isAlreadyAdded
          });
        }
      });
      const contacts = Array.from(uniqueMap.values());
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
        const norm = normalizePhoneNumber(item.phone);
        setExistingPhoneSet(prev => new Set(prev).add(norm).add(item.phone.replace(/[^0-9]/g, '')));
        if (item.uid) setExistingUidSet(prev => new Set(prev).add(item.uid!));
        setDeviceContacts(prev => prev.map(c => (c.phone === item.phone || normalizePhoneNumber(c.phone) === norm) ? { ...c, isAdded: true } : c));
        dialog.showSuccess('Contact Added', `${item.name} is now added to your contacts.`);
      }
    } catch (e) {
      dialog.showError('Error', 'Failed to add contact. Please try again.');
    }
  };

  const handleInvite = (item: SyncContact) => {
    ContactService.inviteContact(item.phone, item.name);
  };

  const filteredContacts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    if (activeTab === 'phonebook') {
      let list = query
        ? deviceContacts.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.phone.includes(query)
          )
        : [...deviceContacts];

      return list.sort((a, b) => {
        const getPriority = (contact: SyncContact) => {
          if (contact.isAdded) return 2;
          if (matchedProfiles[contact.phone]) return 1;
          return 0;
        };

        const pA = getPriority(a);
        const pB = getPriority(b);

        if (pA !== pB) return pB - pA;
        return (a.name || '').localeCompare(b.name || '');
      });
    } else {
      if (!query) return []; // Do not show users by default

      let list = platformUsers.filter(u => {
        const queryPhone = normalizePhoneNumber(query);
        const isFullPhone = queryPhone.length >= 10;
        const isEmailSearch = query.includes('@');

        if (!isFullPhone && !isEmailSearch) return false;

        const phoneMatch = isFullPhone && u.mobile ? normalizePhoneNumber(u.mobile) === queryPhone : false;
        const emailMatch = isEmailSearch && u.email ? u.email.toLowerCase() === query : false;
        
        return phoneMatch || emailMatch;
      });

      return list.map(u => {
        const phoneClean = u.mobile ? normalizePhoneNumber(u.mobile) : '';
        const phoneRaw = u.mobile ? u.mobile.replace(/[^0-9]/g, '') : '';
        const isAdded = (phoneClean && existingPhoneSet.has(phoneClean)) ||
                        (phoneRaw && existingPhoneSet.has(phoneRaw)) ||
                        (u.uid ? existingUidSet.has(u.uid) : false);
        return {
          name: u.name,
          phone: phoneClean || (u.email || ''),
          email: u.email,
          uid: u.uid,
          photoUrl: u.photoUrl,
          photoThumbnailUrl: u.photoThumbnailUrl,
          isAdded,
          isSplitmateUser: true
        } as SyncContact;
      }).filter(u => u.uid !== currentUser?.uid).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
  }, [deviceContacts, searchQuery, matchedProfiles, activeTab, platformUsers, existingPhoneSet, existingUidSet, currentUser]);

  const renderItem = useCallback(({ item }: { item: SyncContact & { isSplitmateUser?: boolean } }) => {
    const platformUser = matchedProfiles[item.phone] || (item.uid ? platformUsers.find(u => u.uid === item.uid) : null);
    const isOnPlatform = item.isSplitmateUser ? true : !!platformUser;

    const normPhone = item.phone ? normalizePhoneNumber(item.phone) : '';
    const rawPhone = item.phone ? item.phone.replace(/[^0-9]/g, '') : '';
    const isContactAdded = Boolean(
      item.isAdded ||
      (normPhone && existingPhoneSet.has(normPhone)) ||
      (rawPhone && existingPhoneSet.has(rawPhone)) ||
      (item.uid && existingUidSet.has(item.uid)) ||
      (platformUser?.uid && existingUidSet.has(platformUser.uid))
    );

    // Priority Logic:
    // 1. Platform Photo (from Firestore profile)
    // 2. Device Photo (from phonebook sync)
    // 3. Initials (handled automatically by SmartImage)
    const priorityPhoto = platformUser?.photoThumbnailUrl || platformUser?.photoUrl || (platformUser as any)?.photoURL || item.photoUrl;
    const thumbnailUri = platformUser?.photoThumbnailUrl || priorityPhoto;

    return (
      <View style={[styles.contactCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
        <SmartImage
          uri={priorityPhoto}
          thumbnailUri={thumbnailUri}
          name={platformUser?.name || item.name}
          mode="thumbnail"
          size={48}
          style={{ borderRadius: 24 }}
        />

        <View style={styles.contactInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.contactName, { color: colors.onSurface }]} numberOfLines={1}>
              {platformUser?.name || item.name || item.phone}
            </Text>
            {isContactAdded && (
              <View style={[styles.addedInlineBadge, { backgroundColor: isDark ? '#064E3B' : '#DCFCE7' }]}>
                <MaterialIcons name="check" size={12} color={isDark ? '#34D399' : '#15803D'} />
                <Text style={[styles.addedInlineText, { color: isDark ? '#34D399' : '#15803D' }]}>Added</Text>
              </View>
            )}
          </View>
          <Text style={[styles.contactSub, { color: colors.onSurfaceVariant }]}>{item.phone}</Text>
          {isOnPlatform && (
            <View style={[styles.platformBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.platformBadgeText, { color: '#FFFFFF' }]}>SplitMate</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {isContactAdded ? (
            <View style={[styles.addedBtnPill, { backgroundColor: isDark ? '#064E3B' : '#DCFCE7', borderColor: isDark ? '#059669' : '#86EFAC' }]}>
              <MaterialIcons name="check" size={16} color={isDark ? '#34D399' : '#15803D'} />
              <Text style={[styles.addedBtnText, { color: isDark ? '#34D399' : '#15803D' }]}>Added</Text>
            </View>
          ) : isOnPlatform ? (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleAdd(item)}
            >
              <MaterialIcons name="add" size={18} color={colors.onPrimary} />
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
  }, [colors, matchedProfiles, platformUsers, existingPhoneSet, existingUidSet, isDark]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Add Contacts</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'phonebook' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => { setSearchQuery(''); setActiveTab('phonebook'); }}
        >
          <Text style={[styles.tabText, { color: activeTab === 'phonebook' ? colors.primary : colors.onSurfaceVariant }]}>Phonebook</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'splitmate' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => { setSearchQuery(''); setActiveTab('splitmate'); }}
        >
          <Text style={[styles.tabText, { color: activeTab === 'splitmate' ? colors.primary : colors.onSurfaceVariant }]}>Splitmate</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <M3SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={activeTab === 'splitmate' ? "Search email or phone..." : "Search name or phone..."}
        />
      </View>

      {loading && activeTab === 'phonebook' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>Syncing phonebook...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => `sync_${item.phone}_${item.uid || ''}`}
          renderItem={renderItem}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="person-search" size={64} color={colors.outlineVariant} />
              <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                {activeTab === 'splitmate' 
                  ? (searchQuery ? 'No users found with that email or phone' : 'Search by email or phone to find Splitmate users') 
                  : (searchQuery ? 'No contacts match your search' : 'No contacts found in phonebook')}
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
  tabContainer: { flexDirection: 'row', paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { ...Typography.labelLg, fontWeight: '700' },
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  addedInlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  addedInlineText: { fontSize: 10, fontWeight: '700' },
  actions: { minWidth: 80, alignItems: 'flex-end' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md, gap: 4 },
  addBtnText: { ...Typography.labelLg, fontWeight: '700' },
  addedBtnPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.md, borderWidth: 1, gap: 4 },
  addedBtnText: { fontSize: 12, fontWeight: '700' },
  inviteBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1 },
  inviteBtnText: { ...Typography.labelLg, fontWeight: '700' },
  addedState: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { ...Typography.bodyMd },
  empty: { marginTop: 100, alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', marginTop: 16, lineHeight: 22 },
});
