import React from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import { getImageUrl, getInitials } from "../../utils/imageUtils";
import { useAuth } from "../../contexts/AuthContext";
import { GroupMember } from "../../../../shared/types";

interface MemberListProps {
  members: GroupMember[];
  onRemove?: (email: string) => void;
}

const MemberList: React.FC<MemberListProps> = ({ members, onRemove }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const currentUserEmail = user?.email || '';
  const currentUserId = user?.id || '';
  
  return (
    <section className="bg-slate-800 rounded-lg p-4 shadow">
      <h2 className="text-xl font-semibold mb-2">{t('groupDetails.members', { count: members.length })}</h2>
      <ul>
        {members.map((m) => {
          const memberName = m.user?.name || m.name || 'Unknown';
          const memberEmail = m.user?.email || m.email || '';
          const memberRole = m.role || 'member';
          const memberProfilePicture = m.user?.profilePicture || m.profilePicture;
          const profilePictureUrl = getImageUrl(memberProfilePicture);
          const isOnline = m.user?.online ?? m.online ?? false;
          const memberId = m.user?.id || m.id || '';
          const isSelfAdmin = memberRole?.toLowerCase() === 'admin' && (
            (memberEmail && currentUserEmail && memberEmail.toLowerCase() === currentUserEmail.toLowerCase()) ||
            (memberId && currentUserId && String(memberId) === String(currentUserId))
          );
          
          return (
            <li key={memberEmail} className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-lg font-bold overflow-hidden">
                {profilePictureUrl ? (
                  <img src={profilePictureUrl} alt={memberName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span>{getInitials(memberName)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium">{memberName}</span>
                {(memberRole?.toLowerCase() === "admin") && (
                  <span
                    className="ml-2 text-xs border border-blue-400 text-blue-400 bg-blue-900/10 px-2 py-0.5 rounded-full font-semibold tracking-wide shadow-sm"
                    style={{ letterSpacing: '0.04em' }}
                  >
                    {t('groupDetails.admin')}
                  </span>
                )}
                <div className="text-xs text-slate-400">{memberEmail}</div>
              </div>
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? "bg-green-400" : "bg-slate-500"}`}
                title={isOnline ? t('groupDetails.online') : t('groupDetails.offline')}
              ></span>
              {onRemove && !isSelfAdmin && (
                <button
                  className="ml-2 flex-shrink-0 text-red-500 hover:text-red-700 p-1 rounded focus:outline-none"
                  title={t('groupDetails.remove')}
                  onClick={() => onRemove(memberEmail)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M6.293 6.293a1 1 0 011.414 0L10 8.586l2.293-2.293a1 1 0 111.414 1.414L11.414 10l2.293 2.293a1 1 0 01-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 01-1.414-1.414L8.586 10 6.293 7.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default MemberList;
