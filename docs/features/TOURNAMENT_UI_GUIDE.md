# Tournament UI Improvements - Visual Guide

## 1. Tournament Details - Enhanced Matches Tab

### Key Features:
- **Date & Time Column**: Shows when each match is scheduled
- **Pool/Stage**: Displays which pool or knockout stage the match belongs to
- **Clickable Teams**: Team names are buttons that navigate to team details
- **Sorted Chronologically**: Matches appear in date/time order
- **Referee Assignment**: Shows which team is refereeing (for manual brackets)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Montreal Winter Hockey Championship                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tabs: [Overview] [Teams] [Pools] [Matches] [Bracket Manager] [Standings]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Date & Time   │ Stage/Pool        │ Home Team     │ Score │ Away Team      │
│───────────────┼───────────────────┼───────────────┼───────┼────────────────│
│ 1/19/2026     │ [Pool A - Elite]  │ 🔗Canadiens Jr│ - : - │ 🔗Nordiques    │
│ 10:00 AM      │                   │               │       │                │
│───────────────┼───────────────────┼───────────────┼───────┼────────────────│
│ 1/19/2026     │ [Pool B - Champ]  │ 🔗Laval       │ - : - │ 🔗Gatineau     │
│ 11:30 AM      │                   │               │       │                │
│───────────────┼───────────────────┼───────────────┼───────┼────────────────│
│ 1/19/2026     │ [Pool A - Elite]  │ 🔗Senators    │ - : - │ 🔗Maple Leafs  │
│ 2:00 PM       │                   │               │       │                │
│───────────────┼───────────────────┼───────────────┼───────┼────────────────│
│ 1/20/2026     │ [Pool A - Elite]  │ 🔗Canadiens Jr│ 4 : 2 │ 🔗Maple Leafs  │
│ 12:00 PM      │                   │               │  ✓    │                │
│               │                   │ Referee: Nordiques Legacy              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Tournament Details - Enhanced Standings Tab

