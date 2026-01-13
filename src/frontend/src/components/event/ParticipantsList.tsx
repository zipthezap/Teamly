import React from 'react';
// All MUI imports removed; using Tailwind and SVGs only
import { getAvatarColor } from '../../utils/colors';
import { getImageUrl, getInitials } from '../../utils/imageUtils';
import { getParticipantStatusColor } from '../../utils/statusHelpers';

interface ParticipantsListProps {
  event: any;
  participantCount: number;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'confirmed':
      return (
        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M9 12l2 2l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      );
    case 'declined':
      return (
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      );
  }
};

const ParticipantsList: React.FC<ParticipantsListProps> = ({ event, participantCount }) => {
  return (
    <div className="bg-white dark:bg-[#1a2233] rounded-xl shadow-md p-6">
      <div className="text-lg font-semibold mb-4">Participants ({participantCount})</div>
      {(!event.participants || event.participants.length === 0) ? (
        <div className="flex flex-col items-center py-8 text-center">
          <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" /><path d="M5.5 21a7.5 7.5 0 0 1 13 0" stroke="currentColor" strokeWidth="2" /></svg>
          <div className="text-gray-400">No participants yet. Be the first to join!</div>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {event.participants.map((participant: any, idx: number) => {
            const attendance = event.eventAttendances?.find((a: any) => a.userId === participant.userId);
            const isLate = attendance?.status === 'late';
            const profilePictureUrl = getImageUrl(participant.user?.profilePicture);
            return (
              <li key={participant.id} className="flex items-center py-3 gap-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition">
                {/* Avatar */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white overflow-hidden" style={{ background: getAvatarColor(idx) }}>
                  {profilePictureUrl ? (
                    <img src={profilePictureUrl} alt={participant.user?.name} className="w-full h-full object-cover" />
                  ) : (
                    getInitials(participant.user?.name)
                  )}
                </div>
                {/* Name, badges, email */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                    {participant.user?.name}
                    {participant.userId === event.creatorId && (
                      <span className="ml-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-semibold">Organizer</span>
                    )}
                    {isLate && (
                      <span className="ml-1 px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs font-semibold">Late</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{participant.user?.email}</div>
                </div>
                {/* Status chip */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${getParticipantStatusColor(participant.status)}`}
                  style={{ minWidth: 80, justifyContent: 'center' }}
                >
                  {getStatusIcon(participant.status)}
                  <span className="capitalize">{participant.status}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ParticipantsList;
