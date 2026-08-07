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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import {
  Contact,
  removeContactFromUserFirestore,
  subscribeToUserContacts,
  subscribeToUserProfile,
  findUserByPhone,
  UserProfile,
} from '../services/firestoreService';
import { ContactService, normalizePhoneNumber } from '../services/ContactService';
import { SmartImage } from '../components/SmartImage';
import { M3SearchBar } from '../components/M3SearchBar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Main Contacts Screen
 * Senior engineering implementation: Direct utility feel, no complex social graph.
 */
export default function ContactsScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const currentUser = auth.currentUser;

  const [myContacts, setMyContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Real-time platform profiles for contacts
  const [platformProfiles, setPlatformProfiles] = useState<Record<string, UserProfile>>({});

  // Platform Search state (Special Case)
  const [platformResult, setPlatformResult] = useState<UserProfile | null>(null);
  const [searchingPlatform, setPlatformSearching] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToUserContacts(currentUser.uid, (contacts) => {
      setMyContacts(contacts.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  // Sync latest platform profiles for contacts that have a UID
  useEffect(() => {
    if (myContacts.length === 0) return;

    const unsubs: (() => void)[] = [];
    myContacts.forEach(contact => {
      if (contact.uid && !platformProfiles[contact.uid]) {
        const unsub = subscribeToUserProfile(contact.uid, (profile) => {
          if (profile) {
            setPlatformProfiles(prev => ({
              ...prev,
              [contact.uid!]: profile
            }));
          }
        });
        unsubs.push(unsub);
      }
    });

    return () => unsubs.forEach(u => u());
  }, [myContacts]);

  // Debounced Search Logic
  useEffect(() => {
    const timer = setTimeout(() => {
      const cleanNum = normalizePhoneNumber(searchQuery);
      if (cleanNum.length === 10) {
        handlePlatformSearch(cleanNum);
      } else {
        setPlatformResult(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handlePlatformSearch = async (phone: string) => {
    // If already in contacts, don't show separate result
    if (myContacts.some(c => c.phone === phone)) return;

    setPlatformSearching(true);
    try {
      const user = await findUserByPhone(phone);
      setPlatformResult(user);
    } catch (e) {
      console.log('Special search error:', e);
    } finally {
      setPlatformSearching(false);
    }
  };

  const handleAddFromPlatform = async (user: UserProfile) => {
    try {
      await ContactService.addContact(user.name, user.mobile || '');
      setSearchQuery('');
      setPlatformResult(null);
      Alert.alert('Added', `${user.name} added to your contacts.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to add contact');
    }
  };

  const handleRemove = (contact: Contact) => {
    Alert.alert('Remove Contact', `Are you sure you want to remove ${contact.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeContactFromUserFirestore(currentUser!.uid, contact.phone) },
    ]);
  };

  const handleInvite = (phone: string, name?: string) => {
    ContactService.inviteContact(phone, name);
  };

  const filteredContacts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return myContacts;
    return myContacts.filter(c =>
      (c.name || '').toLowerCase().includes(query) ||
      (c.phone || '').includes(query)
    );
  }, [myContacts, searchQuery]);

  // UI Components
  const renderContact = useCallback(({ item }: { item: Contact }) => {
    const platformUser = item.uid ? platformProfiles[item.uid] : null;

    // Priority: 1. Platform Profile Pic, 2. Device Profile Pic, 3. Initials
    const priorityPhoto = platformUser?.photoUrl || (platformUser as any)?.photoURL || item.photoUrl;

    return (
      <View style={[styles.contactCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
        <SmartImage uri={priorityPhoto} name={platformUser?.name || item.name} size={48} style={{ borderRadius: 24 }} />
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: colors.onSurface }]}>{platformUser?.name || item.name || item.phone}</Text>
          <Text style={[styles.contactSub, { color: colors.onSurfaceVariant }]}>{item.phone}</Text>
          {item.uid && (
            <View style={[styles.platformBadge, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.platformBadgeText, { color: colors.primary }]}>SplitMate</Text>
            </View>
          )}
        </View>
        <View style={styles.actions}>
          {!item.uid && (
            <TouchableOpacity onPress={() => handleInvite(item.phone, item.name)} style={styles.inviteSmallBtn}>
              <Text style={[styles.inviteSmallBtnText, { color: colors.primary }]}>Invite</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => handleRemove(item)} style={styles.deleteBtn}>
            <MaterialIcons name="delete-outline" size={20} color={colors.outline} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [colors, platformProfiles]);

  const HeaderComponent = useMemo(() => (
    <View style={styles.listHeader}>
      {/* ➕ ADD FRIENDS CTA ROW */}
      <TouchableOpacity
        style={[styles.addFriendsRow, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.primaryContainer }]}
        onPress={() => navigation.navigate('ContactSync')}
        activeOpacity={0.8}
      >
        <View style={[styles.addIconCircle, { backgroundColor: colors.primary }]}>
          <MaterialIcons name="person-add" size={20} color={colors.onPrimary} />
        </View>
        <Text style={[styles.addFriendsText, { color: colors.onSurface }]}>Add Friends from Phonebook</Text>
        <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
      </TouchableOpacity>

      {/* PLATFORM SEARCH RESULT (SPECIAL CASE) */}
      {platformResult && (
        <View style={styles.platformResultBox}>
          <Text style={[styles.sectionHeader, { color: colors.primary }]}>FOUND ON SPLITMATE</Text>
          <View style={[styles.contactCard, { backgroundColor: colors.primaryFixed, borderColor: colors.primary }]}>
            <SmartImage
              uri={platformResult.photoUrl || (platformResult as any).photoURL}
              name={platformResult.name}
              size={48}
              style={{ borderRadius: 24 }}
            />
            <View style={styles.contactInfo}>
              <Text style={[styles.contactName, { color: colors.onPrimaryFixed }]}>{platformResult.name}</Text>
              <Text style={[styles.contactSub, { color: colors.onPrimaryFixedVariant }]}>{platformResult.mobile}</Text>
            </View>
            <TouchableOpacity
              style={[styles.platformAddBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleAddFromPlatform(platformResult)}
            >
              <MaterialIcons name="add" size={20} color={colors.onPrimary} />
              <Text style={[styles.platformAddBtnText, { color: colors.onPrimary }]}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {searchingPlatform && (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
      )}

      {!searchQuery && myContacts.length > 0 && (
        <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}>MY CONTACTS</Text>
      )}
    </View>
  ), [colors, platformResult, searchingPlatform, searchQuery, myContacts.length]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={styles.topBar}>
        <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Contacts</Text>
      </View>

      <View style={styles.searchPadding}>
        <M3SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search your contacts..."
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : myContacts.length === 0 && !searchQuery ? (
        /* EXACT EMPTY STATE FROM DESIGN */
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <View style={[styles.illustrationCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <Image
              source={require('../../stitch_assets/add_members.png')}
              style={styles.illustration}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.emptyHeadline, { color: colors.onBackground }]}>No Contacts Added</Text>
          <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
            Start adding friends to SplitMate to begin sharing expenses effortlessly.
          </Text>

          <TouchableOpacity
            style={[styles.inviteNowBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('ContactSync')}
            activeOpacity={0.85}
          >
            <MaterialIcons name="person-add" size={22} color={colors.onPrimary} />
            <Text style={[styles.inviteNowText, { color: colors.onPrimary }]}>Invite Now</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.phone}
          renderItem={renderContact}
          ListHeaderComponent={HeaderComponent}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            searchQuery ? (
              <View style={styles.noResults}>
                <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>No matching contacts found.</Text>
                {normalizePhoneNumber(searchQuery).length < 10 && (
                  <Text style={[styles.hintText, { color: colors.outline }]}>Type a 10-digit number to search SplitMate</Text>
                )}
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { padding: Spacing.md, paddingBottom: Spacing.xs },
  headerTitle: { ...Typography.headlineSm, fontWeight: '700' },
  searchPadding: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  listHeader: { marginBottom: Spacing.sm },
  addFriendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: 12
  },
  addIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addFriendsText: { ...Typography.titleSm, fontWeight: '700', flex: 1 },
  sectionHeader: { ...Typography.labelMd, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginTop: 4 },
  platformResultBox: { marginBottom: Spacing.lg },
  contactCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1, gap: 12, marginBottom: Spacing.sm },
  contactInfo: { flex: 1 },
  contactName: { ...Typography.titleSm, fontWeight: '700' },
  contactSub: { ...Typography.bodySm, opacity: 0.6 },
  platformBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  platformBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inviteSmallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  inviteSmallBtnText: { ...Typography.labelMd, fontWeight: '700' },
  deleteBtn: { padding: 4 },
  platformAddBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md, gap: 4 },
  platformAddBtnText: { ...Typography.labelMd, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noResults: { marginTop: 40, alignItems: 'center', gap: 8 },
  hintText: { ...Typography.labelMd, textAlign: 'center' },

  /* EMPTY STATE STYLES */
  emptyContainer: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  illustrationCard: {
    width: '100%',
    maxWidth: 280,
    height: 280,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    ...Shadows.card
  },
  illustration: { width: '100%', height: '100%' },
  emptyHeadline: { ...Typography.titleLg, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { ...Typography.bodyMd, textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 12 },
  inviteNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 320,
    height: 56,
    borderRadius: BorderRadius.lg,
    gap: 12,
    ...Shadows.button
  },
  inviteNowText: { ...Typography.titleMd, fontWeight: '700' },
});
