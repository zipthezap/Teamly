import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import { groupsAPI } from "../../services/api";
import { GroupMember } from "../../../../shared/types";
import ProfileAvatar from "../common/ProfileAvatar";

interface MemberListProps {
  groupId: string;
  isAdmin?: boolean;
  onRemove?: (memberId: string) => void;
}

const MemberList: React.FC<MemberListProps> = ({ groupId, isAdmin, onRemove }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Fetch members fresh from API
  const { data: members = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["groupMembers", groupId],
    queryFn: async () => {
      const res = await groupsAPI.getMembers(groupId);
      return Array.isArray(res.data) ? res.data : (res.data?.members ?? []);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const currentUserId = user?.id || '';

  const handleRemove = async (memberId: string) => {
    if (!onRemove) return;
    setRemovingId(memberId);
    try {
      await onRemove(memberId);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["groupMembers", groupId] });
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) return <div className="text-slate-400 py-4">{t('groupDetails.loadingMembers')}</div>;
  if (isError) return <div className="text-red-400 py-4">{t('groupDetails.failedToLoadMembers')}</div>;

  return (
    <section className="bg-slate-800 rounded-lg p-4 shadow">
      <h2 className="text-xl font-semibold mb-2">{t('groupDetails.members', { count: members.length })}</h2>
      {members.length === 0 ? (
        <div className="text-slate-400 text-center py-4">{t('groupDetails.noMembers', 'No members found.')}</div>
      ) : (
        <ul>
          {members.map((m: GroupMember) => {
            const memberName = m.user?.name || m.name || 'Unknown';
            const memberEmail = m.user?.email || m.email || '';
            const memberRole = m.role || 'member';
            const memberProfilePicture = m.user?.profilePicture || m.profilePicture;
            const profilePictureUrl = getImageUrl(memberProfilePicture);
            const isOnline = m.user?.online ?? m.online ?? false;
            const memberId = m.userId || m.user?.id || m.id || '';
            const isSelfAdmin = memberRole?.toLowerCase() === 'admin' && (
              memberId && currentUserId && String(memberId) === String(currentUserId)
            );
            return (
              <li key={memberId} className="flex items-center gap-3 mb-2">
                <ProfileAvatar
                  picture={memberProfilePicture}
                  name={memberName}
                  size={32}
                />
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
                {isAdmin && onRemove && !isSelfAdmin && memberId && (
                  <button
                    className="ml-2 flex-shrink-0 text-red-500 hover:text-red-700 p-1 rounded focus:outline-none disabled:opacity-50"
                    title={t('groupDetails.remove')}
                    onClick={() => handleRemove(memberId)}
                    disabled={removingId === memberId}
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
      )}
    </section>
  );
};

MemberList.displayName = 'MemberList';

export default MemberList;
