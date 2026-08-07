# Implementation Plan - Fix Profile Picture Sync and Propagation

This plan addresses the issue where profile picture updates are not reflected immediately across the app and addresses the reported "showing other users" bug.

## User Review Required

> [!IMPORTANT]
> The app currently listens to **all user profiles** in the `HomeScreen` to display names and photos in the activity feed. This is a privacy and performance concern. I will replace this with a more targeted approach, but it may cause a slight delay in showing names/photos for new activity items until their individual profiles are fetched.

## Proposed Changes

### 1. Authentication & Profile Sync [Component: Auth]

#### [MODIFY] [authService.ts](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/src/services/authService.ts)
- Update `updateUserProfile` to call `auth.currentUser.reload()` after the update.
- This ensures that `auth.currentUser.photoURL` is immediately updated in the local Firebase instance.

### 2. Profile Editing Workflow [Component: Screens]

#### [MODIFY] [ProfileEditScreen.tsx](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/src/screens/ProfileEditScreen.tsx)
- Update `handleRemovePhoto` to call `removeMedia()` from `useMediaManager`.
- This ensures the actual image files are deleted from Firebase Storage and the hook's state is correctly reset.

### 3. Account Screen Reactivity [Component: Screens]

#### [MODIFY] [AccountScreen.tsx](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/src/screens/AccountScreen.tsx)
- Replace the focus-based one-time fetch with a real-time Firestore listener for the current user's profile.
- This ensures the UI updates instantly when the profile is saved in `ProfileEditScreen`.

### 4. Home Screen Data Privacy & Efficiency [Component: Screens]

#### [MODIFY] [HomeScreen.tsx](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/src/screens/HomeScreen.tsx)
- Remove the `subscribeAllUserProfiles` listener that fetches the entire `users` collection.
- Update "Recent Activity" and "Reminders" to use the actor/sender information directly from the activity items or fetch individual profiles on demand.

### 5. Firestore Service Optimization [Component: Services]

#### [MODIFY] [firestoreService.ts](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/src/services/firestoreService.ts)
- Optimize `subscribeToAcceptedMembers` to stop listening to all users.
- Add a utility to subscribe to a specific user's profile changes.

## Verification Plan

### Automated Tests
- N/A (React Native project, manual verification on device/emulator is primary).

### Manual Verification
1. Open Profile Edit.
2. Change profile picture -> Verify it updates immediately on Account Screen and Home Screen.
3. Remove profile picture -> Verify it shows initials/placeholder immediately.
4. Verify that other users' activities still show their correct names and photos (if available).
