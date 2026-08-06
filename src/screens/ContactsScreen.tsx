import React, { useState, useCallback, useEffect } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import {
  UserProfile,
  getSavedUserContactsFromFirestore,
  removeContactFromUserFirestore,
  subscribeToFriendRequests,
  respondToFriendRequest,
  FriendRequest
} from '../services/firestoreService';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { SmartImage } from '../components/SmartImage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ContactsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useTheme();
  const currentUser = auth.currentUser;

  const [addedContacts, setAddedContacts] = useState<UserProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToFriendRequests(currentUser.uid, setFriendRequests);
    return () => unsub();
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      fetchAddedContacts();
    }, [currentUser])
  );

  const fetchAddedContacts = async () => {
    if (!currentUser?.uid) return;
    try {
      const savedContacts = await getSavedUserContactsFromFirestore(currentUser.uid);
      const sorted = [...savedContacts].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setAddedContacts(sorted);
    } catch (e) {
      console.log('Error loading contacts:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (request: FriendRequest, status: 'accepted' | 'declined') => {
    try {
      await respondToFriendRequest(request.requestId, status);
      if (status === 'accepted') fetchAddedContacts();
    } catch (e) {
      Alert.alert('Error', 'Failed to respond to request');
    }
  };

  const handleRemoveContact = async (contact: UserProfile) => {
    if (!currentUser?.uid) return;
    Alert.alert('Remove Friend', `Remove ${contact.name} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
          await removeContactFromUserFirestore(currentUser.uid, contact.uid);
          fetchAddedContacts();
      }},
    ]);
  };

  const filteredContacts = addedContacts.filter(c =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderRequest = ({ item }: { item: FriendRequest }) => (
    <View style={[styles.requestCard, { backgroundColor: colors.primaryFixed, borderColor: colors.primary }]}>
      <SmartImage uri={item.fromPhotoUrl} name={item.fromName} size={44} style={{ borderRadius: 22 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.contactName, { color: colors.onPrimaryFixed }]}>{item.fromName}</Text>
        <Text style={[styles.contactSub, { color: colors.onPrimaryFixedVariant }]}>Sent you a friend request</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity onPress={() => handleRespond(item, 'declined')} style={styles.iconBtn}>
          <MaterialIcons name="close" size={24} color={colors.onPrimaryFixedVariant} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleRespond(item, 'accepted')} style={[styles.iconBtn, { backgroundColor: colors.primary, borderRadius: 20 }]}>
          <MaterialIcons name="check" size={24} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderContact = ({ item }: { item: UserProfile }) => (
    <View style={[styles.contactCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
      <SmartImage uri={item.photoUrl} thumbnailUri={item.photoThumbnailUrl} name={item.name} size={44} style={{ borderRadius: 22 }} />
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: colors.onSurface }]}>{item.name}</Text>
        <Text style={[styles.contactSub, { color: colors.onSurfaceVariant }]}>{item.email || item.mobile}</Text>
      </View>
      <TouchableOpacity onPress={() => handleRemoveContact(item)}>
        <MaterialIcons name="more-vert" size={20} color={colors.outline} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Friends</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primaryContainer }]} onPress={() => navigation.navigate('InviteContacts')}>
          <MaterialIcons name="person-add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
        <MaterialIcons name="search" size={22} color={colors.outline} />
        <TextInput
          style={[styles.searchInput, { color: colors.onSurface }]}
          placeholder="Search friends..."
          placeholderTextColor={colors.outline}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {friendRequests.length > 0 && !searchQuery && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>PENDING REQUESTS</Text>
          <FlatList data={friendRequests} renderItem={renderRequest} keyExtractor={r => r.requestId} scrollEnabled={false} />
        </View>
      )}

      <View style={[styles.section, { flex: 1 }]}>
        {!searchQuery && <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>ALL FRIENDS</Text>}
        <FlatList
          data={filteredContacts}
          renderItem={renderContact}
          keyExtractor={c => c.uid}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="people-outline" size={64} color={colors.outlineVariant} />
              <Text style={{ color: colors.onSurfaceVariant, marginTop: 16 }}>No friends found</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  headerTitle: { ...Typography.headlineSm, fontWeight: '700' },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, paddingHorizontal: 12, height: 48, borderRadius: BorderRadius.lg, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, ...Typography.bodyLg },
  section: { paddingHorizontal: Spacing.md, marginTop: Spacing.lg, gap: Spacing.sm },
  sectionTitle: { ...Typography.labelMd, fontWeight: '800', letterSpacing: 1 },
  requestCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1, gap: 12 },
  requestActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  contactCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, gap: 12, marginVertical: 4 },
  contactInfo: { flex: 1 },
  contactName: { ...Typography.titleSm, fontWeight: '700' },
  contactSub: { ...Typography.bodySm, marginTop: 2 },
  empty: { marginTop: 80, alignItems: 'center' }
});
