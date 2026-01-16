import React from "react";
import { useTranslation } from "react-i18next";
import { Group } from "../../types/group";
import Button from "../ui/Button";
import EditIcon from "../icons/EditIcon";
import TrashIcon from "../icons/TrashIcon";
import LinkIcon from "../icons/LinkIcon";
import GroupAddIcon from "../icons/GroupAddIcon";
import ArrowRightIcon from "../icons/ArrowRightIcon";
import ClipboardIcon from "../icons/ClipboardIcon";
import JoinRequestsPopover from "../JoinRequestsPopover";
import { getImageUrl } from "../../utils/imageUtils";

interface GroupHeaderProps {
  group: Group;
  onEdit?: () => void;
  onDelete?: () => void;
  onLeave?: () => void;
  onInvite?: () => void;
  onCopyLink?: () => void;
  onViewEventRequests?: () => void;
  isAdmin?: boolean;
}

const DEFAULT_COVER = "/default-group-cover.jpg";
const GroupHeader: React.FC<GroupHeaderProps> = React.memo(({ 
  group, 
  onEdit, 
  onDelete, 
  onLeave, 
  onInvite, 
  onCopyLink, 
  onViewEventRequests,
  isAdmin
}) => {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-8">
      <img
        src={getImageUrl(group.picture, DEFAULT_COVER) || DEFAULT_COVER}
        alt="Group Cover"
        className="w-24 h-24 rounded-lg object-cover shadow-lg border-4 border-slate-700"
      />
      <div className="flex-1 w-full">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          {group.name}
          {isAdmin && (
            <JoinRequestsPopover groupId={group.id} showOnlyIfPending />
          )}
          <span className="ml-2 px-2 py-0.5 text-xs bg-slate-700 rounded-full uppercase tracking-wide">
            {group.privacy || (group.isPublic ? 'public' : 'private')}
          </span>
        </h1>
        <p className="text-slate-300 mt-1">{group.description || t('common.noDescription')}</p>
        <div className="flex gap-4 mt-2 text-sm text-slate-400">
          <span>{t('groupDetails.created')}: {typeof group.createdAt === 'string' ? group.createdAt : new Date(group.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
        {isAdmin && onViewEventRequests && (
          <Button color="info" onClick={onViewEventRequests} className="rounded-full p-2 min-w-0 w-14 h-14 flex items-center justify-center" aria-label={t('groupDetails.viewEventRequests')}>
            <ClipboardIcon className="w-8 h-8" />
          </Button>
        )}
        {onEdit && (
          <Button color="primary" onClick={onEdit} className="rounded-full p-2 min-w-0 w-14 h-14 flex items-center justify-center" aria-label={t('groupDetails.editGroup')}>
            <EditIcon className="w-8 h-8" />
          </Button>
        )}
        {onDelete && (
          <Button color="danger" onClick={onDelete} className="rounded-full p-2 min-w-0 w-14 h-14 flex items-center justify-center" aria-label={t('groupDetails.deleteGroup')}>
            <TrashIcon className="w-8 h-8" />
          </Button>
        )}
        {onCopyLink && (
          <Button color="info" onClick={onCopyLink} className="rounded-full p-2 min-w-0 w-14 h-14 flex items-center justify-center" aria-label={t('groupDetails.copyLink')}>
            <LinkIcon className="w-8 h-8" />
          </Button>
        )}
        {onInvite && (
          <Button color="success" onClick={onInvite} className="rounded-full p-2 min-w-0 w-14 h-14 flex items-center justify-center" aria-label={t('groupDetails.invite')}>
            <GroupAddIcon className="w-8 h-8" />
          </Button>
        )}
        {onLeave && (
          <Button color="secondary" onClick={onLeave} className="rounded-full p-2 min-w-0 w-14 h-14 flex items-center justify-center" aria-label={t('groupDetails.leave')}>
            <ArrowRightIcon className="w-8 h-8" />
          </Button>
        )}
      </div>
    </div>
  );
});

GroupHeader.displayName = 'GroupHeader';

export default GroupHeader;
