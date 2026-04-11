import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Stack,
  Alert,
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

interface PasswordChangeFormProps {
  passwordData: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
  loading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  hasPassword?: boolean;
}

const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({
  passwordData,
  loading,
  onChange,
  onSubmit,
  hasPassword = true,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // Check if user is OAuth-only (no password set)
  const authProvider = user?.authProvider as string | undefined;
  const isOAuthOnly = authProvider && authProvider !== 'local' && !hasPassword;

  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
      <Typography variant="h5" gutterBottom sx={{ 
        fontWeight: 600, 
        mb: { xs: 2, sm: 3 },
        fontSize: { xs: '1.25rem', sm: '1.5rem' }
      }}>
        {isOAuthOnly ? 'Set Password' : t('profile.changePassword')}
      </Typography>
      
      {isOAuthOnly && (
        <Alert severity="info" sx={{ mb: { xs: 2, sm: 3 } }}>
          You signed up using {authProvider}. Setting a password will allow you to sign in with email and password as well.
        </Alert>
      )}
      
      <form onSubmit={onSubmit}>
        <Stack spacing={{ xs: 2, sm: 3 }}>
          {!isOAuthOnly && (
            <TextField
              label={t('profile.currentPassword')}
              name="currentPassword"
              type="password"
              value={passwordData.currentPassword}
              onChange={onChange}
              fullWidth
              required
              sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
            />
          )}
          <TextField
            label={isOAuthOnly ? 'New Password' : t('profile.newPassword')}
            name="newPassword"
            type="password"
            value={passwordData.newPassword}
            onChange={onChange}
            fullWidth
            required
            helperText={t('profile.passwordMinLength') || 'Minimum 8 characters with uppercase, lowercase, number, and special character'}
            sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
          />
          <TextField
            label={isOAuthOnly ? 'Confirm Password' : t('profile.confirmNewPassword')}
            name="confirmPassword"
            type="password"
            value={passwordData.confirmPassword}
            onChange={onChange}
            fullWidth
            required
            sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
          />
        </Stack>
        <Box sx={{ mt: { xs: 2, sm: 3 } }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ minHeight: '44px', px: { xs: 2, sm: 3 } }}
          >
            {isOAuthOnly ? 'Set Password' : t('profile.updatePassword')}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};

export default PasswordChangeForm;
