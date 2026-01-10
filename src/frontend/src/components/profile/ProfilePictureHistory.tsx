import React from 'react';
import { Box, Typography, Button, Stack, Chip } from '@mui/material';
import { UserProfilePicture } from '../../../../shared/types/user.types';

interface ProfilePictureHistoryProps {
  pictures: UserProfilePicture[];
  onRestore: (id: string) => void;
  onHardDelete: (id: string) => void;
  currentPictureId?: string;
}

const ProfilePictureHistory: React.FC<ProfilePictureHistoryProps> = ({
  pictures,
  onRestore,
  onHardDelete,
  currentPictureId,
}) => {
  if (!pictures || pictures.length === 0) return null;
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Profile Picture History
      </Typography>
      <Stack spacing={2}>
        {pictures.map((pic) => (
          <Box key={pic.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <img
              src={pic.url}
              alt="Profile"
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: pic.isCurrent ? '2px solid #1976d2' : '1px solid #ccc' }}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              {pic.isCurrent && <Chip label="Current" color="primary" size="small" />}
              {pic.deletedAt && <Chip label="Deleted" color="warning" size="small" />}
              <Typography variant="body2" color="text.secondary">
                Uploaded: {new Date(pic.createdAt).toLocaleString()}
              </Typography>
              {pic.updatedAt && pic.updatedAt !== pic.createdAt && (
                <Typography variant="body2" color="text.secondary">
                  Updated: {new Date(pic.updatedAt).toLocaleString()}
                </Typography>
              )}
              {pic.deletedAt && (
                <Typography variant="body2" color="error">
                  Deleted: {new Date(pic.deletedAt).toLocaleString()}
                </Typography>
              )}
            </Stack>
            <Box sx={{ flexGrow: 1 }} />
            {!pic.isCurrent && !pic.deletedAt && (
              <Button size="small" variant="outlined" onClick={() => onRestore(pic.id)}>
                Restore
              </Button>
            )}
            {pic.deletedAt && (
              <Button size="small" variant="contained" color="success" onClick={() => onRestore(pic.id)}>
                Restore
              </Button>
            )}
            <Button size="small" variant="outlined" color="error" onClick={() => onHardDelete(pic.id)}>
              Delete Permanently
            </Button>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default ProfilePictureHistory;
