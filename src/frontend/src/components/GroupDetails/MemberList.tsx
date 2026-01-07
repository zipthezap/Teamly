import React from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";

interface MemberListProps {
  members: any[];
  onRemove?: (email: string) => void;
}

const getInitials = (name: string | undefined | null) => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) return '';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
};

const MemberList: React.FC<MemberListProps> = ({ members, onRemove }) => {
  const { t } = useTranslation();
  
  return (
    <section className="bg-slate-800 rounded-lg p-4 shadow">
      <h2 className="text-xl font-semibold mb-2">{t('groupDetails.members', { count: members.length })}</h2>
      <ul>
        {members.map((m) => {
          // Handle both API structure (m.user.name) and direct structure (m.name)
          const memberName = m.user?.name || m.name || 'Unknown';
          const memberEmail = m.user?.email || m.email || '';
          const memberRole = m.role || 'member';
          const memberAvatar = m.user?.avatar || m.avatar;
          const isOnline = m.user?.online ?? m.online ?? false;
          
          return (
          <li key={memberEmail} className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-lg font-bold overflow-hidden">
              {memberAvatar ? (
                <img src={memberAvatar} alt={memberName} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span>{getInitials(memberName)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium">{memberName}</span>
              {(memberRole?.toLowerCase() === "admin") && (
                <span className="ml-2 text-xs bg-blue-700 px-2 py-0.5 rounded">{t('groupDetails.admin')}</span>
              )}
              <div className="text-xs text-slate-400">{memberEmail}</div>
            </div>
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? "bg-green-400" : "bg-slate-500"}`}
              title={isOnline ? t('groupDetails.online') : t('groupDetails.offline')}
            ></span>
            {onRemove && (
              <Button color="danger" size="xs" className="ml-2 flex-shrink-0" onClick={() => onRemove(memberEmail)}>
                {t('groupDetails.remove')}
              </Button>
            )}
          </li>
          );
        })}
      </ul>
    </section>
  );
};

export default MemberList;
