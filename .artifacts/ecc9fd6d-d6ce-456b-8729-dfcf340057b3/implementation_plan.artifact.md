# Implementation Plan - HomeScreen UI Redesign

Redesign the `HomeScreen` UI to match the approved design screenshot while preserving all existing functionality, Firestore integrations, state management, and navigation.

## Proposed Changes

### [Component Name]

#### [MODIFY] [HomeScreen.tsx](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/src/screens/HomeScreen.tsx)

- Update Header with "Good Morning" greeting and notification red dot.
- Add "Unsettled Balances" blue banner.
- Redesign "Net Balance" card with dark blue theme and "Settle Up" button.
- Add row of Action Buttons: Add Expense, Create Group, Invite Friend, Payment Methods.
- Update "Pending Invitations" to match design.
- Add "Pending Settlements" section with avatars and "Settle Now"/"Remind" buttons.
- Add "Monthly Insights" grid (Total Spent, Total Received, Largest Expense, Settlements).
- Add "Recent Activity" list.
- Update "Recent Groups" horizontal scroll list.

## Verification Plan

### Manual Verification
- Verify the header greeting matches the time of day (or just use "Good Morning" as per screenshot if preferred, but dynamic is better).
- Verify the "Net Balance" card displays correct data from `balanceSummary`.
- Verify action buttons navigate to correct screens.
- Verify "Pending Settlements" section displays actual unsettled expenses/settlements.
- Verify "Monthly Insights" shows correct summary data.
- Verify "Recent Activity" reflects recent Firestore updates.
- Verify "Recent Groups" shows the user's groups correctly.
