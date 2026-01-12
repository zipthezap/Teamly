import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { authAPI } from '../../services/api';
import { AxiosError } from 'axios';

interface OAuthConnectionsProps {
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
}

interface OAuthStatus {
  connections: {
    google: boolean;
    facebook: boolean;
    local: boolean;
  };
  primaryProvider: string;
  lastOAuthSync: string | null;
  hasOAuthProfilePicture: boolean;
}

const OAuthConnections: React.FC<OAuthConnectionsProps> = ({ onSuccess, onError }) => {
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [unlinkDialog, setUnlinkDialog] = useState<{ open: boolean; provider: 'google' | 'facebook' | null }>({
    open: false,
    provider: null,
  });

  useEffect(() => {
    fetchOAuthStatus();
  }, []);

  const fetchOAuthStatus = async () => {
    try {
      const response = await authAPI.getOAuthStatus();
      setOAuthStatus(response.data);
    } catch (err) {
      console.error('Failed to fetch OAuth status:', err);
      onError?.('Failed to load OAuth connections');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkAccount = (provider: 'google' | 'facebook') => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    window.location.href = `${apiUrl}/auth/${provider}`;
  };

  const handleUnlinkAccount = async (provider: 'google' | 'facebook') => {
    setActionLoading(`unlink-${provider}`);
    try {
      await authAPI.unlinkOAuthAccount(provider);
      onSuccess?.(`${provider === 'google' ? 'Google' : 'Facebook'} account unlinked successfully`);
      await fetchOAuthStatus();
      setUnlinkDialog({ open: false, provider: null });
    } catch (err) {
      const errorMessage = err instanceof AxiosError
        ? err.response?.data?.error || 'Failed to unlink account'
        : 'Failed to unlink account';
      onError?.(errorMessage);
      setUnlinkDialog({ open: false, provider: null });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncProfilePicture = async () => {
    setActionLoading('sync-picture');
    try {
      await authAPI.syncOAuthProfilePicture();
      onSuccess?.('Profile picture synced from OAuth provider');
      await fetchOAuthStatus();
    } catch (err) {
      const errorMessage = err instanceof AxiosError
        ? err.response?.data?.error || 'Failed to sync profile picture'
        : 'Failed to sync profile picture';
      onError?.(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const openUnlinkDialog = (provider: 'google' | 'facebook') => {
    setUnlinkDialog({ open: true, provider });
  };

  const closeUnlinkDialog = () => {
    setUnlinkDialog({ open: false, provider: null });
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  if (!oauthStatus) {
    return null;
  }

  const { connections } = oauthStatus;
  const canUnlink = (provider: 'google' | 'facebook') => {
    if (provider === 'google') {
      return connections.facebook || connections.local;
    }
    return connections.google || connections.local;
  };

  return (
    <>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          Connected Accounts
        </Typography>

        {oauthStatus.primaryProvider && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Primary authentication method: <strong>{oauthStatus.primaryProvider === 'local' ? 'Email/Password' : oauthStatus.primaryProvider}</strong>
          </Alert>
        )}

        <Stack spacing={3}>
          {/* Google Account */}
          <Box>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <GoogleIcon sx={{ color: '#4285F4' }} />
                <Typography variant="h6">Google</Typography>
                {connections.google && (
                  <Chip
                    label="Connected"
                    color="success"
                    size="small"
                    icon={<CheckCircleIcon />}
                  />
                )}
              </Box>
              {connections.google ? (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<LinkOffIcon />}
                  onClick={() => openUnlinkDialog('google')}
                  disabled={!canUnlink('google') || actionLoading !== null}
                >
                  Unlink
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LinkIcon />}
                  onClick={() => handleLinkAccount('google')}
                  disabled={actionLoading !== null}
                >
                  Link Account
                </Button>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {connections.google
                ? 'Your Google account is connected and can be used for sign in'
                : 'Link your Google account for easy sign in'}
            </Typography>
          </Box>

          {/* Facebook Account */}
          <Box>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <FacebookIcon sx={{ color: '#1877F2' }} />
                <Typography variant="h6">Facebook</Typography>
                {connections.facebook && (
                  <Chip
                    label="Connected"
                    color="success"
                    size="small"
                    icon={<CheckCircleIcon />}
                  />
                )}
              </Box>
              {connections.facebook ? (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<LinkOffIcon />}
                  onClick={() => openUnlinkDialog('facebook')}
                  disabled={!canUnlink('facebook') || actionLoading !== null}
                >
                  Unlink
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LinkIcon />}
                  onClick={() => handleLinkAccount('facebook')}
                  disabled={actionLoading !== null}
                >
                  Link Account
                </Button>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {connections.facebook
                ? 'Your Facebook account is connected and can be used for sign in'
                : 'Link your Facebook account for easy sign in'}
            </Typography>
          </Box>

          {/* OAuth Profile Picture Sync */}
          {oauthStatus.hasOAuthProfilePicture && (
            <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Profile Picture Sync
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Use your profile picture from your connected OAuth account
              </Typography>
              <Button
                variant="outlined"
                startIcon={<SyncIcon />}
                onClick={handleSyncProfilePicture}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'sync-picture' ? 'Syncing...' : 'Sync from OAuth'}
              </Button>
              {oauthStatus.lastOAuthSync && (
                <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
                  Last synced: {new Date(oauthStatus.lastOAuthSync).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          )}

          {/* Warning about password */}
          {!connections.local && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              You don't have a password set. Consider setting a password as a backup login method in the Password section below.
            </Alert>
          )}
        </Stack>
      </Paper>

      {/* Unlink Confirmation Dialog */}
      <Dialog open={unlinkDialog.open} onClose={closeUnlinkDialog}>
        <DialogTitle>
          Unlink {unlinkDialog.provider ? (unlinkDialog.provider === 'google' ? 'Google' : 'Facebook') : ''} Account?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {unlinkDialog.provider && (
              <>
                Are you sure you want to unlink your {unlinkDialog.provider === 'google' ? 'Google' : 'Facebook'} account?
                You will no longer be able to sign in using this provider.
                {!canUnlink(unlinkDialog.provider) && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="error">
                      You cannot unlink this account as it's your only authentication method. Please set a password or link another account first.
                    </Alert>
                  </Box>
                )}
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeUnlinkDialog} disabled={actionLoading !== null}>
            Cancel
          </Button>
          {unlinkDialog.provider && (
            <Button
              onClick={() => handleUnlinkAccount(unlinkDialog.provider as 'google' | 'facebook')}
              color="error"
              variant="contained"
              disabled={actionLoading !== null || !canUnlink(unlinkDialog.provider)}
            >
              {actionLoading?.startsWith('unlink') ? 'Unlinking...' : 'Unlink'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default OAuthConnections;