### Key Features:
- **Pool-wise Grouping**: Each pool has its own section with header
- **Medal Indicators**: 🥇🥈🥉 for top 3 positions
- **Visual Highlights**: Top 2 teams have colored backgrounds
- **Goal Difference Colors**: Green (+), Red (-), Black (0)
- **Clickable Teams**: Navigate to team details
- **Comprehensive Stats**: Played, Points, W/D/L, GF/GA/GD

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Pool A - Elite Division                                                    │
├───┬──────────────────┬────────┬────┬───┬───┬───┬────┬────┬─────────────────┤
│ # │ Team             │ Played │ Pts│ W │ D │ L │ GF │ GA │ GD              │
├───┼──────────────────┼────────┼────┼───┼───┼───┼────┼────┼─────────────────┤
│🥇1│🔗Canadiens Jr    │   1    │ 3  │ 1 │ 0 │ 0 │ 4  │ 2  │ +2 (green)      │
│   │ [Light green background]                                               │
├───┼──────────────────┼────────┼────┼───┼───┼───┼────┼────┼─────────────────┤
│🥈2│🔗Nordiques Legacy│   0    │ 0  │ 0 │ 0 │ 0 │ 0  │ 0  │  0              │
│   │ [Light blue background]                                                │
├───┼──────────────────┼────────┼────┼───┼───┼───┼────┼────┼─────────────────┤
│🥉3│🔗Senators Elite  │   0    │ 0  │ 0 │ 0 │ 0 │ 0  │ 0  │  0              │
├───┼──────────────────┼────────┼────┼───┼───┼───┼────┼────┼─────────────────┤
│ 4 │🔗Maple Leafs     │   1    │ 0  │ 0 │ 0 │ 1 │ 2  │ 4  │ -2 (red)        │
└───┴──────────────────┴────────┴────┴───┴───┴───┴────┴────┴─────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Pool B - Championship Division                                             │
├───┬──────────────────┬────────┬────┬───┬───┬───┬────┬────┬─────────────────┤
│ # │ Team             │ Played │ Pts│ W │ D │ L │ GF │ GA │ GD              │
├───┼──────────────────┼────────┼────┼───┼───┼───┼────┼────┼─────────────────┤
│🥇1│🔗Laval Rockets   │   0    │ 0  │ 0 │ 0 │ 0 │ 0  │ 0  │  0              │
│🥈2│🔗Gatineau        │   0    │ 0  │ 0 │ 0 │ 0 │ 0  │ 0  │  0              │
│🥉3│🔗Sherbrooke      │   0    │ 0  │ 0 │ 0 │ 0 │ 0  │ 0  │  0              │
│ 4 │🔗Trois-Rivières  │   0    │ 0  │ 0 │ 0 │ 0 │ 0  │ 0  │  0              │
└───┴──────────────────┴────────┴────┴───┴───┴───┴────┴────┴─────────────────┘
```

## 3. Team Details Page

### Key Features:
- **Breadcrumb Navigation**: Tournaments → Tournament Name → Team Name
- **Team Info Card**: Captain name, contact email
- **Statistics Card**: Matches played, W/D/L, total players
- **Team Roster Table**: All players with registration status
- **Match Schedule Table**: Team's matches with dates, opponents, results

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Tournaments > Montreal Winter Hockey > Montreal Canadiens Jr   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────┐  ┌────────────────────────────────┐│
│ │ Team Information                    │  │ Statistics                     ││
│ ├─────────────────────────────────────┤  ├────────────────────────────────┤│
│ │ 👤 Captain                          │  │ Matches Played:  1             ││
│ │    Captain Canadiens Jr [You]      │  │ Wins:            1 (green)     ││
│ │                                     │  │ Draws:           0 (yellow)    ││
│ │ ✉️  Contact                         │  │ Losses:          0 (red)       ││
│ │    captain.elite.0@montreal.hockey │  │ Total Players:   3             ││
│ └─────────────────────────────────────┘  └────────────────────────────────┘│
│                                                                             │
│ Team Roster                                                                 │
│ ┌───┬──────────────────┬─────────────────────────┬────────────────────────┐│
│ │ # │ Player Name      │ Email                   │ Status                 ││
│ ├───┼──────────────────┼─────────────────────────┼────────────────────────┤│
│ │ 1 │ Alice            │ alice@example.com       │ [Registered] (green)   ││
│ │ 2 │ Marc Johnson     │ marc.johnson@...hockey  │ [Guest] (gray)         ││
│ │ 3 │ Charlie          │ charlie@example.com     │ [Registered] (green)   ││
│ └───┴──────────────────┴─────────────────────────┴────────────────────────┘│
│                                                                             │
│ Match Schedule                                                              │
│ ┌──────────┬──────────────┬──────┬────────┬─────────┬──────────────────────┐│
│ │ Date/Time│ Opponent     │ Role │ Score  │ Result  │ Status               ││
│ ├──────────┼──────────────┼──────┼────────┼─────────┼──────────────────────┤│
│ │1/19/2026 │Nordiques     │[Home]│  -  -  │    -    │ [scheduled]          ││
│ │10:00 AM  │              │      │        │         │                      ││
│ ├──────────┼──────────────┼──────┼────────┼─────────┼──────────────────────┤│
│ │1/20/2026 │Senators      │[Home]│  -  -  │    -    │ [scheduled]          ││
│ │11:00 AM  │              │      │        │         │ (Ref: Nordiques)     ││
│ ├──────────┼──────────────┼──────┼────────┼─────────┼──────────────────────┤│
│ │1/21/2026 │Maple Leafs   │[Home]│ 4 - 2  │[Win]✓   │ [completed] (green)  ││
│ │12:00 PM  │              │      │        │(green)  │                      ││
│ └──────────┴──────────────┴──────┴────────┴─────────┴──────────────────────┘│
│                                                                             │
│                                     [← Back to Tournament]                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4. Tournament Details - Enhanced Teams Tab

### Key Features:
- **Team Name**: Clickable link to team details
- **Pool Column**: Shows which pool the team belongs to (for manual brackets)
- **View Details Button**: Alternative way to navigate to team page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Teams                                                                       │
│ [+ Add Team]                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Team Name             │ Captain                 │ Email               │Pool│
│───────────────────────┼─────────────────────────┼─────────────────────┼────│
│ 🔗Montreal Canadiens  │ Captain Canadiens Jr    │ captain.elite.0@... │ A  │
│   Jr                  │                         │                     │    │
│                                                [View Details >]             │
│───────────────────────┼─────────────────────────┼─────────────────────┼────│
│ 🔗Quebec Nordiques    │ Captain Nordiques       │ captain.elite.1@... │ A  │
│   Legacy              │                         │                     │    │
│                                                [View Details >]             │
│───────────────────────┼─────────────────────────┼─────────────────────┼────│
│ 🔗Laval Rockets       │ Captain Laval Rockets   │ captain.champ.0@... │ B  │
│                                                [View Details >]             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Navigation Flow

```
Tournament List
    │
    ├─→ Tournament Details (Overview)
    │       │
    │       ├─→ Teams Tab ──────────┐
    │       │                       │
    │       ├─→ Pools Tab           │
    │       │                       │
    │       ├─→ Matches Tab ────────┼─→ Click Team Name
    │       │                       │
    │       ├─→ Bracket Manager     │
    │       │                       │
    │       └─→ Standings Tab ──────┘
    │
    └─→ Team Details Page
            │
            ├─→ Team Information
            ├─→ Statistics
            ├─→ Team Roster (Players)
            └─→ Match Schedule
```

## Color Coding

### Match Status
- 🟢 **Completed** - Green
- 🟡 **In Progress** - Yellow/Warning
- ⚪ **Scheduled** - Default/Gray
- 🔴 **Cancelled** - Red

### Match Results
- 🟢 **Win** - Green chip
- 🔴 **Loss** - Red chip
- 🟡 **Draw** - Yellow chip

### Goal Difference
- 🟢 **Positive (+X)** - Green text
- 🔴 **Negative (-X)** - Red text
- ⚫ **Zero (0)** - Black text

### Team Rankings
- 🥇 **1st Place** - Gold medal + light green background
- 🥈 **2nd Place** - Silver medal + light blue background
- 🥉 **3rd Place** - Bronze medal + normal background

### Player Status
- 🟢 **Registered** - Green chip (linked to user account)
- ⚪ **Guest** - Gray chip (no user account)

## Key User Interactions

### From Tournament Page
1. **Click team name** → Navigate to team details
2. **Click pool name** → Filter by pool (in pools tab)
3. **Click match score** → View/edit match details
4. **Click breadcrumb** → Navigate up the hierarchy

### From Team Page
1. **Click breadcrumb** → Go back to tournament or tournament list
2. **Click opponent name** → Navigate to opponent's team page
3. **View roster** → See all registered and guest players
4. **View schedule** → See all matches for this team

### Responsive Features
- Tables are horizontally scrollable on small screens
- Cards stack vertically on mobile
- Breadcrumbs collapse on narrow screens
- Buttons adapt to available space
