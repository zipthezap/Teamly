import React from 'react';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Box,
  Stack,
} from '@mui/material';

interface PasswordChangeFormProps {
  passwordData: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
  loading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({
  passwordData,
  loading,
  onChange,
  onSubmit,
}) => {
  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        Change Password
      </Typography>
      <form onSubmit={onSubmit}>
        <Stack spacing={3}>
          <TextField
            label="Current Password"
            name="currentPassword"
            type="password"
            value={passwordData.currentPassword}
            onChange={onChange}
            fullWidth
            required
          />
          <TextField
            label="New Password"
            name="newPassword"
            type="password"
            value={passwordData.newPassword}
            onChange={onChange}
            fullWidth
            required
            helperText="Password must be at least 6 characters"
          />
          <TextField
            label="Confirm New Password"
            name="confirmPassword"
            type="password"
            value={passwordData.confirmPassword}
            onChange={onChange}
            fullWidth
            required
          />
        </Stack>
        <Box sx={{ mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
          >
            Update Password
          </Button>
        </Box>
      </form>
    </Paper>
  );
};

export default PasswordChangeForm;
