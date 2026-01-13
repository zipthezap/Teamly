import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Grid,
  Typography,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  SportsSoccer as RefereeIcon
} from '@mui/icons-material';
import { tournamentAPI } from '../services/tournamentAPI';
import {
  TournamentTeam,
  TournamentMatch,
  BracketStage,
  MatchStatus,
  CreateMatchDto,
  UpdateMatchDto
} from '../../../shared/types';

interface ManualBracketManagerProps {
  tournamentId: string;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  isOrganizer: boolean;
  onUpdate: () => void;
}

const ManualBracketManager: React.FC<ManualBracketManagerProps> = ({
  tournamentId,
  teams,
  matches,
  isOrganizer,
  onUpdate
}) => {
  const [createMatchOpen, setCreateMatchOpen] = useState(false);
  const [editMatchOpen, setEditMatchOpen] = useState(false);
  const [assignRefereeOpen, setAssignRefereeOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  const [newMatch, setNewMatch] = useState<CreateMatchDto>({
    homeTeamId: '',
    awayTeamId: '',
    stage: BracketStage.GROUP_STAGE,
    groupName: '',
    scheduledAt: ''
  });
  const [editMatchData, setEditMatchData] = useState<UpdateMatchDto>({});
  const [selectedRefereeId, setSelectedRefereeId] = useState<string>('');

  const handleCreateMatch = async () => {
    if (!newMatch.homeTeamId || !newMatch.awayTeamId) {
      alert('Please select both home and away teams');
      return;
    }

    if (newMatch.homeTeamId === newMatch.awayTeamId) {
      alert('Home and away teams must be different');
      return;
    }

    try {
      await tournamentAPI.createMatch(tournamentId, newMatch);
      setCreateMatchOpen(false);
      setNewMatch({
        homeTeamId: '',
        awayTeamId: '',
        stage: BracketStage.GROUP_STAGE,
        groupName: '',
        scheduledAt: ''
      });
      onUpdate();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || 'Failed to create match');
    }
  };

  const handleEditMatch = async () => {
    if (!selectedMatch) return;

    try {
      await tournamentAPI.updateMatch(tournamentId, selectedMatch.id, editMatchData);
      setEditMatchOpen(false);
      setSelectedMatch(null);
      setEditMatchData({});
      onUpdate();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || 'Failed to update match');
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!window.confirm('Are you sure you want to delete this match?')) {
      return;
    }

    try {
      await tournamentAPI.deleteMatch(tournamentId, matchId);
      onUpdate();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || 'Failed to delete match');
    }
  };

  const handleAssignReferee = async () => {
    if (!selectedMatch) return;

    try {
      await tournamentAPI.assignReferee(tournamentId, selectedMatch.id, {
        refereeTeamId: selectedRefereeId || null
      });
      setAssignRefereeOpen(false);
      setSelectedMatch(null);
      setSelectedRefereeId('');
      onUpdate();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || 'Failed to assign referee');
    }
  };

  const openEditMatchDialog = (match: TournamentMatch) => {
    setSelectedMatch(match);
    setEditMatchData({
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      stage: match.stage,
      groupName: match.groupName || '',
      scheduledAt: match.scheduledAt || ''
    });
    setEditMatchOpen(true);
  };

  const openAssignRefereeDialog = (match: TournamentMatch) => {
    setSelectedMatch(match);
    setSelectedRefereeId(match.refereeTeamId || '');
    setAssignRefereeOpen(true);
  };

  // Get available teams for referee assignment (excluding playing teams)
  const getAvailableReferees = (match: TournamentMatch) => {
    return teams.filter(
      (team) => team.id !== match.homeTeamId && team.id !== match.awayTeamId
    );
  };

  if (!isOrganizer) {
    return null;
  }

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateMatchOpen(true)}
        >
          Create Match
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Manual Bracket Management:</strong> You can create, edit, and delete matches manually.
          Assign teams to referee matches when they're on break.
        </Typography>
      </Alert>

      {/* Matches Table with Edit/Delete/Referee Actions */}
      <Box sx={{ mt: 2 }}>
        {matches.map((match) => (
          <Box
            key={match.id}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              mb: 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {match.stage?.replace('_', ' ').toUpperCase() || 
                 (match.groupName ? `Group ${match.groupName}` : 'Round ' + match.roundNumber)}
              </Typography>
              <Typography variant="h6">
                {match.homeTeam?.name} vs {match.awayTeam?.name}
              </Typography>
              {match.refereeTeam && (
                <Chip
                  icon={<RefereeIcon />}
                  label={`Referee: ${match.refereeTeam.name}`}
                  size="small"
                  color="secondary"
                  sx={{ mt: 0.5 }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Assign Referee">
                <IconButton
                  size="small"
                  onClick={() => openAssignRefereeDialog(match)}
                  color="primary"
                >
                  <RefereeIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit Match">
                <IconButton
                  size="small"
                  onClick={() => openEditMatchDialog(match)}
                  color="primary"
                >
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Match">
                <IconButton
                  size="small"
                  onClick={() => handleDeleteMatch(match.id)}
                  color="error"
                  disabled={match.status === MatchStatus.COMPLETED}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Create Match Dialog */}
      <Dialog open={createMatchOpen} onClose={() => setCreateMatchOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Match</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth required>
                <InputLabel>Home Team</InputLabel>
                <Select
                  value={newMatch.homeTeamId}
                  label="Home Team"
                  onChange={(e) => setNewMatch({ ...newMatch, homeTeamId: e.target.value })}
                >
                  {teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth required>
                <InputLabel>Away Team</InputLabel>
                <Select
                  value={newMatch.awayTeamId}
                  label="Away Team"
                  onChange={(e) => setNewMatch({ ...newMatch, awayTeamId: e.target.value })}
                >
                  {teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Stage</InputLabel>
                <Select
                  value={newMatch.stage || ''}
                  label="Stage"
                  onChange={(e) => setNewMatch({ ...newMatch, stage: e.target.value as BracketStage })}
                >
                  <MenuItem value={BracketStage.GROUP_STAGE}>Group Stage</MenuItem>
                  <MenuItem value={BracketStage.ROUND_OF_32}>Round of 32</MenuItem>
                  <MenuItem value={BracketStage.ROUND_OF_16}>Round of 16</MenuItem>
                  <MenuItem value={BracketStage.QUARTER_FINALS}>Quarter Finals</MenuItem>
                  <MenuItem value={BracketStage.SEMI_FINALS}>Semi Finals</MenuItem>
                  <MenuItem value={BracketStage.THIRD_PLACE}>Third Place</MenuItem>
                  <MenuItem value={BracketStage.FINALS}>Finals</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Group Name (optional)"
                value={newMatch.groupName}
                onChange={(e) => setNewMatch({ ...newMatch, groupName: e.target.value })}
                placeholder="e.g., A, B, 1, 2"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Scheduled Time (optional)"
                type="datetime-local"
                value={newMatch.scheduledAt}
                onChange={(e) => setNewMatch({ ...newMatch, scheduledAt: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateMatchOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateMatch} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Match Dialog */}
      <Dialog open={editMatchOpen} onClose={() => setEditMatchOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Match</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Home Team</InputLabel>
                <Select
                  value={editMatchData.homeTeamId || ''}
                  label="Home Team"
                  onChange={(e) => setEditMatchData({ ...editMatchData, homeTeamId: e.target.value })}
                >
                  {teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Away Team</InputLabel>
                <Select
                  value={editMatchData.awayTeamId || ''}
                  label="Away Team"
                  onChange={(e) => setEditMatchData({ ...editMatchData, awayTeamId: e.target.value })}
                >
                  {teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Stage</InputLabel>
                <Select
                  value={editMatchData.stage || ''}
                  label="Stage"
                  onChange={(e) => setEditMatchData({ ...editMatchData, stage: e.target.value as BracketStage })}
                >
                  <MenuItem value={BracketStage.GROUP_STAGE}>Group Stage</MenuItem>
                  <MenuItem value={BracketStage.ROUND_OF_32}>Round of 32</MenuItem>
                  <MenuItem value={BracketStage.ROUND_OF_16}>Round of 16</MenuItem>
                  <MenuItem value={BracketStage.QUARTER_FINALS}>Quarter Finals</MenuItem>
                  <MenuItem value={BracketStage.SEMI_FINALS}>Semi Finals</MenuItem>
                  <MenuItem value={BracketStage.THIRD_PLACE}>Third Place</MenuItem>
                  <MenuItem value={BracketStage.FINALS}>Finals</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Group Name"
                value={editMatchData.groupName || ''}
                onChange={(e) => setEditMatchData({ ...editMatchData, groupName: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Scheduled Time"
                type="datetime-local"
                value={editMatchData.scheduledAt || ''}
                onChange={(e) => setEditMatchData({ ...editMatchData, scheduledAt: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditMatchOpen(false)}>Cancel</Button>
          <Button onClick={handleEditMatch} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Referee Dialog */}
      <Dialog open={assignRefereeOpen} onClose={() => setAssignRefereeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Referee</DialogTitle>
        <DialogContent>
          {selectedMatch && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Match: {selectedMatch.homeTeam?.name} vs {selectedMatch.awayTeam?.name}
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Referee Team</InputLabel>
                <Select
                  value={selectedRefereeId}
                  label="Referee Team"
                  onChange={(e) => setSelectedRefereeId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>None (remove referee)</em>
                  </MenuItem>
                  {getAvailableReferees(selectedMatch).map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name}
                      {team.poolName && ` (${team.poolName})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Alert severity="info" sx={{ mt: 2 }}>
                Assign a team that's on a break to referee this match
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignRefereeOpen(false)}>Cancel</Button>
          <Button onClick={handleAssignReferee} variant="contained">
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManualBracketManager;
