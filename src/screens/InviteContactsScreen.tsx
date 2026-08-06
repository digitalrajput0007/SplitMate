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
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import {
  getAllUsersFromFirestore,
  addContactToUserFirestore,
  getSavedUserContactsFromFirestore,
  UserProfile
} from '../services/firestoreService';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<Contacts.PermissionStatus | null>(null);

  useEffect(() => {
    checkPermissionAndLoad();
  }, []);

  const checkPermissionAndLoad = async () => {
    setLoading(true);
    const { status } = await Contacts.getPermissionsAsync();
    setPermissionStatus(status);
    if (status === 'granted') {
      await loadContactsAndOnboardedStatus();
    } else {
      setLoading(false);
    }
  };

  const requestPermission = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    setPermissionStatus(status);
    if (status === 'granted') {
      await loadContactsAndOnboardedStatus();
    } else if (status === 'denied') {
      Alert.alert(
        'Permission Required',
        'Please enable contacts access in your device settings to find friends on SplitMate.',
        [{ text: 'OK' }]
      );
    }
  };

  const normalizePhone = (num: string) => {
    return num.replace(/[^0-9]/g, '').slice(-10);
  };

  const loadContactsAndOnboardedStatus = async () => {
    setLoading(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
      });

      const registeredUsers = await getAllUsersFromFirestore();
      const registeredPhoneMap = new Map<string, UserProfile>();
      registeredUsers.forEach((user) => {
        if (user.mobile) {
          const norm = normalizePhone(user.mobile);
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

      // Sort: SplitMate users first, then alphabetically
      parsed.sort((a, b) => {
        if (a.isOnboarded !== b.isOnboarded) return a.isOnboarded ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setContacts(parsed);
    } catch (e) {
      console.log('Error fetching contacts:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phoneNumber.includes(q)
    );
  }, [contacts, searchQuery]);

  const handleAddContact = async (item: ContactItem) => {
    if (!currentUser?.uid || !item.onboardedUser) return;

    try {
      await addContactToUserFirestore(currentUser.uid, item.onboardedUser.uid);
      setContacts((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, isAdded: true } : c))
      );
      Alert.alert('Contact Added', `${item.name} is now in your SplitMate contacts!`);
    } catch (e) {
      console.log('Error adding contact:', e);
      Alert.alert('Error', 'Failed to add contact. Please try again.');
    }
  };

  const handleInviteShare = async (item: ContactItem) => {
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

  const handleInviteWhatsApp = async (item: ContactItem) => {
    const message = `Hey ${item.name}! Join me on SplitMate to easily split bills & track group expenses. Download the app today: https://splitmate.app/invite`;
    const url = `whatsapp://send?text=${encodeURIComponent(message)}&phone=${item.phoneNumber}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp not found', 'WhatsApp is not installed on this device.');
      }
    } catch (e) {
      handleInviteShare(item);
    }
  };

  const renderItem = ({ item }: { item: ContactItem }) => {
    const avatarLetter = item.name.charAt(0).toUpperCase();

    return (
      <View style={[styles.contactCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
        <View style={styles.avatarWrapper}>
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
          {item.isOnboarded && (
            <View style={[styles.miniBadge, { backgroundColor: colors.positive }]}>
              <MaterialIcons name="check" size={10} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.contactInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.contactName, { color: colors.onSurface }]} numberOfLines={1}>{item.name}</Text>
            {item.isOnboarded && (
              <View style={[styles.onboardedBadge, { backgroundColor: colors.positiveContainer }]}>
                <Text style={[styles.onboardedBadgeText, { color: colors.positiveText }]}>On SplitMate</Text>
              </View>
            )}
          </View>
          <Text style={[styles.contactPhone, { color: colors.onSurfaceVariant }]}>{item.phoneNumber}</Text>
        </View>

        <View style={styles.actionColumn}>
          {item.isOnboarded ? (
            item.isAdded ? (
              <View style={[styles.addedIndicator, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="person" size={18} color={colors.positive} />
                <Text style={[styles.addedText, { color: colors.positive }]}>Added</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={() => handleAddContact(item)}
                activeOpacity={0.8}
              >
                <Text style={[styles.addButtonText, { color: colors.onPrimary }]}>Add</Text>
              </TouchableOpacity>
            )
          ) : (
            <View style={styles.inviteActions}>
              <TouchableOpacity
                style={[styles.inviteIconBtn, { backgroundColor: colors.surfaceContainerLow }]}
                onPress={() => handleInviteWhatsApp(item)}
                activeOpacity={0.7}
              >
                <FontAwesome name="whatsapp" size={18} color="#25D366" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inviteIconBtn, { backgroundColor: colors.primaryContainer }]}
                onPress={() => handleInviteShare(item)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="share" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const insets = useSafeAreaInsets();
  const topPadding = insets.top + Spacing.xs;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />
      <View style={[styles.topHeader, { paddingTop: topPadding }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Add Friends</Text>
          <Text style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>Find contacts on SplitMate</Text>
        </View>
      </View>

      {/* Search Bar */}
      {permissionStatus === 'granted' && (
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <MaterialIcons name="search" size={22} color={colors.outline} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder="Search name or number..."
            placeholderTextColor={colors.outline}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={20} color={colors.outline} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>Scanning contacts...</Text>
        </View>
      ) : permissionStatus !== 'granted' ? (
        <View style={styles.centerContainer}>
          <View style={[styles.permissionIconCircle, { backgroundColor: colors.primaryContainer }]}>
            <MaterialIcons name="contacts" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Sync your contacts</Text>
          <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
            Grant access to your contacts to see which of your friends are already using SplitMate.
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
            <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>Allow Access</Text>
          </TouchableOpacity>
        </View>
      ) : filteredContacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search-off" size={64} color={colors.outlineVariant} />
          <Text style={[styles.emptyTitle, { color: colors.onSurface, marginTop: 16 }]}>No contacts found</Text>
          <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
            We couldn't find any contacts matching your search.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={20}
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
    height: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 10,
    ...Shadows.card,
  },
  searchInput: { flex: 1, ...Typography.bodyLg },
  listContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 40,
    gap: Spacing.xs,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginVertical: 4,
    gap: 12,
    ...Shadows.card,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { ...Typography.titleLg, fontWeight: '700' },
  miniBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  contactName: { ...Typography.titleSm, fontWeight: '600', maxWidth: 140 },
  onboardedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  onboardedBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  contactPhone: { ...Typography.bodyMd, marginTop: 2, opacity: 0.7 },
  actionColumn: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    ...Shadows.button,
  },
  addButtonText: { ...Typography.labelLg, fontWeight: '700' },
  addedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  addedText: { ...Typography.labelMd, fontWeight: '700' },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  inviteIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  permissionIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingText: { ...Typography.bodyMd, marginTop: Spacing.md },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl },
  emptyTitle: { ...Typography.headlineSm, fontWeight: '700', textAlign: 'center' },
  emptySub: { ...Typography.bodyMd, textAlign: 'center', marginTop: 12, lineHeight: 20, paddingHorizontal: 20 },
  primaryBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: BorderRadius.lg, marginTop: 32, ...Shadows.button },
  primaryBtnText: { ...Typography.titleMd, fontWeight: '700' },
});
