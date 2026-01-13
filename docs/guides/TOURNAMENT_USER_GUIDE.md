# Tournament Feature - User Guide

## Introduction

The Tournament feature allows you to organize and manage competitive tournaments with automatic bracket generation, score tracking, and real-time standings. Perfect for organizing sports competitions within your groups!

## Getting Started

### 1. Access Tournaments

Click on the **Tournaments** link in the navigation bar to view all tournaments.

### 2. Browse Tournaments

The tournaments list shows:
- Tournament name and description
- Status (Draft, Registration, In Progress, Completed, Cancelled)
- Sport type
- Start date
- Location
- Number of teams

You can filter tournaments by:
- Group
- Status
- Sport type

### 3. Create a Tournament

Click the **Create Tournament** button to start:

#### Basic Information
- **Name**: Give your tournament a descriptive name (e.g., "Summer Basketball League")
- **Description**: Add details about the tournament
- **Sport Type**: Choose from football, basketball, tennis, volleyball, and more

#### Tournament Format
Choose from 4 formats:

1. **Single Elimination**
   - Standard knockout bracket
   - Lose once and you're out
   - Fast-paced tournament
   - Best for many teams

2. **Double Elimination**
   - Teams get a second chance
   - Winners and losers brackets
   - More fair than single elimination

3. **Round Robin**
   - Every team plays every other team
   - Most fair format
   - Best for 4-8 teams
   - Winner by total points

4. **Groups + Knockout**
   - Group stage (like World Cup)
   - Top teams advance to knockout
   - Best for 16+ teams
   - Combines fairness with excitement

#### Schedule & Location
- **Start Date**: When the tournament begins
- **End Date**: When it finishes (optional)
- **Location**: Where matches will be played
- **City & Country**: Tournament location

#### Teams
- **Maximum Teams**: Limit number of participants (optional)

### 4. Add Teams

Once created, add teams to your tournament:

1. Click **Add Team** button
2. Enter team information:
   - **Team Name**: Required
   - **Captain Name**: Optional
   - **Captain Email**: Optional
   - **Captain User**: Link to platform user (optional)

Teams can be added until you generate brackets.

### 5. Generate Brackets

When all teams are registered:

1. Click **Generate Brackets** button
2. System automatically creates matches based on format:
   - **Single Elimination**: Creates knockout bracket
   - **Round Robin**: Creates all possible matchups
   - **Groups + Knockout**: Distributes teams into groups

⚠️ **Warning**: This cannot be undone! Once brackets are generated, the tournament status changes to "In Progress" and you cannot add/remove teams.

### 6. Submit Match Scores

During the tournament:

1. Go to **Matches** tab
2. Find the match you want to score
3. Click **Enter Score** or **Update Score**
4. Enter home and away team scores
5. Click **Submit Score**

**Who can submit scores:**
- Tournament organizer (you)
- Team captains

**What happens:**
- Match status changes to "Completed"
- Standings automatically update
- For knockout tournaments, winners advance to next round

### 7. View Standings

The **Standings** tab shows:

| Rank | Team | Points | W | D | L | GF | GA | GD |
|------|------|--------|---|---|---|----|----|-----|
| 1 | Team A | 9 | 3 | 0 | 0 | 12 | 4 | +8 |
| 2 | Team B | 6 | 2 | 0 | 1 | 8 | 5 | +3 |

**Legend:**
- **Points**: Total points (3 for win, 1 for draw)
- **W**: Wins
- **D**: Draws
- **L**: Losses
- **GF**: Goals For (scored)
- **GA**: Goals Against (conceded)
- **GD**: Goal Difference (GF - GA)

### 8. Tournament Status

Tournaments progress through these stages:

1. **Draft**: Initial creation, editing allowed
2. **Registration**: Open for team registration
3. **In Progress**: Brackets generated, matches being played
4. **Completed**: All matches finished
5. **Cancelled**: Tournament cancelled

## Tournament Management

### As Organizer

You can:
- ✅ Create tournaments
- ✅ Update tournament details
- ✅ Delete tournament (if not started)
- ✅ Add/remove teams (before brackets)
- ✅ Generate brackets
- ✅ Submit all match scores
- ✅ Change tournament status

### As Team Captain

You can:
- ✅ Update your team information
- ✅ Submit scores for your team's matches
- ✅ View tournament details

### As Regular User

You can:
- ✅ View all tournaments
- ✅ View tournament details
- ✅ View teams, matches, and standings

## Tips & Best Practices

### Choosing a Format

**Single Elimination** - Use when:
- You have limited time
- You have many teams (16+)
- You want excitement and drama

**Double Elimination** - Use when:
- You want fairness
- Teams traveled far to compete
- You have time for more matches

**Round Robin** - Use when:
- You have 4-8 teams
- You want maximum fairness
- Time is not a constraint
- You want everyone to play everyone

**Groups + Knockout** - Use when:
- You have 16+ teams
- You want combination of fairness and excitement
- You're organizing a major tournament
- You want preliminary rounds

### Team Management

- Get all team information before generating brackets
- Link team captains to user accounts for score submission
- Confirm all teams are ready before generating brackets
- Set maximum teams to control tournament size

### Scheduling

- Set realistic start/end dates
- Allow buffer time between rounds
- Consider venue availability
- Plan for weather contingencies (outdoor sports)

### Score Submission

- Submit scores promptly after matches
- Double-check scores before submission
- Both captains can verify and submit
- Organizer can override if needed

## Example: Creating a Football Tournament

**Step 1**: Create Tournament
```
Name: Summer Football Cup 2024
Description: Annual community football tournament
Sport: Football
Format: Groups + Knockout
Start: July 1, 2024
Location: City Sports Complex
Max Teams: 16
```

**Step 2**: Add 16 Teams
- Team Alpha, Captain: John Doe
- Team Beta, Captain: Jane Smith
- ... (14 more teams)

**Step 3**: Generate Brackets
- System creates 4 groups (A, B, C, D)
- Each group has 4 teams
- Round-robin within groups

**Step 4**: Group Stage
- Teams play all matches in their group
- Track standings for each group
- Top 2 from each group advance (8 teams)

**Step 5**: Knockout Stage
- Quarter Finals (8 → 4 teams)
- Semi Finals (4 → 2 teams)
- Finals (2 → 1 winner)

**Step 6**: Complete Tournament
- Submit all scores
- View final standings
- Mark tournament as completed

## Troubleshooting

### Cannot add teams
- Check if brackets have been generated
- Check if maximum teams reached
- Verify you're the organizer

### Cannot submit score
- Check if you're organizer or team captain
- Verify match hasn't been cancelled
- Check internet connection

### Standings not updating
- Verify scores were submitted successfully
- Refresh the page
- Contact support if issue persists

## Frequently Asked Questions

**Q: Can I change the format after creating?**
A: No, tournament format is fixed at creation.

**Q: Can I edit team names?**
A: Yes, organizers and captains can edit team info before and during tournament.

**Q: What if we need to cancel a match?**
A: Organizers can change match status to cancelled.

**Q: Can I run multiple tournaments simultaneously?**
A: Yes, create as many tournaments as you need.

**Q: Can tournaments be associated with groups?**
A: Yes, optionally link tournaments to groups during creation.

**Q: What happens to data after tournament ends?**
A: All data is preserved. You can view historical tournaments anytime.

## Support

Need help? 
- Check the API documentation: `docs/TOURNAMENT_API.md`
- View implementation details: `TOURNAMENT_IMPLEMENTATION.md`
- Contact your system administrator

---

**Enjoy organizing tournaments with Teamly! 🏆**
