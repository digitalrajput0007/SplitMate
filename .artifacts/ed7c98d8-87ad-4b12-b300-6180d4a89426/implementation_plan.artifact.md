# Implement Group Balance Summary

Implement real-time group balance calculations using a dedicated custom hook to decouple logic from the UI.

## Proposed Changes

### Hooks

#### [NEW] [useGroupBalances.ts](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/src/hooks/useGroupBalances.ts)
- Implement a hook that subscribes to group expenses and settlements.
- Calculate `totalSpent` (sum of all group expenses).
- Calculate `netBalance` for the current user (Payer's share - Owed share + Settlements).
- Use `useMemo` to optimize calculations.

### Screens

#### [MODIFY] [GroupDetailScreen.tsx](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/src/screens/GroupDetailScreen.tsx)
- Integrate `useGroupBalances` hook.
- Remove redundant calculation logic from the component body.
- Update the Summary Card to display the live calculated values.

## Verification Plan

### Manual Verification
- Add a new expense and verify `Total Group Spent` and `Net Balance` update immediately.
- Edit an existing expense (change amount or members) and verify balances update.
- Delete an expense and verify the summary card reflects the change.
- Perform a "Settle Up" and verify the `Net Balance` moves toward zero.
