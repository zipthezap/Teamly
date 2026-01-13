import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, FormControlLabel, Checkbox } from '@mui/material';
import ImageUpload from "../ImageUpload";

export interface GroupSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: { name: string; description: string; privacy: string }) => void;
  form: { name: string; description: string; privacy: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; description: string; privacy: string }>>;
  groupPicture?: string;
  onPictureUpload: (file: File) => Promise<void>;
  onPictureDelete: () => Promise<void>;
  isSubmitting?: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}

const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  open,
  onClose,
  onSubmit,
  form,
  setForm,
  groupPicture,
  onPictureUpload,
  onPictureDelete,
  isSubmitting,
  t,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{t('groupDetails.editGroupSettings')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, mt: 2 }}>
            <ImageUpload
              currentImage={groupPicture}
              onUpload={onPictureUpload}
              onDelete={onPictureDelete}
              label={t('groups.groupPicture') || 'Group Picture'}
              shape="square"
              size={150}
            />
          </Box>
          <TextField
            label={t('groupDetails.groupName')}
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            fullWidth
            margin="normal"
          />
          <TextField
            label={t('groupDetails.description')}
            name="description"
            value={form.description}
            onChange={handleChange}
            fullWidth
            margin="normal"
            multiline
            rows={3}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.privacy === 'public'}
                onChange={e => setForm(f => ({ ...f, privacy: e.target.checked ? 'public' : 'private' }))}
                color="primary"
              />
            }
            label={t('groups.makePublic')}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="secondary">{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" color="primary" disabled={isSubmitting}>
            {t('groupDetails.saveChanges')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default GroupSettingsModal;
