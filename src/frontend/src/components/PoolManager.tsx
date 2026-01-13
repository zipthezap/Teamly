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
  Select,
  FormControl,
  InputLabel,
  Typography,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  Pool as PoolIcon
} from '@mui/icons-material';
import { tournamentAPI } from '../services/tournamentAPI';
import { TournamentTeam } from '../../../shared/types';

interface PoolManagerProps {
  tournamentId: string;
  teams: TournamentTeam[];
  isOrganizer: boolean;
  onUpdate: () => void;
}

const PoolManager: React.FC<PoolManagerProps> = ({
  tournamentId,
  teams,
  isOrganizer,
  onUpdate
}) => {
  const [assignPoolOpen, setAssignPoolOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TournamentTeam | null>(null);
  const [poolNumber, setPoolNumber] = useState<number | ''>('');
  const [poolName, setPoolName] = useState('');

  const handleAssignPool = async () => {
    if (!selectedTeam) return;

    try {
      await tournamentAPI.assignTeamToPool(tournamentId, selectedTeam.id, {
        poolNumber: poolNumber || undefined,
        poolName: poolName || undefined
      });
      setAssignPoolOpen(false);
      setSelectedTeam(null);
      setPoolNumber('');
      setPoolName('');
      onUpdate();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to assign team to pool');
    }
  };

  const openAssignPoolDialog = (team: TournamentTeam) => {
    setSelectedTeam(team);
    setPoolNumber(team.poolNumber || '');
    setPoolName(team.poolName || '');
    setAssignPoolOpen(true);
  };

  // Group teams by pool
  const poolGroups: { [key: string]: TournamentTeam[] } = {};
  const unassignedTeams: TournamentTeam[] = [];

  teams.forEach((team) => {
    if (team.poolNumber || team.poolName) {
      const poolKey = team.poolName || `Pool ${team.poolNumber}`;
      if (!poolGroups[poolKey]) {
        poolGroups[poolKey] = [];
      }
      poolGroups[poolKey].push(team);
    } else {
      unassignedTeams.push(team);
    }
  });

  if (!isOrganizer) {
    // Show pool groupings in read-only mode
    if (Object.keys(poolGroups).length === 0) {
      return null;
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Pool Assignments
        </Typography>
        <Grid container spacing={2}>
          {Object.entries(poolGroups).map(([poolKey, poolTeams]) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={poolKey}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <PoolIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">{poolKey}</Typography>
                  </Box>
                  {poolTeams.map((team) => (
                    <Chip
                      key={team.id}
                      label={team.name}
                      size="small"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Pool Management
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Assign teams to different pools for group stage play. Teams in the same pool will play against each other.
      </Typography>

      {/* Unassigned Teams */}
      {unassignedTeams.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Unassigned Teams
          </Typography>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {unassignedTeams.map((team) => (
                  <Box key={team.id} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Chip label={team.name} />
                    <Tooltip title="Assign to Pool">
                      <IconButton
                        size="small"
                        onClick={() => openAssignPoolDialog(team)}
                        sx={{ ml: 0.5 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Pool Groups */}
      {Object.keys(poolGroups).length > 0 && (
        <Grid container spacing={2}>
          {Object.entries(poolGroups).map(([poolKey, poolTeams]) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={poolKey}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PoolIcon sx={{ mr: 1 }} color="primary" />
                    <Typography variant="h6">{poolKey}</Typography>
                    <Chip label={poolTeams.length} size="small" sx={{ ml: 1 }} />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {poolTeams.map((team) => (
                      <Box key={team.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2">{team.name}</Typography>
                        <Tooltip title="Edit Pool Assignment">
                          <IconButton
                            size="small"
                            onClick={() => openAssignPoolDialog(team)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {teams.length === 0 && (
        <Typography variant="body2" color="text.secondary" align="center">
          No teams added yet. Add teams first, then assign them to pools.
        </Typography>
      )}

      {/* Assign Pool Dialog */}
      <Dialog open={assignPoolOpen} onClose={() => setAssignPoolOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Team to Pool</DialogTitle>
        <DialogContent>
          {selectedTeam && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Team: <strong>{selectedTeam.name}</strong>
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Pool Number"
                    type="number"
                    value={poolNumber}
                    onChange={(e) => setPoolNumber(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="e.g., 1, 2, 3"
                    helperText="Numeric pool identifier"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Pool Name"
                    value={poolName}
                    onChange={(e) => setPoolName(e.target.value)}
                    placeholder="e.g., Pool A, Group 1"
                    helperText="Human-readable pool name (optional)"
                  />
                </Grid>
              </Grid>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Leave both fields empty to remove pool assignment
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignPoolOpen(false)}>Cancel</Button>
          <Button onClick={handleAssignPool} variant="contained">
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PoolManager;
