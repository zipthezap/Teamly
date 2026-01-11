# Visual Guide: OAuth and Profile Settings Improvements

## Profile Settings Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                     Profile Settings                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Two-Factor Authentication                              │   │
│  │  [Existing 2FA settings]                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Connected Accounts                            [NEW!]   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ℹ️ Primary authentication method: google               │   │
│  │                                                          │   │
│  │  🔵 Google             ✅ Connected      [Unlink]       │   │
│  │  Your Google account is connected and can be            │   │
│  │  used for sign in                                       │   │
│  │                                                          │   │
│  │  📘 Facebook                            [Link Account]   │   │
│  │  Link your Facebook account for easy sign in           │   │
│  │                                                          │   │
│  │  ────────────────────────────────────────────────       │   │
│  │  Profile Picture Sync                                   │   │
│  │  Use your profile picture from connected OAuth account │   │
│  │  [Sync from OAuth]                                      │   │
│  │  Last synced: 1/11/2026                                 │   │
│  │                                                          │   │
│  │  ⚠️ Warning: You don't have a password set.            │   │
│  │  Consider setting a password as backup login method.    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────┐  ┌──────────────────────────┐   │
│  │  Profile Information     │  │  Set Password      [NEW!]│   │
│  │  [Picture upload]        │  │                          │   │
│  │  Name: [John Doe]        │  │  ℹ️ You signed up using  │   │
│  │  Email: [john@gmail.com] │  │  google. Setting a       │   │
│  │  City: [Seattle]         │  │  password will allow you │   │
│  │  Country: [USA]          │  │  to sign in with email   │   │
│  │  Address: [123 Main St]  │  │  and password as well.   │   │
│  │  Postal: [98101]         │  │                          │   │
│  │  Radius: [25 km]         │  │  New Password:           │   │
│  │  [Update Profile]        │  │  [************]          │   │
│  └──────────────────────────┘  │  Confirm Password:       │   │
│                                 │  [************]          │   │
│                                 │  [Set Password]          │   │
│                                 └──────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Notification Preferences                               │   │
│  │  [Existing notification settings]                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## OAuth Connection States

### State 1: Multiple Authentication Methods
```
┌─────────────────────────────────────────────────────────┐
│  Connected Accounts                                     │
├─────────────────────────────────────────────────────────┤
│  ℹ️ Primary authentication method: local                │
│                                                          │
│  🔵 Google             ✅ Connected      [Unlink]       │
│  Your Google account is connected and can be            │
│  used for sign in                                       │
│                                                          │
│  📘 Facebook           ✅ Connected      [Unlink]       │
│  Your Facebook account is connected and can be          │
│  used for sign in                                       │
└─────────────────────────────────────────────────────────┘

✅ All unlink buttons enabled (user has email/password as fallback)
```

### State 2: Single OAuth Account (Cannot Unlink)
```
┌─────────────────────────────────────────────────────────┐
│  Connected Accounts                                     │
├─────────────────────────────────────────────────────────┤
│  ℹ️ Primary authentication method: google               │
│                                                          │
│  🔵 Google             ✅ Connected   [Unlink] (disabled)│
│  Your Google account is connected and can be            │
│  used for sign in                                       │
│                                                          │
│  📘 Facebook                            [Link Account]   │
│  Link your Facebook account for easy sign in           │
│                                                          │
│  ⚠️ Warning: You don't have a password set.            │
│  Consider setting a password as backup login method.    │
└─────────────────────────────────────────────────────────┘

🔒 Unlink button disabled (cannot remove last auth method)
```

## Unlink Confirmation Dialog

```
┌────────────────────────────────────────────┐
│  Unlink Google Account?                    │
├────────────────────────────────────────────┤
│                                            │
│  Are you sure you want to unlink your     │
│  Google account? You will no longer be    │
│  able to sign in using this provider.     │
│                                            │
│              [Cancel]  [Unlink]            │
└────────────────────────────────────────────┘
```

## Cannot Unlink Dialog

```
┌────────────────────────────────────────────┐
│  Unlink Google Account?                    │
├────────────────────────────────────────────┤
│                                            │
│  Are you sure you want to unlink your     │
│  Google account? You will no longer be    │
│  able to sign in using this provider.     │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ ⚠️ ERROR                             │ │
│  │ You cannot unlink this account as    │ │
│  │ it's your only authentication method.│ │
│  │ Please set a password or link        │ │
│  │ another account first.               │ │
│  └──────────────────────────────────────┘ │
│                                            │
│              [Cancel]  [Unlink] (disabled) │
└────────────────────────────────────────────┘
```

