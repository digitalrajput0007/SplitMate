import * as Contacts from 'expo-contacts';
import { Share, Platform } from 'react-native';
import {
  addContactToUserFirestore,
  findUserByPhone,
  Contact
} from './firestoreService';
import { auth } from '../config/firebase';
import { shareApp } from '../config/appConfig';

/**
 * Normalizes phone numbers to E.164-ish format (last 10 digits for indexing)
 */
export const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return '';
  // Remove all non-numeric characters
  const cleaned = phone.replace(/[^0-9]/g, '');
  // Return last 10 digits to ignore country code variations (+91, 0, etc)
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
};

/**
 * Generates initials for a name
 */
export const getInitials = (name: string): string => {
  if (!name || name.trim() === '') return 'U';
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
};

/**
 * Service to handle device contact synchronization
 */
export const ContactService = {
  /**
   * Syncs device contacts and returns a cleaned list
   */
  async getDeviceContacts(): Promise<Contact[]> {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') throw new Error('Permission denied');

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
    });

    const parsed = data
      .filter(c => c.phoneNumbers && c.phoneNumbers.length > 0)
      .map(c => ({
        name: c.name || '',
        phone: normalizePhoneNumber(c.phoneNumbers![0].number || ''),
        photoUrl: c.image?.uri || undefined,
      }))
      .filter(c => c.phone.length === 10);

    // Deduplicate by phone number
    const unique = new Map<string, Contact>();
    parsed.forEach(c => {
      if (!unique.has(c.phone)) {
        unique.set(c.phone, c);
      }
    });

    return Array.from(unique.values());
  },

  /**
   * Adds a single contact to the user's list, automatically linking platform UID if found
   */
  async addContact(name: string, phone: string): Promise<{ success: boolean; isSplitMateUser: boolean }> {
    const currentUser = auth.currentUser;
    if (!currentUser) return { success: false, isSplitMateUser: false };

    const normalizedPhone = normalizePhoneNumber(phone);
    const platformUser = await findUserByPhone(normalizedPhone);

    await addContactToUserFirestore(currentUser.uid, {
      name: name || platformUser?.name || normalizedPhone,
      phone: normalizedPhone,
      uid: platformUser?.uid,
      photoUrl: platformUser?.photoUrl || undefined,
    });

    return { success: true, isSplitMateUser: !!platformUser };
  },

  /**
   * Triggers the native share sheet to invite a contact
   */
  async inviteContact(phone: string, name?: string) {
    const message = `Hey${name ? ' ' + name : ''}! Join me on SplitMate to split expenses & track bills easily.`;
    await shareApp(message);
  }
};
