# Instructions to Apply Merge Conflict Resolution to PR #17

## Current Situation
- PR #17 (`copilot/move-sections-notification-system` → `main`) has merge conflicts
- Resolution has been completed and is available in two places:
  - Commit `3e38bb4` on local branch `copilot/move-sections-notification-system`
  - Commit `c32b7c7` on branch `copilot/fix-merge-conflicts-17` (includes the full resolution chain)

## To Apply the Fix

### Method 1: Force Update the PR Branch (Recommended)
```bash
git fetch origin
git checkout copilot/fix-merge-conflicts-17
git branch -D copilot/move-sections-notification-system 2>/dev/null || true
git checkout -b copilot/move-sections-notification-system fix-pr17-conflicts
git push origin copilot/move-sections-notification-system --force
```

### Method 2: Cherry-pick the Merge Commit
```bash
git fetch origin copilot/move-sections-notification-system
git checkout copilot/move-sections-notification-system
git merge main --allow-unrelated-histories
# Then resolve any remaining conflicts (should be none if using the resolution from 3e38bb4)
git push origin copilot/move-sections-notification-system
```

### Method 3: Replace PR Branch Content
```bash
# Save the merge resolution state
git checkout fix-pr17-conflicts  # This has commit 3e38bb4
git push origin fix-pr17-conflicts:copilot/move-sections-notification-system --force
```

## Verification After Apply
Once applied, verify that:
1. PR #17 shows no merge conflicts in GitHub UI
2. All commits from the PR are preserved
3. The merge with main is clean

## What the Resolution Contains
See `MERGE_RESOLUTION_SUMMARY.md` for detailed information about what was resolved and how.

## Commands for GitHub Admin/Maintainer
If you have admin access to the repository:
```bash
cd /path/to/Teamly
git fetch --all
git checkout fix-pr17-conflicts
git branch -f copilot/move-sections-notification-system fix-pr17-conflicts
git push origin copilot/move-sections-notification-system --force
```

This will update PR #17 with the conflict resolution.