## Password Forms

### For OAuth-only Users (No Password Set)
```
┌────────────────────────────────────────────┐
│  Set Password                              │
├────────────────────────────────────────────┤
│  ℹ️ You signed up using google. Setting a  │
│  password will allow you to sign in with   │
│  email and password as well.               │
│                                            │
│  New Password:                             │
│  [*************]                           │
│  Minimum 8 characters with uppercase,      │
│  lowercase, number, and special character  │
│                                            │
│  Confirm Password:                         │
│  [*************]                           │
│                                            │
│  [Set Password]                            │
└────────────────────────────────────────────┘

✨ No "Current Password" field required
```

### For Users with Existing Password
```
┌────────────────────────────────────────────┐
│  Change Password                           │
├────────────────────────────────────────────┤
│  Current Password:                         │
│  [*************]                           │
│                                            │
│  New Password:                             │
│  [*************]                           │
│  Minimum 8 characters with uppercase,      │
│  lowercase, number, and special character  │
│                                            │
│  Confirm New Password:                     │
│  [*************]                           │
│                                            │
│  [Update Password]                         │
└────────────────────────────────────────────┘

🔒 Current password required
```

## Login/Register Pages (Existing)

### Login Page
```
┌────────────────────────────────────────────┐
│              Login                         │
├────────────────────────────────────────────┤
│                                            │
│  [Sign in with Google]                    │
│  [Sign in with Facebook]                  │
│                                            │
│  ──── Or continue with email ────         │
│                                            │
│  Email: [user@example.com]                │
│  Password: [************]                 │
│                                            │
│  [Login]                                  │
│                                            │
│  Don't have an account? Sign up here      │
└────────────────────────────────────────────┘
```

## API Endpoints Summary

### New Endpoints
```
GET    /api/auth/oauth/status
       Returns: {
         connections: { google: true, facebook: false, local: true },
         primaryProvider: 'google',
         lastOAuthSync: '2026-01-11T15:30:00Z',
         hasOAuthProfilePicture: true
       }

POST   /api/auth/oauth/unlink
       Body: { provider: 'google' | 'facebook' }
       Returns: { message: 'Account unlinked successfully' }

POST   /api/auth/oauth/sync-picture
       Returns: { 
         user: { ...profileData },
         message: 'Profile picture synced from OAuth provider'
       }
```

### Enhanced Endpoints
```
GET    /api/auth/profile
       Now includes: authProvider, googleId, facebookId, lastOAuthSync

PUT    /api/auth/password
       Body: { 
         currentPassword: string (optional for OAuth-only users),
         newPassword: string 
       }
```

## User Flows

### Flow 1: Link Additional OAuth Account
```
User on Profile Page
    ↓
Clicks "Link Account" for Facebook
    ↓
Redirects to Facebook OAuth
    ↓
User authorizes on Facebook
    ↓
Redirects back to Profile Page
    ↓
Facebook shows as ✅ Connected
```

### Flow 2: Unlink OAuth Account
```
User on Profile Page
    ↓
Clicks "Unlink" for Google
    ↓
Confirmation Dialog appears
    ↓
User confirms
    ↓
System validates other auth methods exist
    ↓
Account unlinked
    ↓
Google shows as "Link Account" button
```

### Flow 3: Sync OAuth Profile Picture
```
User on Profile Page (has OAuth connected)
    ↓
Sees "Profile Picture Sync" section
    ↓
Clicks "Sync from OAuth"
    ↓
Profile picture updates
    ↓
Last sync timestamp updates
    ↓
Success message shown
```

### Flow 4: OAuth User Sets Password
```
OAuth-only user on Profile Page
    ↓
Sees "Set Password" form (not "Change Password")
    ↓
No current password field shown
    ↓
Enters new password twice
    ↓
Clicks "Set Password"
    ↓
Password saved
    ↓
Can now login with email/password OR OAuth
```

## Color Scheme

### OAuth Provider Colors
- **Google:** #4285F4 (Blue)
- **Facebook:** #1877F2 (Blue)

### Status Colors
- **Connected:** Green (#4CAF50)
- **Not Connected:** Gray (#757575)
- **Warning:** Orange (#FF9800)
- **Error:** Red (#F44336)

### Icons
- **Connected:** ✅ CheckCircleIcon
- **Link:** 🔗 LinkIcon
- **Unlink:** 🔓 LinkOffIcon
- **Sync:** 🔄 SyncIcon
- **Google:** 🔵 GoogleIcon
- **Facebook:** 📘 FacebookIcon
