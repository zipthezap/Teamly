# Manual Tournament Management - User Guide

## Overview

As a tournament organizer, you now have complete control over how your tournament is structured and managed. This guide will walk you through the powerful features available for manual bracket and pool management.

## What Can You Do?

### Full Control Over Tournament Structure
- **Create Custom Pools**: Build pools exactly how you want them, assign teams manually
- **Custom Brackets**: Create any bracket structure, not limited to standard formats
- **Edit Matches Anytime**: Change teams, reschedule matches, modify stages
- **Delete Matches**: Remove matches that are no longer needed
- **Assign Referees**: Designate teams to referee matches when they're on break

## Getting Started

### Step 1: Enable Manual Bracket Management

1. Navigate to your tournament details page
2. As the organizer, you'll see a toggle switch labeled **"Manual Bracket Management"**
3. Turn on the toggle to enable manual management
4. Once enabled, you'll see new tabs: **Pools** and **Bracket Manager**

![Manual Bracket Toggle](../images/manual-bracket-toggle.png)

**Important**: Once enabled and matches are created, you cannot switch back to auto-generated brackets without deleting existing matches.

## Managing Pools

Pools are groups of teams that play against each other in the group stage.

### Creating Pools

1. Click on the **Pools** tab
2. You'll see all your teams listed as "Unassigned Teams"
3. Click the edit icon next to any team
4. In the dialog, enter:
   - **Pool Number**: A numeric identifier (e.g., 1, 2, 3)
   - **Pool Name**: A friendly name (e.g., "Pool A", "Group 1")
5. Click **Assign**

### Pool Management Tips

- **Balanced Pools**: Try to keep pools roughly equal in size
- **Naming Convention**: Use consistent naming (all Pool A/B/C or all Group 1/2/3)
- **Strategic Assignment**: Consider team strengths when assigning pools
- **Easy Reassignment**: You can change a team's pool assignment anytime

### Pool Visualization

Teams are grouped visually by their pools, making it easy to see:
- How many teams are in each pool
- Which teams are still unassigned
- The overall pool structure

## Managing Brackets

The Bracket Manager gives you complete control over match creation and scheduling.

### Creating a Match

1. Go to the **Bracket Manager** tab
2. Click **Create Match**
3. Fill in the match details:
   - **Home Team**: Select from dropdown
   - **Away Team**: Select from dropdown (must be different from home team)
   - **Stage**: Choose the bracket stage (Group Stage, Quarter Finals, etc.)
   - **Group Name**: Optional, for group stage matches (e.g., "A", "B")
   - **Scheduled Time**: Optional, set when the match should be played
4. Click **Create**

### Editing a Match

1. Find the match in the Bracket Manager
2. Click the **Edit** icon (pencil)
3. Modify any field:
   - Change teams
   - Update stage
   - Reschedule time
   - Change group assignment
4. Click **Update**

**Note**: You can edit matches even after they're scheduled, but before they're completed.

### Deleting a Match

1. Find the match you want to delete
2. Click the **Delete** icon (trash can)
3. Confirm the deletion

**Restrictions**:
- Cannot delete completed matches that have scores
- Remove scores first if you need to delete a completed match

## Referee Assignment

A unique feature that lets you assign teams to referee matches when they're not playing.

### Why Assign Referees?

- **Fair Play**: Ensures impartial officiating
- **Team Engagement**: Keeps teams involved even when not playing
- **Tournament Flow**: Helps manage the tournament schedule better
- **Shared Responsibility**: Distributes referee duties fairly

### How to Assign a Referee

1. In the Bracket Manager, find the match
2. Click the **Referee** icon (whistle/sports ball)
3. From the dropdown, select an available team
   - Only teams NOT playing in that match are shown
4. Click **Assign**

### Referee Assignment Tips

- **Rotation**: Rotate referee duties among all teams
- **Break Times**: Assign teams that are on break
- **Never Self-Referee**: System prevents teams from refereeing their own matches
- **Remove Assignment**: Select "None" from dropdown to remove a referee

### Viewing Referee Assignments

On the **Matches** tab, you'll see a "Referee" column showing which team is officiating each match (if assigned).

## Match Scheduling

### Best Practices

1. **Adequate Spacing**: Leave enough time between matches
2. **Pool Stages First**: Complete pool stages before knockout rounds
3. **Parallel Matches**: You can schedule multiple matches at the same time if you have multiple venues
4. **Buffer Time**: Add buffer time for potential delays

