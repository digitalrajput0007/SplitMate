import { addSentryBreadcrumb } from '../config/sentry';

/**
 * Telemetry and Custom Events Monitoring Service for SplitMate
 */
export const TelemetryService = {
  trackLogin(method: 'email' | 'google' | string) {
    addSentryBreadcrumb('analytics', `User Logged In via ${method}`, { method });
  },

  trackSignup(method: 'email' | 'google' | string) {
    addSentryBreadcrumb('analytics', `User Signed Up via ${method}`, { method });
  },

  trackGroupCreated(groupId: string, memberCount: number) {
    addSentryBreadcrumb('analytics', `Group Created: ${groupId}`, { groupId, memberCount });
  },

  trackExpenseAdded(groupId: string, amount: number) {
    addSentryBreadcrumb('analytics', `Expense Added to group ${groupId}`, { groupId, amount });
  },

  trackExpenseEdited(expenseId: string) {
    addSentryBreadcrumb('analytics', `Expense Edited: ${expenseId}`, { expenseId });
  },

  trackExpenseDeleted(expenseId: string) {
    addSentryBreadcrumb('analytics', `Expense Deleted: ${expenseId}`, { expenseId });
  },

  trackSettlementCompleted(settlementId: string, amount: number) {
    addSentryBreadcrumb('analytics', `Settlement Completed: ${settlementId}`, { settlementId, amount });
  },

  trackProfileUpdated() {
    addSentryBreadcrumb('analytics', 'User Profile Updated');
  },

  trackNotificationReceived(type: string) {
    addSentryBreadcrumb('analytics', `Push Notification Received: ${type}`, { type });
  },
};
