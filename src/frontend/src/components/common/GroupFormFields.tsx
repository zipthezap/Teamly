import React from "react";
import { 
  TextField, 
  FormControlLabel, 
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  Box,
  Typography,
  Divider
} from "@mui/material";
import { SPORT_TYPES } from "../../constants/sportTypes";

export interface GroupFormFieldsProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  isPublic: boolean;
  setIsPublic: (v: boolean) => void;
  sportType?: string;
  setSportType?: (v: string) => void;
  maxMembers?: number | string;
  setMaxMembers?: (v: number | string) => void;
  autoApproveJoinRequests?: boolean;
  setAutoApproveJoinRequests?: (v: boolean) => void;
  tags?: string;
  setTags?: (v: string) => void;
  allowMemberInvites?: boolean;
  setAllowMemberInvites?: (v: boolean) => void;
  allowMemberCopyLink?: boolean;
  setAllowMemberCopyLink?: (v: boolean) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

const GroupFormFields: React.FC<GroupFormFieldsProps> = ({
  name,
  setName,
  description,
  setDescription,
  isPublic,
  setIsPublic,
  sportType,
  setSportType,
  maxMembers,
  setMaxMembers,
  autoApproveJoinRequests,
  setAutoApproveJoinRequests,
  tags,
  setTags,
  allowMemberInvites,
  setAllowMemberInvites,
  allowMemberCopyLink,
  setAllowMemberCopyLink,
  t,
}) => {
  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (setTags) {
      setTags(e.target.value);
    }
  };

  const tagArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

  return (
    <Box>
      {/* Basic Information Section */}
      <Typography variant="h6" sx={{ mb: 2, mt: 2, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}>
        {t('groups.basicInfo') || 'Basic Information'}
      </Typography>
      
      <TextField
        label={t('groups.groupName')}
        fullWidth
        margin="normal"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        helperText={t('groups.groupNameHelp') || 'Choose a descriptive name for your group'}
        sx={{
          '& .MuiInputBase-root': {
            minHeight: { xs: '44px', sm: '56px' }
          }
        }}
      />
      
      <TextField
        label={t('groups.description')}
        fullWidth
        multiline
        rows={4}
        margin="normal"
        value={description}
        onChange={e => setDescription(e.target.value)}
        helperText={t('groups.descriptionHelp') || 'Describe what your group is about and what activities you do'}
        sx={{
          '& .MuiInputBase-root': {
            minHeight: { xs: '44px', sm: 'auto' }
          }
        }}
      />

      <Divider sx={{ my: 3 }} />

      {/* Group Settings Section */}
      <Typography variant="h6" sx={{ mb: 2, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}>
        {t('groups.groupSettings') || 'Group Settings'}
      </Typography>

      {setSportType && (
        <FormControl fullWidth margin="normal">
          <InputLabel>{t('groups.sportType') || 'Primary Sport Type'}</InputLabel>
          <Select
            value={sportType || ''}
            onChange={e => setSportType(e.target.value)}
            label={t('groups.sportType') || 'Primary Sport Type'}
            sx={{
              minHeight: { xs: '44px', sm: '56px' }
            }}
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
      )}

      {setMaxMembers && (
        <TextField
          label={t('groups.maxMembers') || 'Maximum Members'}
          fullWidth
          margin="normal"
          type="number"
          value={maxMembers || ''}
          onChange={e => setMaxMembers(e.target.value)}
          inputProps={{ min: 2, max: 10000 }}
          helperText={t('groups.maxMembersHelp') || 'Leave empty for unlimited members (2-10,000)'}
          sx={{
            '& .MuiInputBase-root': {
              minHeight: { xs: '44px', sm: '56px' }
            }
          }}
        />
      )}

      {setTags && (
        <Box sx={{ mt: 2 }}>
          <TextField
            label={t('groups.tags') || 'Tags'}
            fullWidth
            margin="normal"
            value={tags || ''}
            onChange={handleTagsChange}
            placeholder="competitive, weekend-warriors, beginners-welcome"
            helperText={t('groups.tagsHelp') || 'Add comma-separated tags to help others find your group'}
            sx={{
              '& .MuiInputBase-root': {
                minHeight: { xs: '44px', sm: '56px' }
              }
            }}
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
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Privacy & Access Section */}
      <Typography variant="h6" sx={{ mb: 2, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}>
        {t('groups.privacySettings') || 'Privacy & Access'}
      </Typography>

      <Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              color="primary"
              sx={{ '& .MuiSvgIcon-root': { fontSize: { xs: 28, sm: 24 } } }}
            />
          }
          label={t('groups.makePublic')}
          sx={{ mt: 1 }}
        />
        <FormHelperText sx={{ ml: 4, mb: 2 }}>
          {t('groups.makePublicHelp') || 'Public groups can be discovered by anyone and appear in search results'}
        </FormHelperText>
      </Box>

      {isPublic && setAutoApproveJoinRequests && (
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={autoApproveJoinRequests || false}
                onChange={e => setAutoApproveJoinRequests(e.target.checked)}
                color="primary"
                sx={{ '& .MuiSvgIcon-root': { fontSize: { xs: 28, sm: 24 } } }}
              />
            }
            label={t('groups.autoApproveJoinRequests') || 'Auto-approve join requests'}
            sx={{ mt: 1 }}
          />
          <FormHelperText sx={{ ml: 4, mb: 2 }}>
            {t('groups.autoApproveHelp') || 'New members can join immediately without admin approval'}
          </FormHelperText>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Member Permissions Section */}
      <Typography variant="h6" sx={{ mb: 2, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}>
        {t('groups.memberPermissions') || 'Member Permissions'}
      </Typography>

      {setAllowMemberInvites && (
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={allowMemberInvites || false}
                onChange={e => setAllowMemberInvites(e.target.checked)}
                color="primary"
                sx={{ '& .MuiSvgIcon-root': { fontSize: { xs: 28, sm: 24 } } }}
              />
            }
            label={t('groups.allowMemberInvites') || 'Allow members to invite others'}
            sx={{ mt: 1 }}
          />
          <FormHelperText sx={{ ml: 4, mb: 2 }}>
            {t('groups.allowMemberInvitesHelp') || 'When disabled, only admins and moderators can invite new members'}
          </FormHelperText>
        </Box>
      )}

      {setAllowMemberCopyLink && (
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={allowMemberCopyLink !== false}
                onChange={e => setAllowMemberCopyLink(e.target.checked)}
                color="primary"
                sx={{ '& .MuiSvgIcon-root': { fontSize: { xs: 28, sm: 24 } } }}
              />
            }
            label={t('groups.allowMemberCopyLink') || 'Allow members to copy invite link'}
            sx={{ mt: 1 }}
          />
          <FormHelperText sx={{ ml: 4, mb: 2 }}>
            {t('groups.allowMemberCopyLinkHelp') || 'When disabled, only admins and moderators can copy the group invite link'}
          </FormHelperText>
        </Box>
      )}
    </Box>
  );
};

export default GroupFormFields;