### Flexible Scheduling

Unlike auto-generated brackets, you can:
- Schedule matches in any order
- Create matches on different days
- Run parallel tracks if needed
- Adjust on the fly

## Common Workflows

### Workflow 1: Traditional Group + Knockout

1. Enable manual brackets
2. Create pools (Pool A, Pool B, Pool C, Pool D)
3. Assign teams to pools
4. Create group stage matches (all teams play within their pool)
5. After group stage completes, create knockout matches
6. Top teams from each pool advance to quarters

### Workflow 2: Custom Swiss System

1. Enable manual brackets
2. Create Round 1 matches (random pairings)
3. After Round 1, create Round 2 matches based on results
4. Continue creating rounds based on standings
5. Assign referees from teams with byes

### Workflow 3: Progressive Elimination

1. Enable manual brackets
2. Create all Round 1 matches
3. As matches complete, create next round matches
4. Manually advance winners to appropriate bracket positions
5. Adjust bracket as needed based on results

## Teams Tab Enhancements

When manual brackets are enabled, the Teams tab shows:
- All standard team information
- **Pool Assignment**: Shows which pool each team belongs to

You can still add and manage teams normally, but now you can also assign them to pools.

## Matches Tab Enhancements

The Matches tab now shows:
- All standard match information
- **Referee**: Shows which team is refereeing (if assigned)
- Better visibility into match structure

## Tips and Tricks

### 1. Plan Your Structure First
Before creating matches, plan out:
- How many pools you want
- Pool sizes
- Number of rounds
- Knockout structure

### 2. Use Group Names Consistently
If you're using group stage matches, use the same group name format:
- ✅ "A", "B", "C", "D"
- ✅ "1", "2", "3", "4"
- ❌ Mix of "A", "Group B", "Pool 3"

### 3. Leverage Match Order
Use the `matchOrder` field to control how matches are displayed:
- Lower numbers appear first
- Helps organize complex brackets
- Useful for parallel tracks

### 4. Referee Rotation Strategy
Create a fair referee rotation:
- Track who has refereed how many matches
- Ensure all teams referee roughly equal amounts
- Consider team skill levels for important matches

### 5. Flexible Rescheduling
Unlike auto-generated brackets, you can:
- Reschedule any match anytime
- Swap teams if needed
- Completely restructure if tournament format changes

### 6. Combine with Auto-Generated
You can start with auto-generated brackets, then:
- Enable manual management
- Edit specific matches
- Add custom matches
- Mix both approaches

## Troubleshooting

### "Can't assign team to referee their own match"
**Solution**: Choose a different team. The system prevents teams from refereeing matches they're playing in.

### "Can't delete completed match"
**Solution**: Matches with scores can't be deleted. Remove the scores first if you really need to delete it.

### "Home and away teams must be different"
**Solution**: You selected the same team twice. Choose different teams for home and away.

### Missing Tabs (Pools, Bracket Manager)
**Solution**: Make sure "Manual Bracket Management" toggle is turned ON, and you are the tournament organizer.

## Advanced Features

### Multi-Day Tournaments
Schedule matches across multiple days by setting specific scheduled times for each match.

### Multiple Venues
Use the `groupName` or `matchOrder` to organize matches by venue if you're running parallel tracks.

### Seeding (Future Feature)
The `seedNumber` field on teams is available for future seeding features.

### Custom Stages
While predefined stages exist (Quarter Finals, etc.), you can use `groupName` for completely custom stage names.

## Security and Permissions

- **Organizer Only**: Only the tournament organizer can use manual bracket management
- **Team Captains**: Still can't edit brackets, only submit scores for their matches
- **Read-Only View**: Non-organizers see the matches but can't edit them

## Summary

Manual bracket management gives you:
- ✅ Complete control over tournament structure
- ✅ Flexibility to change anything, anytime
- ✅ Ability to create custom formats
- ✅ Referee assignment for fair play
- ✅ Pool-based organization
- ✅ No limitations on creativity

Use this power wisely to create the perfect tournament experience for your participants!

## Need Help?

If you encounter issues or have questions:
1. Check this guide first
2. Review the API documentation at `docs/MANUAL_BRACKET_MANAGEMENT.md`
3. Contact support with specific details about your tournament

Happy organizing! 🏆
