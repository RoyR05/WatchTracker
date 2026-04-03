# Password Change Feature - Visual Wireframes & Mockups

## Table of Contents
1. [Profile Page Overview](#profile-page-overview)
2. [Password Section - Default State](#password-section---default-state)
3. [Password Change Form - Empty State](#password-change-form---empty-state)
4. [Password Change Form - Filling In Progress](#password-change-form---filling-in-progress)
5. [Password Strength States](#password-strength-states)
6. [Error States](#error-states)
7. [Success State](#success-state)
8. [Mobile Views](#mobile-views)

---

## Profile Page Overview

### Desktop View (1440px)
```
┌────────────────────────────────────────────────────────────────────────┐
│  [Navigation Header]                                                    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│    Profile Settings                                                     │
│                                                                         │
│    ┌─────────────────────────────────────────────────────────┐        │
│    │  Profile Information                                     │        │
│    │                                                           │        │
│    │  ┌──┐                                                    │        │
│    │  │JD│  John Doe                                          │        │
│    │  └──┘  Member since Jan 1, 2024                          │        │
│    │                                                           │        │
│    │  Bio                                                      │        │
│    │  Movie enthusiast and TV series addict.                  │        │
│    │                                                           │        │
│    │  [Edit Profile]                                           │        │
│    └─────────────────────────────────────────────────────────┘        │
│                                                                         │
│    ┌─────────────────────────────────────────────────────────┐        │
│    │  Password                                            🔒   │        │
│    │  Change your password to keep your account secure        │        │
│    │                                                           │        │
│    │  [Change Password]                                        │        │
│    └─────────────────────────────────────────────────────────┘        │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Two distinct sections with equal visual weight
- Password section clearly separated
- Lock icon provides visual security cue
- Consistent card design with profile information

---

## Password Section - Default State

### Detailed View
```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│  Password                                                🔒   │
│  Change your password to keep your account secure            │
│                                                               │
│  ┌────────────────────┐                                      │
│  │ Change Password    │                                      │
│  └────────────────────┘                                      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Visual Specifications:**
- Background: Dark gray (#1f2937)
- Title: 18px, Semibold, White
- Description: 14px, Regular, Light gray (#9ca3af)
- Icon: 24x24px, Gray (#9ca3af)
- Button: Blue (#2563eb), White text, 16px
- Padding: 24px all sides
- Border radius: 8px

**Interactive States:**
- Hover: Button background darkens to #1d4ed8
- Focus: 2px blue ring around button
- Active: Slight scale down (0.98)

---

## Password Change Form - Empty State

### Expanded Form View
```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Change Password                                             ✕  │
│                                                                 │
│  Current Password                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Enter current password                              👁   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  New Password                                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Enter new password                                  👁   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ○ At least 6 characters                                       │
│  ○ Uppercase and lowercase letters                             │
│  ○ At least one number                                         │
│                                                                 │
│  Confirm New Password                                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Confirm new password                                👁   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────────────────────────┐  │
│  │   Cancel     │  │      Change Password                  │  │
│  └──────────────┘  └──────────────────────────────────────┘  │
│                                                                 │
│  ℹ Your password is encrypted and secure. After changing       │
│  your password:                                                 │
│  • You'll remain logged in on this device                      │
│  • You may be logged out of other devices                      │
│  • Use your new password for future logins                     │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Element Specifications:**

**Header:**
- Title: 18px, Semibold, White
- Close button: 20x20px, Gray on hover white
- Bottom margin: 24px

**Input Fields:**
- Height: 48px
- Background: #374151 (gray-700)
- Border: 1px #4b5563 (gray-600)
- Text: 16px, White
- Placeholder: 14px, Gray-400
- Border radius: 8px
- Padding: 12px 48px 12px 16px (right padding for eye icon)

**Eye Icon Button:**
- Position: Absolute right 12px
- Size: 20x20px
- Color: Gray-400, hover White
- No focus ring (decorative)

**Validation Checklist:**
- Font: 12px
- Unchecked: Gray-400 with ○
- Line height: 1.5
- Spacing: 6px between items

**Buttons:**
- Height: 48px
- Font: 16px, Medium weight
- Cancel: Gray-700, hover Gray-600
- Submit: Blue-600, hover Blue-700, disabled 50% opacity
- Border radius: 8px
- Gap: 12px

**Info Section:**
- Border top: 1px Gray-700
- Padding top: 24px
- Margin top: 24px
- Font: 12px
- Color: Gray-400
- Icon: 16x16px info circle

---

## Password Change Form - Filling In Progress

### With Strong Password
```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Change Password                                             ✕  │
│                                                                 │
│  Current Password                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ••••••••••••                                        👁   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  New Password                                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ••••••••••••••                                      👁   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Password strength:                              Strong        │
│  ████████████████████████████████████░░░░  (90%)              │
│                                                                 │
│  ✓ At least 6 characters                                       │
│  ✓ Uppercase and lowercase letters                             │
│  ✓ At least one number                                         │
│                                                                 │
│  Confirm New Password                                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ••••••••••••••                                      ✓   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────────────────────────┐  │
│  │   Cancel     │  │      Change Password                  │  │
│  └──────────────┘  └──────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**New Elements:**

**Password Strength Bar:**
- Height: 8px
- Background: Gray-700
- Fill: Animated width transition (300ms)
- Border radius: 4px
- Fill color based on strength:
  - Red (#ef4444): 0-40%
  - Yellow (#eab308): 41-60%
  - Blue (#3b82f6): 61-80%
  - Green (#22c55e): 81-100%

**Strength Label:**
- Position: Right aligned
- Font: 12px, Medium
- Color matches fill color
- Text: Weak / Fair / Good / Strong

**Validated Checklist:**
- Checkmark: Green-400 (✓)
- Text: Green-400
- Smooth transition

**Matching Confirmation:**
- Checkmark icon instead of eye when passwords match
- Green color indicates success

---

## Password Strength States

### Weak Password (< 40%)
```
Password strength:                                    Weak
████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  (25%)

○ At least 6 characters
✓ Uppercase and lowercase letters
○ At least one number
```
- Color: Red (#ef4444)
- Bar width: 25%
- Label: "Weak" in red

### Fair Password (41-60%)
```
Password strength:                                    Fair
████████████████████░░░░░░░░░░░░░░░  (50%)

✓ At least 6 characters
✓ Uppercase and lowercase letters
○ At least one number
```
- Color: Yellow (#eab308)
- Bar width: 50%
- Label: "Fair" in yellow

### Good Password (61-80%)
```
Password strength:                                    Good
████████████████████████████░░░░░░░  (70%)

✓ At least 6 characters
✓ Uppercase and lowercase letters
✓ At least one number
```
- Color: Blue (#3b82f6)
- Bar width: 70%
- Label: "Good" in blue

### Strong Password (81-100%)
```
Password strength:                                  Strong
████████████████████████████████████░  (90%)

✓ At least 6 characters
✓ Uppercase and lowercase letters
✓ At least one number
```
- Color: Green (#22c55e)
- Bar width: 90%
- Label: "Strong" in green

---

## Error States

### Incorrect Current Password
```
┌────────────────────────────────────────────────────────────────┐
│  Current Password                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ••••••••••••                                        👁   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [... other fields ...]                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ⚠  Current password is incorrect                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────────────────────────┐  │
│  │   Cancel     │  │      Change Password                  │  │
│  └──────────────┘  └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

**Error Box:**
- Background: Red-500 with 10% opacity (#ef444419)
- Border: 1px Red-500 with 50% opacity
- Padding: 12px
- Border radius: 8px
- Icon: Alert circle, 20px, Red-400
- Text: 14px, Red-400
- Margin: 16px 0

### Password Mismatch
```
┌────────────────────────────────────────────────────────────────┐
│  Confirm New Password                                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ••••••••••••••                                      👁   │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Passwords do not match                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ⚠  New passwords do not match                           │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

**Inline Error:**
- Font: 12px
- Color: Red-400
- Position: Below input field
- Margin top: 8px

### Weak Password Error
```
┌────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ⚠  New password must have: At least 6 characters,       │  │
│  │     One uppercase letter, One number                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────────────────────────┐  │
│  │   Cancel     │  │      Change Password                  │  │
│  └──────────────┘  └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## Success State

### Toast Notification
```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                      ┌────────────────────────┐│
│                                      │ ✓ Password changed     ││
│                                      │   successfully         ││
│                                      └────────────────────────┘│
│                                                                 │
│  Profile Settings                                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Password                                            🔒   │  │
│  │  Change your password to keep your account secure        │  │
│  │                                                           │  │
│  │  [Change Password]                                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Toast Notification:**
- Position: Fixed top-right
- Background: Green-600 with 95% opacity
- Border: None
- Border radius: 8px
- Padding: 16px 24px
- Icon: Checkmark circle, 20px, White
- Text: 14px, White, Medium weight
- Duration: 4 seconds
- Animation: Slide in from right, fade out

**Post-Success:**
- Form collapsed back to default state
- All fields cleared
- User remains on profile page
- Session continues

---

## Mobile Views

### Mobile Default State (375px)
```
┌─────────────────────────────────────┐
│  [☰]  Profile Settings        [👤]  │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Profile Information           │ │
│  │                               │ │
│  │  ┌──┐                         │ │
│  │  │JD│  John Doe               │ │
│  │  └──┘  Member since...        │ │
│  │                               │ │
│  │  Bio                          │ │
│  │  Movie enthusiast...          │ │
│  │                               │ │
│  │  [Edit Profile]               │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Password                  🔒  │ │
│  │ Change your password to       │ │
│  │ keep your account secure      │ │
│  │                               │ │
│  │  [Change Password]            │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

**Mobile Adjustments:**
- Reduced padding: 16px
- Full-width buttons
- Larger touch targets (48px minimum)
- Stacked layout
- Reduced font sizes slightly

### Mobile Form Expanded (375px)
```
┌─────────────────────────────────────┐
│  ┌───────────────────────────────┐ │
│  │ Change Password            ✕  │ │
│  │                               │ │
│  │ Current Password              │ │
│  │ ┌───────────────────────────┐ │ │
│  │ │ Enter current password 👁 │ │ │
│  │ └───────────────────────────┘ │ │
│  │                               │ │
│  │ New Password                  │ │
│  │ ┌───────────────────────────┐ │ │
│  │ │ Enter new password     👁 │ │ │
│  │ └───────────────────────────┘ │ │
│  │                               │ │
│  │ Password strength:     Good   │ │
│  │ ████████████████░░░░  (70%)   │ │
│  │                               │ │
│  │ ✓ At least 6 characters       │ │
│  │ ✓ Uppercase and lowercase     │ │
│  │ ✓ At least one number         │ │
│  │                               │ │
│  │ Confirm New Password          │ │
│  │ ┌───────────────────────────┐ │ │
│  │ │ Confirm password       👁 │ │ │
│  │ └───────────────────────────┘ │ │
│  │                               │ │
│  │ ┌───────────────────────────┐ │ │
│  │ │ Cancel                    │ │ │
│  │ └───────────────────────────┘ │ │
│  │ ┌───────────────────────────┐ │ │
│  │ │ Change Password           │ │ │
│  │ └───────────────────────────┘ │ │
│  │                               │ │
│  │ ℹ Your password is encrypted │ │
│  │ and secure...                 │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Mobile Form Adjustments:**
- Buttons stack vertically
- Full width buttons
- Increased vertical spacing
- Larger text in strength bar
- Simplified info text
- Reduced checklist font size

### Mobile Loading State (375px)
```
┌─────────────────────────────────────┐
│  ┌───────────────────────────────┐ │
│  │                               │ │
│  │ [Disabled fields greyed out]  │ │
│  │                               │ │
│  │ ┌───────────────────────────┐ │ │
│  │ │ Cancel                    │ │ │
│  │ └───────────────────────────┘ │ │
│  │ ┌───────────────────────────┐ │ │
│  │ │ ⟳ Changing Password...    │ │ │
│  │ └───────────────────────────┘ │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Loading Indicators:**
- Spinner animation in button
- Button text: "Changing Password..."
- All inputs disabled (opacity 50%)
- Cannot interact with form

### Mobile Success Toast (375px)
```
┌─────────────────────────────────────┐
│  ┌───────────────────────────────┐ │
│  │ ✓ Password changed            │ │
│  │   successfully                │ │
│  └───────────────────────────────┘ │
│                                     │
│  Profile Settings                   │
│                                     │
│  [Profile section collapsed]        │
│                                     │
└─────────────────────────────────────┘
```

**Mobile Toast:**
- Full width minus 16px margin
- Positioned at top
- 3 second duration
- Slide down animation

---

## Interactive States Summary

### Button States
```
Default:        [Change Password]
Hover:          [Change Password]  (darker background)
Focus:          [Change Password]  (blue ring)
Active:         [Change Password]  (slightly pressed)
Disabled:       [Change Password]  (50% opacity, no pointer)
Loading:        [⟳ Changing...]    (spinner, disabled)
```

### Input States
```
Empty:          [                    ]
Focus:          [|                   ]  (blue ring, cursor)
Filled:         [••••••••••          ]  (masked)
Revealed:       [MyP@ssw0rd          ]  (visible)
Error:          [••••••••••          ]  (red border)
Disabled:       [••••••••••          ]  (50% opacity)
```

### Icon States
```
Eye (hidden):   👁  (show password)
Eye (visible):  👁‍🗨  (hide password)
Checkmark:      ✓  (requirement met / match confirmed)
Circle:         ○  (requirement not met)
X:              ✕  (close form)
Lock:           🔒  (security indicator)
Alert:          ⚠  (error indicator)
Info:           ℹ  (information)
```

---

## Color Palette Reference

### Primary Colors
- Blue-600: `#2563eb` (primary button)
- Blue-700: `#1d4ed8` (primary button hover)
- Blue-500: `#3b82f6` (focus ring, good strength)

### Gray Scale
- Gray-900: `#111827` (background)
- Gray-800: `#1f2937` (card background)
- Gray-700: `#374151` (input background, secondary button)
- Gray-600: `#4b5563` (input border, secondary button hover)
- Gray-400: `#9ca3af` (placeholder, unchecked items)
- Gray-300: `#d1d5db` (labels)

### Semantic Colors
- Red-500: `#ef4444` (weak password, errors)
- Red-400: `#f87171` (error text)
- Yellow-500: `#eab308` (fair password)
- Yellow-400: `#facc15` (fair password text)
- Green-600: `#16a34a` (success toast background)
- Green-500: `#22c55e` (strong password)
- Green-400: `#4ade80` (success text, checked items)

### Text Colors
- White: `#ffffff` (primary text)
- Gray-400: `#9ca3af` (secondary text)
- Gray-300: `#d1d5db` (labels)

---

## Animation Specifications

### Form Expand/Collapse
```css
transition: height 200ms ease-in-out,
            opacity 150ms ease-in-out;
```

### Strength Bar Fill
```css
transition: width 300ms ease-out,
            background-color 300ms ease-out;
```

### Button Hover
```css
transition: background-color 150ms ease-in-out;
```

### Toast Enter/Exit
```css
/* Enter */
animation: slideInRight 200ms ease-out;

/* Exit */
animation: fadeOut 200ms ease-in;
```

---

## Wireframe Legend

### Symbols Used
```
[Button]          - Clickable button
┌───┐            - Container/border
│   │            - Content area
••••             - Masked password
👁               - Eye icon (toggle visibility)
🔒               - Lock icon (security)
✓                - Checkmark (success/completed)
○                - Circle (incomplete)
✕                - Close/cancel
⚠                - Warning/error
ℹ                - Information
⟳                - Loading spinner
████             - Progress bar (filled)
░░░░             - Progress bar (empty)
```

### Interactive Elements
```
Clickable:        Blue buttons, eye icons, close button
Editable:         Input fields (text/password)
Visual feedback:  Strength bar, checkmarks, errors
Information:      Helper text, tooltips (future)
```

---

## Implementation Notes

These wireframes represent the final implemented design. All measurements, colors, and interactions have been coded and tested. The actual implementation includes:

- Smooth CSS transitions
- Proper focus management
- Keyboard navigation
- Screen reader support
- Responsive breakpoints
- Touch-friendly interactions

For detailed technical specifications, refer to `PASSWORD_CHANGE_DESIGN_SPEC.md`.
