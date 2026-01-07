import React from "react";
import { useTranslation } from "react-i18next";
import { Group } from "../../types/group";
import Button from "../ui/Button";

interface GroupHeaderProps {
  group: Group;
  onEdit?: () => void;
  onInvite?: () => void;
  isAdmin?: boolean;
}

const GroupHeader: React.FC<GroupHeaderProps> = ({ group, onEdit, onInvite, isAdmin }) => {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-8">
      <img
        src={group.coverImage}
        alt="Group Cover"
        className="w-24 h-24 rounded-lg object-cover shadow-lg border-4 border-slate-700"
      />
      <div className="flex-1 w-full">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          {group.name}
          <span className="ml-2 px-2 py-0.5 text-xs bg-slate-700 rounded-full uppercase tracking-wide">
            {group.privacy}
          </span>
        </h1>
        <p className="text-slate-300 mt-1">{group.description || t('common.noDescription')}</p>
        <div className="flex gap-4 mt-2 text-sm text-slate-400">
          <span>{t('groupDetails.created')}: {group.createdAt}</span>
        </div>
      </div>
      {isAdmin && (
        <div className="flex gap-2 mt-4 md:mt-0">
          {onEdit && <Button color="primary" onClick={onEdit}>{t('common.edit')}</Button>}
          {onInvite && <Button color="success" onClick={onInvite}>{t('groupDetails.invite')}</Button>}
        </div>
      )}
    </div>
  );
};

export default GroupHeader;
