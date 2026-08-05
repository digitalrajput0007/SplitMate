import React, { useState, useEffect } from 'react';
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
import { auth } from '../config/firebase';
import { UserProfile, getAllUsersFromFirestore } from '../services/firestoreService';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ContactsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const currentUser = auth.currentUser;

  const [addedContacts, setAddedContacts] = useState<UserProfile[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAddedContacts();
  }, [currentUser]);

  const fetchAddedContacts = async () => {
    setLoading(true);
    try {
      if (!currentUser?.uid) {
        setAddedContacts([]);
        setFilteredContacts([]);
        setLoading(false);
        return;
      }
      const allUsers = await getAllUsersFromFirestore();
      // Filter active added friends/contacts excluding self
      const friends = allUsers.filter((u) => u.uid !== currentUser.uid);
      setAddedContacts(friends);
      setFilteredContacts(friends);
    } catch (e) {
      console.log('Error loading added contacts:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredContacts(addedContacts);
      return;
    }
    const lower = query.toLowerCase();
    const filtered = addedContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        (c.email && c.email.toLowerCase().includes(lower)) ||
        (c.mobile && c.mobile.includes(lower))
    );
    setFilteredContacts(filtered);
  };

  const renderContactItem = ({ item }: { item: UserProfile }) => {
    const avatarLetter = (item.name || 'U').charAt(0).toUpperCase();

    return (
      <View style={styles.contactCard}>
        <View style={styles.avatarCircle}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.contactAvatarImg} />
          ) : (
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          )}
        </View>

        <View style={styles.contactInfo}>
          <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.contactSub}>{item.mobile || item.email}</Text>
        </View>

        <TouchableOpacity style={styles.chatIconBtn} activeOpacity={0.8}>
          <MaterialIcons name="chat-bubble-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  return (
    <SafeAreaView style={styles.container}>
      <RNStatusBar backgroundColor={Colors.background} barStyle="dark-content" translucent />
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <Text style={styles.headerTitle}>Contacts</Text>
        <Text style={styles.headerSubtitle}>Invite friends or start splitting bills directly</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Syncing SplitMate contacts...</Text>
        </View>
      ) : addedContacts.length === 0 ? (
        /* Matching design specs for Blank State */
        <ScrollView contentContainerStyle={styles.emptyScreenScroll} showsVerticalScrollIndicator={false}>
          {/* Card Graphic */}
          <View style={styles.emptyCardContainer}>
            <View style={styles.bluePlusBadge}>
              <MaterialIcons name="add" size={20} color="#FFFFFF" />
            </View>

            <View style={styles.friendsGraphicBox}>
              <MaterialIcons name="groups" size={60} color="#4C56AF" />
            </View>

            <Text style={styles.graphicCardTitle}>No Friends Found</Text>
            <Text style={styles.graphicCardSub}>
              Invite your friends to join the split and save features!
            </Text>
          </View>

          {/* Main Title & Subtitle */}
          <Text style={styles.emptyMainTitle}>No Contacts Added</Text>
          <Text style={styles.emptyMainSub}>
            Start adding friends to SplitMate to begin sharing expenses effortlessly.
          </Text>

          {/* Invite Now Button */}
          <TouchableOpacity
            style={styles.inviteNowPrimaryBtn}
            onPress={() => navigation.navigate('InviteContacts')}
            activeOpacity={0.85}
          >
            <MaterialIcons name="person-add" size={20} color="#FFFFFF" />
            <Text style={styles.inviteNowPrimaryText}>Invite Now</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Search Bar */}
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={22} color={Colors.outline} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search added contacts..."
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

          {/* Invite Contacts Header Action */}
          <TouchableOpacity
            style={styles.inviteRowBanner}
            onPress={() => navigation.navigate('InviteContacts')}
            activeOpacity={0.8}
          >
            <View style={styles.inviteBannerIcon}>
              <MaterialIcons name="person-add" size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inviteBannerTitle}>Invite Contacts</Text>
              <Text style={styles.inviteBannerSub}>Invite friends from your phone contacts</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={Colors.onSurfaceVariant} />
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
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: { ...Typography.headlineLgMobile, color: Colors.onBackground, fontWeight: '700' },
  headerSubtitle: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    marginHorizontal: Spacing.containerMargin,
    marginVertical: Spacing.xs,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: 10,
    ...Shadows.card,
  },
  searchInput: { flex: 1, ...Typography.bodyLg, color: Colors.onSurface },
  inviteRowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryFixed,
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
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBannerTitle: { ...Typography.titleSm, color: Colors.primary, fontWeight: '700' },
  inviteBannerSub: { ...Typography.labelMd, color: Colors.onSurfaceVariant },
  listContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 100,
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
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...Typography.titleMd, color: Colors.onPrimaryContainer, fontWeight: '700' },
  contactAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  contactInfo: { flex: 1 },
  contactName: { ...Typography.titleSm, color: Colors.onSurface, fontWeight: '600' },
  contactSub: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: 2 },
  chatIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceContainerLow,
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
    backgroundColor: '#FFFFFF',
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
    borderColor: '#F3F4F6',
    marginBottom: 32,
  },
  bluePlusBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366F1',
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
    color: '#1F2937',
    marginBottom: 4,
  },
  graphicCardSub: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 16,
  },
  emptyMainTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1C1C',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyMainSub: {
    fontSize: 14,
    color: '#6B7280',
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
    backgroundColor: '#273896',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 3,
  },
  inviteNowPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  loadingText: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: Spacing.md },
});
