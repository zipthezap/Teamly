import React from "react";
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Box, 
  FormControlLabel, 
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  Typography,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import ImageUpload from "../ImageUpload";
import { SPORT_TYPES } from "../../constants/sportTypes";

export interface GroupSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: { 
    name: string; 
    description: string; 
    privacy: string;
    sportType?: string;
    maxMembers?: number | string;
    autoApproveJoinRequests?: boolean;
    tags?: string;
    allowMemberInvites?: boolean;
    allowMemberCopyLink?: boolean;
  }) => void;
  form: { 
    name: string; 
    description: string; 
    privacy: string;
    sportType?: string;
    maxMembers?: number | string;
    autoApproveJoinRequests?: boolean;
    tags?: string;
    allowMemberInvites?: boolean;
    allowMemberCopyLink?: boolean;
  };
  setForm: React.Dispatch<React.SetStateAction<{ 
    name: string; 
    description: string; 
    privacy: string;
    sportType?: string;
    maxMembers?: number | string;
    autoApproveJoinRequests?: boolean;
    tags?: string;
    allowMemberInvites?: boolean;
    allowMemberCopyLink?: boolean;
  }>>;
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
  const [activeTab, setActiveTab] = React.useState(0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const tagArray = form.tags ? form.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{t('groupDetails.editGroupSettings')}</DialogTitle>
        
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
          <Tab label={t('groups.basicInfo') || 'Basic Info'} />
          <Tab label={t('groups.settings') || 'Settings'} />
        </Tabs>

        <DialogContent>
          {activeTab === 0 && (
            <Box>
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
                rows={4}
              />
            </Box>
          )}

          {activeTab === 1 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                {t('groups.groupSettings') || 'Group Settings'}
              </Typography>

              <FormControl fullWidth margin="normal">
                <InputLabel>{t('groups.sportType') || 'Primary Sport Type'}</InputLabel>
                <Select
                  value={form.sportType || ''}
                  onChange={e => setForm({ ...form, sportType: e.target.value })}
                  label={t('groups.sportType') || 'Primary Sport Type'}
                >
                  {SPORT_TYPES.map(sport => (
                    <MenuItem key={sport.value} value={sport.value}>
                      {sport.label}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {t('groups.sportTypeHelp') || 'Select the main sport your group focuses on'}
                </FormHelperText>
              </FormControl>

              <TextField
                label={t('groups.maxMembers') || 'Maximum Members'}
                name="maxMembers"
                value={form.maxMembers || ''}
                onChange={handleChange}
                fullWidth
                margin="normal"
                type="number"
                inputProps={{ min: 2, max: 10000 }}
                helperText={t('groups.maxMembersHelp') || 'Leave empty for unlimited members (2-10,000)'}
              />

              <TextField
                label={t('groups.tags') || 'Tags'}
                name="tags"
                value={form.tags || ''}
                onChange={handleChange}
                fullWidth
                margin="normal"
                placeholder="competitive, weekend-warriors, beginners-welcome"
                helperText={t('groups.tagsHelp') || 'Add comma-separated tags to help others find your group'}
              />
              {tagArray.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {tagArray.map((tag, index) => (
                    <Chip 
                      key={index} 
                      label={tag} 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                {t('groups.privacySettings') || 'Privacy & Access'}
              </Typography>

              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.privacy === 'public'}
                      onChange={e => setForm({ ...form, privacy: e.target.checked ? 'public' : 'private' })}
                      color="primary"
                    />
                  }
                  label={t('groups.makePublic')}
                />
                <FormHelperText sx={{ ml: 4, mb: 2 }}>
                  {t('groups.makePublicHelp') || 'Public groups can be discovered by anyone and appear in search results'}
                </FormHelperText>
              </Box>

              {form.privacy === 'public' && (
                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.autoApproveJoinRequests || false}
                        onChange={e => setForm({ ...form, autoApproveJoinRequests: e.target.checked })}
                        color="primary"
                      />
                    }
                    label={t('groups.autoApproveJoinRequests') || 'Auto-approve join requests'}
                  />
                  <FormHelperText sx={{ ml: 4, mb: 2 }}>
                    {t('groups.autoApproveHelp') || 'New members can join immediately without admin approval'}
                  </FormHelperText>
                </Box>
              )}

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                {t('groups.memberPermissions') || 'Member Permissions'}
              </Typography>

              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.allowMemberInvites || false}
                      onChange={e => setForm({ ...form, allowMemberInvites: e.target.checked })}
                      color="primary"
                    />
                  }
                  label={t('groups.allowMemberInvites') || 'Allow members to invite others'}
                />
                <FormHelperText sx={{ ml: 4, mb: 2 }}>
                  {t('groups.allowMemberInvitesHelp') || 'When disabled, only admins and moderators can invite new members'}
                </FormHelperText>
              </Box>

              {/* Only show for public groups since invite links don't work for private groups */}
              {form.privacy === 'public' && (
                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.allowMemberCopyLink !== false}
                        onChange={e => setForm({ ...form, allowMemberCopyLink: e.target.checked })}
                        color="primary"
                      />
                    }
                    label={t('groups.allowMemberCopyLink') || 'Allow members to copy invite link'}
                  />
                  <FormHelperText sx={{ ml: 4, mb: 2 }}>
                    {t('groups.allowMemberCopyLinkHelp') || 'When disabled, only admins and moderators can copy the group invite link'}
                  </FormHelperText>
                </Box>
              )}
            </Box>
          )}
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
