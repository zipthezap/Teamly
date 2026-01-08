# Testing Guide for Invite Link Improvements

## Overview
This guide helps test all the new features added to improve event invite links.

## Prerequisites
- Application running (backend + frontend)
- At least one user account
- At least one group created

## Test Scenarios

### 1. Public Event Invite Link

#### Setup
1. Login as a user
2. Navigate to a group you're a member of
3. Create a new public event (check "Public Event" checkbox)
4. Navigate to the event details page

#### Test Steps

**A. Generate Invite Link**
- [ ] Click "Generate Invite Link" button
- [ ] Verify link appears in text field
- [ ] Verify success message appears

**B. Copy Link**
- [ ] Click "Copy Link" button
- [ ] Verify "Invite link copied to clipboard!" message appears
- [ ] Paste in notepad - verify URL format: `http://localhost:3001/events/join/{token}`

**C. QR Code**
- [ ] Click "QR Code" button
- [ ] Verify dialog opens with QR code
- [ ] Verify QR code is scannable (use phone camera)
- [ ] Verify copy button works in dialog

**D. Share Options**
- [ ] Click "Share Options" button
- [ ] Verify dialog shows WhatsApp, Telegram, Email options
- [ ] Click WhatsApp - verify opens with pre-filled message
- [ ] Click Telegram - verify opens with event info
- [ ] Click Email - verify opens mail client with subject and body
- [ ] Verify inline copy button works

**E. Visual Indicators**
- [ ] Verify "💡 Anyone with this link can join" message shows
- [ ] Verify "🌐 Public Event" badge shows in event details

### 2. Private Event Invite Link

#### Setup
1. Create a new PRIVATE event (uncheck "Public Event")
2. Navigate to event details

#### Test Steps

**A. Generate Link for Private Event**
- [ ] Verify "Generate Invite Link" button is available
- [ ] Click to generate link
- [ ] Verify 🔒 indicator shows "Private Event Link"
- [ ] Verify message: "Only people with this link can access"

**B. Access Control**
- [ ] Copy invite link
- [ ] Open in incognito/private browsing window
- [ ] Verify event is accessible via link
- [ ] Try to find event in public listings - should NOT appear
- [ ] Verify event details show correctly

**C. Join as Guest**
- [ ] Use invite link in incognito window
- [ ] Enter guest name
- [ ] Click "Join as Guest"
- [ ] Verify success message
- [ ] Verify participant count increases

### 3. Enhanced Join Event Page

#### Setup
1. Generate an invite link for any event
2. Open link in new incognito window (not logged in)

#### Test Steps

**A. Visual Design**
- [ ] Verify gradient hero section (purple gradient)
- [ ] Verify "You're Invited! 🎉" heading
- [ ] Verify event title prominently displayed
- [ ] Verify group name badge
- [ ] Verify all event details cards show correctly

**B. Event Information Cards**
- [ ] Verify "Event Details" card shows:
  - Sport type with icon
  - Date & time with icon
  - Location with icon (if present)
  - Description (if present)

**C. Participants Card**
- [ ] Verify "Participants" card shows:
  - Participant count badge
  - Avatar group with initials
  - Capacity progress bar (if max players set)
  - Text: "X people have joined"

**D. Capacity Indicators**
- [ ] For events with max players:
  - [ ] Verify progress bar shows correct percentage
  - [ ] Verify bar turns red when full
  - [ ] Verify "Event is full" alert shows when capacity reached

**E. Guest Join Form**
- [ ] Verify "Join this Event" card
- [ ] Verify name input field
- [ ] Verify "Join as Guest" button
- [ ] Verify prompt to create account
- [ ] Enter name and join
- [ ] Verify success message with confetti emoji

### 4. One-Click Join for Authenticated Users

#### Setup
1. Generate invite link for an event
2. Open link while logged in (different browser tab)

#### Test Steps

**A. Auto-Detection**
- [ ] Verify welcome message shows: "Welcome back, {name}!"
- [ ] Verify "Join Event Now" button (not guest form)
- [ ] No name input required

**B. Join & Redirect**
- [ ] Click "Join Event Now"
- [ ] Verify loading indicator
- [ ] Verify success message
- [ ] Verify auto-redirect to event details page
- [ ] Verify you appear in participants list

**C. Already Joined Detection**
- [ ] Use same invite link again
- [ ] Verify "You're already participating" alert
- [ ] Verify "View Event" button appears
- [ ] Click button - verify navigates to event details

### 5. Guest Participant Display

#### Setup
1. Event with both regular users and guest participants

#### Test Steps

