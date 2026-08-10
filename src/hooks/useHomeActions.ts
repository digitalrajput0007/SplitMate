import { useState, useEffect, useMemo } from 'react';
import {
  subscribeToPendingInvitations,
  subscribeUserBalanceSummary,
  subscribeToUserPendingSettlements,
  subscribeToNotifications,
  GroupInvitation,
  SettlementData,
  AppNotification,
  UserBalanceSummary
} from '../services/firestoreService';
import { auth } from '../config/firebase';

export type HomePriorityState =
  | 'INVITATION'
  | 'REMINDER'
  | 'OWE'
  | 'OWED'
  | 'CONFIRMATION'
  | 'SETTLED'
  | 'NO_GROUPS';

export interface HomeActionState {
  priority: HomePriorityState;
  message: string;
  subMessage: string;
  cta: string;
}

export function useHomeActions(groupCount: number) {
  const currentUser = auth.currentUser;
  const [invites, setInvites] = useState<GroupInvitation[]>([]);
  const [reminders, setReminders] = useState<AppNotification[]>([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<SettlementData[]>([]);
  const [balance, setBalance] = useState<UserBalanceSummary>({ totalBalance: 0, youAreOwed: 0, youOwe: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) return;

    let unsubInvites: (() => void) | null = null;
    let unsubBalance: (() => void) | null = null;
    let unsubPending: (() => void) | null = null;
    let unsubNotifs: (() => void) | null = null;

    // Defer listener setup by 350ms to allow Home Screen UI to render instantly without network thread contention
    const timer = setTimeout(() => {
      unsubInvites = subscribeToPendingInvitations(currentUser.uid, setInvites);
      unsubBalance = subscribeUserBalanceSummary(currentUser.uid, setBalance);
      unsubPending = subscribeToUserPendingSettlements(currentUser.uid, (sets) => {
        setPendingConfirmations(sets.filter(s => s.toUserId === currentUser.uid));
      });
      unsubNotifs = subscribeToNotifications(currentUser.uid, (notifs) => {
        setReminders(notifs.filter(n => (n.type === 'payment_reminder' || n.type === 'REMINDER') && !n.isRead && !n.read));
      });
    }, 350);

    return () => {
      clearTimeout(timer);
      if (unsubInvites) unsubInvites();
      if (unsubBalance) unsubBalance();
      if (unsubPending) unsubPending();
      if (unsubNotifs) unsubNotifs();
    };
  }, [currentUser]);

  const actionState = useMemo((): HomeActionState => {
    // 1. Pending Group Invitation
    if (invites.length > 0) {
      return {
        priority: 'INVITATION',
        message: `You have ${invites.length} pending invite${invites.length > 1 ? 's' : ''}`,
        subMessage: 'Join your friends to start splitting.',
        cta: 'Accept Invitation'
      };
    }

    // 2. Pending Settlement Reminder
    if (reminders.length > 0) {
      return {
        priority: 'REMINDER',
        message: 'Settlement Reminder',
        subMessage: `You have ${reminders.length} reminder${reminders.length > 1 ? 's' : ''} to pay.`,
        cta: 'Pay Now'
      };
    }

    // 3. User Owes Money
    if (balance.youOwe > 0.05) {
      return {
        priority: 'OWE',
        message: 'Balance Outstanding',
        subMessage: `You owe a total of ${balance.youOwe.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`,
        cta: 'Settle Up'
      };
    }

    // 4. User Is Owed Money
    if (balance.youAreOwed > 0.05) {
      return {
        priority: 'OWED',
        message: 'You are Owed',
        subMessage: `Friends owe you ${balance.youAreOwed.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`,
        cta: 'View Settlements'
      };
    }

    // 5. Pending Settlement Confirmation
    if (pendingConfirmations.length > 0) {
      return {
        priority: 'CONFIRMATION',
        message: 'Payment Awaiting Confirmation',
        subMessage: 'A friend recorded a payment to you.',
        cta: 'Review'
      };
    }

    // 7. No Groups (Lower priority than All Settled?)
    // Prompt says 6. All Settled, 7. No Groups.
    if (groupCount === 0) {
      return {
        priority: 'NO_GROUPS',
        message: 'No active groups',
        subMessage: 'Create a group to start splitting expenses.',
        cta: 'Create Group'
      };
    }

    // 6. All Settled
    return {
      priority: 'SETTLED',
      message: 'All Settled!',
      subMessage: 'You are up to date with all your groups.',
      cta: 'Add Expense'
    };
  }, [invites, reminders, pendingConfirmations, balance, groupCount]);

  return { actionState, invites, reminders, pendingConfirmations, balance };
}
