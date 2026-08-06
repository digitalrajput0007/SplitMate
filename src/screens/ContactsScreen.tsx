import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StatusBar as RNStatusBar,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import { UserProfile, getSavedUserContactsFromFirestore, removeContactFromUserFirestore } from '../services/firestoreService';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Alert } from 'react-native';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ContactsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const currentUser = auth.currentUser;

  const [addedContacts, setAddedContacts] = useState<UserProfile[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchAddedContacts();
    }, [currentUser])
  );

  const fetchAddedContacts = async () => {
    setLoading(true);
    try {
      if (!currentUser?.uid) {
        setAddedContacts([]);
        setFilteredContacts([]);
        setLoading(false);
        return;
      }
      const savedContacts = await getSavedUserContactsFromFirestore(currentUser.uid);

      // Sort alphabetically
      const sorted = [...savedContacts].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );

      setAddedContacts(sorted);
      setFilteredContacts(sorted);
    } catch (e) {
      console.log('Error loading added contacts:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveContact = async (contact: UserProfile) => {
    if (!currentUser?.uid) return;

    Alert.alert(
      'Remove Contact',
      `Are you sure you want to remove ${contact.name} from your contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeContactFromUserFirestore(currentUser.uid, contact.uid);
              fetchAddedContacts();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove contact.');
            }
          },
        },
      ]
    );
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredContacts(addedContacts);
      return;
    }
    const q = text.toLowerCase();
    const filtered = addedContacts.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.mobile && c.mobile.includes(q))
    );
    setFilteredContacts(filtered);
  };

  const renderContactItem = ({ item }: { item: UserProfile }) => {
    const initial = (item.name || item.email || '?').charAt(0).toUpperCase();

    return (
      <View style={[styles.contactCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.contactAvatarImg} />
        ) : (
          <View style={[styles.avatarCircle, { backgroundColor: colors.primaryContainer }]}>
            <Text style={[styles.avatarText, { color: colors.onPrimaryContainer }]}>{initial}</Text>
          </View>
        )}
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: colors.onSurface }]}>{item.name || 'No Name'}</Text>
          <Text style={[styles.contactSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
            {item.email || item.mobile || 'SplitMate User'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => handleRemoveContact(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="person-remove" size={20} color={colors.outline} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Friends & Contacts</Text>
        <Text style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>Your added SplitMate connections</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>Syncing contacts...</Text>
        </View>
      ) : addedContacts.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScreenScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Card Graphic */}
          <View style={[styles.emptyCardContainer, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={[styles.bluePlusBadge, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="person-add" size={18} color={colors.onPrimary} />
            </View>

            <View style={styles.friendsGraphicBox}>
              <MaterialIcons name="people-outline" size={72} color={colors.primary} />
            </View>

            <Text style={[styles.graphicCardTitle, { color: colors.onSurface }]}>Friends & Family</Text>
            <Text style={[styles.graphicCardSub, { color: colors.onSurfaceVariant }]}>
              Track balances & split expenses effortlessly with your close ones.
            </Text>
          </View>

          {/* Main Title & Subtitle */}
          <Text style={[styles.emptyMainTitle, { color: colors.onBackground }]}>No friends added yet</Text>
          <Text style={[styles.emptyMainSub, { color: colors.onSurfaceVariant }]}>
            Sync your phone contacts or search by email/phone to start splitting bills cleanly.
          </Text>

          {/* Primary CTA */}
          <TouchableOpacity
            style={[styles.inviteNowPrimaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('InviteContacts')}
            activeOpacity={0.85}
          >
            <MaterialIcons name="sync" size={22} color={colors.onPrimary} />
            <Text style={[styles.inviteNowPrimaryText, { color: colors.onPrimary }]}>Sync & Add Friends</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Search Bar */}
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            <MaterialIcons name="search" size={22} color={colors.outline} />
            <TextInput
              style={[styles.searchInput, { color: colors.onSurface }]}
              placeholder="Search added contacts..."
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

          {/* Invite Contacts Header Action */}
          <TouchableOpacity
            style={[styles.inviteRowBanner, { backgroundColor: colors.primaryFixed }]}
            onPress={() => navigation.navigate('InviteContacts')}
            activeOpacity={0.8}
          >
            <View style={[styles.inviteBannerIcon, { backgroundColor: colors.surfaceContainerLowest }]}>
              <MaterialIcons name="person-add" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inviteBannerTitle, { color: colors.primary }]}>Invite Contacts</Text>
              <Text style={[styles.inviteBannerSub, { color: colors.onSurfaceVariant }]}>Invite friends from your phone contacts</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.uid}
            renderItem={renderContactItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: { ...Typography.headlineLgMobile, fontWeight: '700' },
  headerSubtitle: { ...Typography.bodyMd, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.containerMargin,
    marginVertical: Spacing.xs,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 10,
    ...Shadows.card,
  },
  searchInput: { flex: 1, ...Typography.bodyLg },
  inviteRowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.containerMargin,
    marginVertical: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: 12,
  },
  inviteBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBannerTitle: { ...Typography.titleSm, fontWeight: '700' },
  inviteBannerSub: { ...Typography.labelMd },
  listContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 100,
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
  avatarText: { ...Typography.titleMd, fontWeight: '700' },
  contactAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  contactInfo: { flex: 1 },
  contactName: { ...Typography.titleSm, fontWeight: '600' },
  contactSub: { ...Typography.bodyMd, marginTop: 2 },
  removeBtn: {
    padding: 8,
    marginLeft: 4,
  },
  chatIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScreenScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  emptyCardContainer: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    marginBottom: 32,
  },
  bluePlusBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    zIndex: 2,
  },
  friendsGraphicBox: {
    width: 140,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  graphicCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  graphicCardSub: {
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 16,
  },
  emptyMainTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyMainSub: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
    marginBottom: 32,
  },
  inviteNowPrimaryBtn: {
    width: '100%',
    maxWidth: 320,
    height: 50,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 3,
  },
  inviteNowPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
  },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  loadingText: { ...Typography.bodyMd, marginTop: Spacing.md },
});
