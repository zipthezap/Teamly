import React from "react";
import { TextField, FormControlLabel, Checkbox } from "@mui/material";

export interface GroupFormFieldsProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  isPublic: boolean;
  setIsPublic: (v: boolean) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

const GroupFormFields: React.FC<GroupFormFieldsProps> = ({
  name,
  setName,
  description,
  setDescription,
  isPublic,
  setIsPublic,
  t,
}) => (
  <>
    <TextField
      label={t('groups.groupName')}
      fullWidth
      margin="normal"
      value={name}
      onChange={e => setName(e.target.value)}
      required
    />
    <TextField
      label={t('groups.description')}
      fullWidth
      multiline
      rows={4}
      margin="normal"
      value={description}
      onChange={e => setDescription(e.target.value)}
    />
    <FormControlLabel
      control={
        <Checkbox
          checked={isPublic}
          onChange={e => setIsPublic(e.target.checked)}
          color="primary"
        />
      }
      label={t('groups.makePublic')}
      sx={{ mt: 2 }}
    />
  </>
);

export default GroupFormFields;