**A. EventDetails Page - Participants List**
- [ ] Verify regular participants show with blue avatars
- [ ] Verify guest participants show with purple avatars
- [ ] Verify purple border on guest cards
- [ ] Verify "Guest" label under guest names
- [ ] Verify status badges show for both types
- [ ] Verify participant count includes both types

**B. Capacity Calculation**
- [ ] Create event with max 5 players
- [ ] Add 3 regular participants
- [ ] Add 2 guest participants
- [ ] Verify capacity shows "5/5"
- [ ] Verify cannot add more participants

### 6. Mobile Experience

#### Test on Mobile Device or Responsive Mode

**A. QR Code Scanning**
- [ ] Generate QR code on desktop
- [ ] Scan with mobile camera
- [ ] Verify opens join page on mobile
- [ ] Verify responsive layout works
- [ ] Test joining on mobile

**B. Share Options on Mobile**
- [ ] Test WhatsApp share on mobile device
- [ ] Test Telegram share on mobile device
- [ ] Verify pre-filled messages work correctly

**C. Responsive Design**
- [ ] Test at 320px width (mobile)
- [ ] Test at 768px width (tablet)
- [ ] Test at 1024px width (desktop)
- [ ] Verify all cards stack correctly
- [ ] Verify buttons are thumb-friendly

### 7. Error Handling

#### Test Error Scenarios

**A. Invalid Token**
- [ ] Use URL with fake token: `/events/join/invalid-token-123`
- [ ] Verify "Event not found" error
- [ ] Verify "Go to Login" button appears

**B. Full Event**
- [ ] Create event with maxPlayers: 1
- [ ] Join as one user
- [ ] Try to join as guest
- [ ] Verify "Event is full" alert
- [ ] Verify join form is hidden

**C. Clipboard Failures**
- [ ] Disable clipboard permissions in browser
- [ ] Try to copy link
- [ ] Verify fallback method works (manual select+copy)
- [ ] Verify success message still shows

**D. Network Errors**
- [ ] Disconnect network
- [ ] Try to join event
- [ ] Verify appropriate error message
- [ ] Reconnect and retry

### 8. Social Sharing Integration

#### Test Each Platform

**A. WhatsApp**
- [ ] Click WhatsApp share
- [ ] Verify opens with text: "Join me for {title} on {date}! Click here to join: {url}"
- [ ] Send to yourself
- [ ] Click link in WhatsApp
- [ ] Verify opens join page

**B. Telegram**
- [ ] Click Telegram share
- [ ] Verify shows event title
- [ ] Verify includes invite URL
- [ ] Test sharing to channel/chat

**C. Email**
- [ ] Click Email share
- [ ] Verify subject: "Join {eventTitle}"
- [ ] Verify body includes date, title, and link
- [ ] Send email to yourself
- [ ] Click link in email
- [ ] Verify works correctly

### 9. Performance & Usability

**A. Loading States**
- [ ] Verify loading indicators show during:
  - Generating invite link
  - Joining event
  - Copying to clipboard

**B. User Feedback**
- [ ] All success messages auto-dismiss after 3 seconds
- [ ] Error messages stay visible until dismissed
- [ ] All buttons show hover states
- [ ] All interactive elements have proper cursor styles

**C. Accessibility**
- [ ] All buttons have proper labels
- [ ] Icons have aria-labels
- [ ] Dialogs can be closed with Escape key
- [ ] Tab navigation works correctly

## Expected Results

### Success Metrics
- ✅ Users can generate invite links for both public and private events
- ✅ QR codes work for mobile scanning
- ✅ Social sharing integrations work properly
- ✅ Guest users can join without accounts
- ✅ Authenticated users get one-click join
- ✅ All UI elements are responsive
- ✅ Error states are handled gracefully
- ✅ Guest participants display with distinct styling

### Visual Verification Checklist
- [ ] Gradient hero on join page looks appealing
- [ ] Cards have proper spacing and shadows
- [ ] Colors are consistent with app theme
- [ ] Icons are properly sized and aligned
- [ ] Typography hierarchy is clear
- [ ] Progress bars animate smoothly
- [ ] Dialogs are centered and modal
- [ ] Snackbars appear in correct position

## Regression Testing

### Ensure Existing Features Still Work
- [ ] Regular event creation works
- [ ] Group member invitation works
- [ ] Event editing works
- [ ] Event deletion works
- [ ] Leaving events works
- [ ] Participant status updates work
- [ ] Email notifications still send (if configured)

## Browser Compatibility

Test on:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Notes
- Private event links should NOT make events publicly discoverable
- Guest participants count towards capacity limits
- QR codes should be high quality (level H error correction)
- Share messages should be concise and engaging
- All new features should work without breaking existing functionality
