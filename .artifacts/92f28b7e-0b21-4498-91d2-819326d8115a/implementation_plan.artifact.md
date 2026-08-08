# Fix Navigation Reset Error

The error `The action 'RESET' with payload {"index":0,"routes":[{"name":"MainTabs"}]} was not handled by any navigator` occurs because screens are attempting to manually reset the navigation state to `MainTabs` while it is not present in the current navigation branch or while the navigator is being remounted due to an authentication state change.

## Proposed Changes

### [Navigation]

#### [MODIFY] [AppNavigator.tsx](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/src/navigation/AppNavigator.tsx)
- Update `NavigationContainer` key to include `userStatus?.hasProfile` to ensure proper remounting during onboarding transitions.
- Flatten the authenticated stack to ensure `MainTabs` is available as a route whenever a user is verified.
- Set `initialRouteName` dynamically based on authentication and profile status.

### [Screens]

#### [MODIFY] [ProfileSetupScreen.tsx](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/src/screens/ProfileSetupScreen.tsx)
- Remove redundant `navigation.reset` call that checks for an existing profile.
- Remove manual navigation to `MainTabs` and `ContactsPermission` where `AppNavigator` should handle the flow.

#### [MODIFY] [ContactsPermissionScreen.tsx](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/src/screens/ContactsPermissionScreen.tsx)
- Replace `navigation.reset` with `navigation.navigate('MainTabs')` or remove if `AppNavigator` can handle the transition.
- *Correction*: Since `ContactsPermission` is part of the onboarding, but also accessible later, we should ensure `MainTabs` is reachable.

#### [MODIFY] [SignInScreen.tsx](file:///C:/Users/sbiet/.gemini/antigravity-ide/scratch/SplitMate/src/screens/SignInScreen.tsx)
- Remove manual `navigation.reset` after Google sign-in, as `AppNavigator`'s `onAuthStateChanged` will handle the redirection.

## Verification Plan

### Manual Verification
- Test Email Sign-in: Ensure it redirects to `EmailVerification` or `MainTabs` correctly.
- Test Google Sign-in: Ensure it redirects to `ProfileSetup` (if new user) or `MainTabs` (if existing user) without the "not handled by navigator" error.
- Test Profile Setup: Complete the profile and ensure it transitions to `ContactsPermission`.
- Test Contacts Permission: Click "Allow" or "Skip" and ensure it transitions to `MainTabs`.
