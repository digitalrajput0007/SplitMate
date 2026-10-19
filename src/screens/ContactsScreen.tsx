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
  Platform,
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
import { formatCurrency } from '../services/currencyService';
import { SmartImage } from '../components/SmartImage';
import { M3SearchBar } from '../components/M3SearchBar';
import { M3BottomSheet } from '../components/M3BottomSheet';
import { usePairwiseBalances, PairwiseBalanceSummary } from '../hooks/usePairwiseBalances';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Main Contacts Screen
 * Senior engineering implementation: Direct utility feel, no complex social graph.
 */
export default function ContactsScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const currentUser = auth.currentUser;

  const { balancesMap } = usePairwiseBalances();
  const [selectedContactForDetail, setSelectedContactForDetail] = useState<{
    contact: Contact;
    summary: PairwiseBalanceSummary | null;
  } | null>(null);

  const [myContacts, setMyContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [loading, setLoading] = useState(true);

  // Real-time platform profiles for contacts
  const [platformProfiles, setPlatformProfiles] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToUserContacts(currentUser.uid, (contacts) => {
      setMyContacts(contacts.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  // Sync latest platform profiles in real-time for contacts that have a UID
  useEffect(() => {
    if (myContacts.length === 0) return;

    const unsubs: (() => void)[] = [];
    const subscribedUids = new Set<string>();

    myContacts.forEach(contact => {
      if (contact.uid && !subscribedUids.has(contact.uid)) {
        subscribedUids.add(contact.uid);
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

  const handleRemove = (contact: Contact) => {
    Alert.alert('Remove Contact', `Are you sure you want to remove ${contact.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeContactFromUserFirestore(currentUser!.uid, contact.phone || contact.name, contact.uid),
      },
    ]);
  };

  const [activeFilter, setActiveFilter] = useState<'all' | 'owesYou' | 'youOwe'>('all');

  const handleInvite = (phone: string, name?: string) => {
    ContactService.inviteContact(phone, name);
  };

  const filteredContacts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return myContacts.filter((c) => {
      const matchesSearch =
        !query ||
        (c.name || '').toLowerCase().includes(query) ||
        (c.phone || '').includes(query);

      if (!matchesSearch) return false;

      if (activeFilter === 'all') return true;

      const balSummary = c.uid ? balancesMap.get(c.uid) : undefined;
      const total = balSummary?.totalBalance || 0;

      if (activeFilter === 'owesYou') {
        return total > 0.01;
      }
      if (activeFilter === 'youOwe') {
        return total < -0.01;
      }

      return true;
    });
  }, [myContacts, searchQuery, activeFilter, balancesMap]);

  // UI Components
  const renderContact = useCallback(({ item }: { item: Contact }) => {
    const platformUser = item.uid ? platformProfiles[item.uid] : null;

    // Priority: 1. Platform Thumbnail/Photo, 2. Local Contact Thumbnail/Photo
    const priorityPhoto = platformUser?.photoThumbnailUrl || platformUser?.photoUrl || (platformUser as any)?.photoURL || item.photoThumbnailUrl || item.photoUrl;
    const thumbnailUri = platformUser?.photoThumbnailUrl || item.photoThumbnailUrl || priorityPhoto;

    const balanceSummary = item.uid ? balancesMap.get(item.uid) : undefined;
    const total = balanceSummary?.totalBalance || 0;
    const isSettled = Math.abs(total) < 0.01;
    const owesYou = total > 0.01;
    const youOwe = total < -0.01;

    return (
      <TouchableOpacity
        style={[styles.contactCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}
        onPress={() => setSelectedContactForDetail({ contact: item, summary: balanceSummary || null })}
        activeOpacity={0.7}
      >
        <SmartImage
          uri={priorityPhoto}
          thumbnailUri={thumbnailUri}
          name={platformUser?.name || item.name}
          mode="thumbnail"
          size={48}
          style={{ borderRadius: 24 }}
        />
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: colors.onSurface }]}>{platformUser?.name || item.name || item.phone}</Text>
          <Text style={[styles.contactSub, { color: colors.onSurfaceVariant }]}>{item.phone}</Text>
          
          {item.uid && (
            <View style={styles.balanceBadgeRow}>
              {isSettled ? (
                <Text style={[styles.settledText, { color: colors.outline }]}>settled up</Text>
              ) : owesYou ? (
                <Text style={[styles.owesYouText, { color: isDark ? '#34D399' : '#059669' }]}>
                  owes you {formatCurrency(total)}
                </Text>
              ) : (
                <Text style={[styles.youOweText, { color: isDark ? '#F87171' : '#DC2626' }]}>
                  you owe {formatCurrency(Math.abs(total))}
                </Text>
              )}
            </View>
          )}
        </View>
        <View style={styles.actions}>
          {!item.uid ? (
            <TouchableOpacity onPress={() => handleInvite(item.phone, item.name)} style={styles.inviteSmallBtn}>
              <Text style={[styles.inviteSmallBtnText, { color: colors.primary }]}>Invite</Text>
            </TouchableOpacity>
          ) : (
            <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
          )}
          <TouchableOpacity onPress={() => handleRemove(item)} style={styles.deleteBtn}>
            <MaterialIcons name="delete-outline" size={20} color={colors.outline} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [colors, platformProfiles, balancesMap, isDark]);

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
        <Text style={[styles.addFriendsText, { color: colors.onSurface }]}>Add contacts</Text>
        <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
      </TouchableOpacity>

      {!searchQuery && myContacts.length > 0 && (
        <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}>MY CONTACTS</Text>
      )}
    </View>
  ), [colors, searchQuery, myContacts.length, navigation]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={styles.topBar}>
        <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Contacts</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <M3SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search name or phone..."
            onClear={() => setSearchQuery('')}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.filterIconBtn,
            { backgroundColor: activeFilter !== 'all' ? colors.primary : colors.surfaceContainerHigh }
          ]}
          onPress={() => setShowFilterSheet(true)}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="tune"
            size={22}
            color={activeFilter !== 'all' ? colors.onPrimary : colors.onSurfaceVariant}
          />
          {activeFilter !== 'all' && <View style={[styles.filterBadge, { backgroundColor: colors.error }]} />}
        </TouchableOpacity>
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
            <Text style={[styles.inviteNowText, { color: colors.onPrimary }]}>Add contacts</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item, index) => item.phone || `contact-${index}`}
          renderItem={renderContact}
          ListHeaderComponent={HeaderComponent}
          contentContainerStyle={styles.list}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            searchQuery ? (
              <View style={styles.noResults}>
                <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>No matching contacts found.</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* OWE DETAILS BOTTOM SHEET */}
      <M3BottomSheet
        visible={!!selectedContactForDetail}
        onClose={() => setSelectedContactForDetail(null)}
        onDismiss={() => setSelectedContactForDetail(null)}
        title="Owe Details"
      >
        {selectedContactForDetail && (
          <View style={{ paddingBottom: 24 }}>
            {/* Contact Info Header Box */}
            <View style={[styles.modalHeaderBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.divider }]}>
              <SmartImage
                uri={selectedContactForDetail.contact.photoUrl}
                thumbnailUri={selectedContactForDetail.contact.photoThumbnailUrl}
                name={selectedContactForDetail.contact.name}
                size={56}
                mode="thumbnail"
                style={{ borderRadius: 28 }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.modalName, { color: colors.onSurface }]}>
                  {selectedContactForDetail.contact.name || selectedContactForDetail.contact.phone}
                </Text>
                <Text style={[styles.modalPhone, { color: colors.onSurfaceVariant }]}>
                  {selectedContactForDetail.contact.phone}
                </Text>
                {selectedContactForDetail.summary && (
                  <Text
                    style={[
                      styles.modalOverallBalance,
                      {
                        color:
                          selectedContactForDetail.summary.totalBalance > 0.01
                            ? (isDark ? '#34D399' : '#059669')
                            : selectedContactForDetail.summary.totalBalance < -0.01
                            ? (isDark ? '#F87171' : '#DC2626')
                            : colors.outline,
                      },
                    ]}
                  >
                    {Math.abs(selectedContactForDetail.summary.totalBalance) < 0.01
                      ? 'Overall: Settled up'
                      : selectedContactForDetail.summary.totalBalance > 0.01
                      ? `Overall: Owes you ${formatCurrency(selectedContactForDetail.summary.totalBalance)}`
                      : `Overall: You owe ${formatCurrency(Math.abs(selectedContactForDetail.summary.totalBalance))}`}
                  </Text>
                )}
              </View>
            </View>

            {/* Group-Wise Breakdown List */}
            <Text style={[styles.groupSectionTitle, { color: colors.onSurfaceVariant }]}>
              GROUP-WISE BREAKDOWN
            </Text>

            {selectedContactForDetail.summary && selectedContactForDetail.summary.groupBreakdown.length > 0 ? (
              selectedContactForDetail.summary.groupBreakdown.map((item, index) => {
                const grpBal = item.balance;
                const isGrpSettled = Math.abs(grpBal) < 0.01;
                const grpOwesYou = grpBal > 0.01;

                return (
                  <TouchableOpacity
                    key={item.group.groupId || `grp-${index}`}
                    style={[styles.groupRowCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}
                    onPress={() => {
                      setSelectedContactForDetail(null);
                      navigation.navigate('GroupDetail', {
                        groupId: item.group.groupId,
                        groupName: item.group.name || 'Group',
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <SmartImage
                      uri={item.group.photoUrl}
                      thumbnailUri={item.group.photoThumbnailUrl}
                      name={item.group.name}
                      size={44}
                      fallbackIcon="groups"
                      style={{ borderRadius: 12 }}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.groupRowName, { color: colors.onSurface }]}>
                        {item.group.name}
                      </Text>
                      <Text
                        style={[
                          styles.groupRowBalance,
                          {
                            color: isGrpSettled
                              ? colors.outline
                              : grpOwesYou
                              ? (isDark ? '#34D399' : '#059669')
                              : (isDark ? '#F87171' : '#DC2626'),
                          },
                        ]}
                      >
                        {isGrpSettled
                          ? 'Settled up'
                          : grpOwesYou
                          ? `owes you ${formatCurrency(grpBal)}`
                          : `you owe ${formatCurrency(Math.abs(grpBal))}`}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={[styles.noSharedGroupsCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
                <MaterialIcons name="groups" size={40} color={colors.outline} />
                <Text style={[styles.noSharedGroupsText, { color: colors.onSurfaceVariant }]}>
                  No shared groups with {selectedContactForDetail.contact.name || 'this contact'} yet.
                </Text>
                <TouchableOpacity
                  style={[styles.createGroupBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setSelectedContactForDetail(null);
                    navigation.navigate('CreateGroupModal' as any);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="add" size={18} color={colors.onPrimary} />
                  <Text style={[styles.createGroupBtnText, { color: colors.onPrimary }]}>Add to Group</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </M3BottomSheet>

      {/* FILTER CONTACTS BOTTOM SHEET */}
      <M3BottomSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        onDismiss={() => setShowFilterSheet(false)}
        title="Filter Contacts"
      >
        <View style={{ gap: 10, paddingBottom: 24 }}>
          {[
            { id: 'all', label: 'All Contacts', icon: 'people-outline' },
            { id: 'owesYou', label: 'Owes You', icon: 'arrow-downward', color: isDark ? '#34D399' : '#059669' },
            { id: 'youOwe', label: 'You Owe', icon: 'arrow-upward', color: isDark ? '#F87171' : '#DC2626' },
          ].map((option) => {
            const isSelected = activeFilter === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.filterOptionRow,
                  {
                    backgroundColor: isSelected ? colors.primaryContainer : colors.surfaceContainerLowest,
                    borderColor: isSelected ? colors.primary : colors.divider,
                  },
                ]}
                onPress={() => {
                  setActiveFilter(option.id as any);
                  setShowFilterSheet(false);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.filterOptionIconCircle, { backgroundColor: isSelected ? colors.primary : colors.surfaceContainerLow }]}>
                  <MaterialIcons
                    name={option.icon as any}
                    size={20}
                    color={isSelected ? colors.onPrimary : option.color || colors.onSurfaceVariant}
                  />
                </View>
                <Text
                  style={[
                    styles.filterOptionLabel,
                    { color: isSelected ? colors.onPrimaryContainer : colors.onSurface, fontWeight: isSelected ? '700' : '500' },
                  ]}
                >
                  {option.label}
                </Text>
                {isSelected && (
                  <MaterialIcons name="check" size={22} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </M3BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { padding: Spacing.md, paddingBottom: Spacing.xs },
  headerTitle: { ...Typography.headlineSm, fontWeight: '700' },
  searchPadding: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: 8,
    marginBottom: Spacing.md,
  },
  filterIconBtn: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 12,
  },
  filterOptionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOptionLabel: {
    ...Typography.titleSm,
    flex: 1,
  },
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
  balanceBadgeRow: {
    marginTop: 3,
  },
  owesYouText: {
    ...Typography.labelMd,
    fontWeight: '700',
    fontSize: 12,
  },
  youOweText: {
    ...Typography.labelMd,
    fontWeight: '700',
    fontSize: 12,
  },
  settledText: {
    ...Typography.labelMd,
    fontWeight: '500',
    fontSize: 12,
  },
  modalHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: 14,
    marginBottom: Spacing.lg,
  },
  modalName: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  modalPhone: {
    ...Typography.bodySm,
    fontSize: 13,
  },
  modalOverallBalance: {
    ...Typography.labelMd,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 2,
  },
  groupSectionTitle: {
    ...Typography.labelMd,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  groupRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  groupRowName: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
  groupRowBalance: {
    ...Typography.labelMd,
    fontWeight: '600',
    fontSize: 12,
  },
  noSharedGroupsCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  noSharedGroupsText: {
    ...Typography.bodyMd,
    textAlign: 'center',
  },
  createGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    gap: 6,
    marginTop: 4,
  },
  createGroupBtnText: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  filterChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterChipText: {
    ...Typography.labelMd,
    fontWeight: '700',
    fontSize: 12,
  },
});
