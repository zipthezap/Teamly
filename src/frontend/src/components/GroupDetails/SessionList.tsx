import React, { useState } from "react";
import GroupSessionsModal from "./GroupSessionsModal";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Button from "../common/Button";
import PlusIcon from "../icons/PlusIcon";
import { SessionWithDetails } from "../../../../shared/types";

interface SessionListProps {
  events: SessionWithDetails[];
  onEventClick: (eventId: string) => void;
  onCreate?: () => void;
  isAdmin?: boolean;
  groupId?: string;
  isMember?: boolean;
}

const isPastEvent = (date: string) => new Date(date) < new Date();
const formatEventDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};


const SessionList: React.FC<SessionListProps> = React.memo(({ events, onEventClick, onCreate, isAdmin, groupId, isMember }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [viewAllOpen, setViewAllOpen] = useState(false);

  const handleRequestEvent = () => {
    if (groupId) {
      navigate(`/event-requests/${groupId}`);
    }
  };

  // Hide past events: only show events whose startTime is within the last hour or in the future
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  // Filter and sort events: only show events starting >= one hour ago
  const filteredEvents = Array.isArray(events)
    ? [...events]
        .filter((event) => new Date(event.startTime) >= oneHourAgo)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    : [];


  // Wrap t to match GroupSessionsModal's required signature
  const tModal = (key: string, defaultText?: string) => t(key, defaultText ?? "");

  // All events for modal, sorted soonest first
  const allUpcomingEvents = filteredEvents;
  // Only show up to 5 events in the main list
  const visibleEvents = filteredEvents.slice(0, 5);

  return (
    <section className="bg-slate-800 rounded-lg p-3 sm:p-4 shadow">
      <div className="flex justify-between items-center mb-1.5 sm:mb-2">
        <h2 className="text-base sm:text-xl font-semibold">{t('groupDetails.events', 'Events')}</h2>
        <div className="flex gap-1.5 sm:gap-2 items-center">
          <button
            onClick={() => setViewAllOpen(true)}
            className="px-2 py-1 sm:px-3 sm:py-1.5 bg-slate-700 hover:bg-slate-600 text-pink-400 rounded text-xs sm:text-sm font-medium transition shadow-none focus:outline-none"
            style={{ minWidth: 0 }}
          >
            {t('groupDetails.viewAll', 'View All')}
          </button>
          {/* View All Modal */}
          <GroupSessionsModal
            open={viewAllOpen}
            onClose={() => setViewAllOpen(false)}
            events={allUpcomingEvents}
            onEventClick={onEventClick}
            t={tModal}
          />
          {/* Request Event button - available for all members including admins */}
          {isMember && !isAdmin && groupId && (
            <button
              onClick={handleRequestEvent}
              className="flex items-center justify-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs sm:text-sm font-medium transition shadow-none focus:outline-none"
              aria-label={t('groupDetails.requestEvent', 'Request Event')}
            >
              <PlusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t('groupDetails.requestEvent', 'Request Event')}</span>
            </button>
          )}
          {isAdmin && onCreate && (
            <button
              onClick={onCreate}
              className="flex items-center justify-center text-blue-500 hover:text-blue-700 transition focus:outline-none"
              aria-label={t('groupDetails.createEvent', 'Create Event')}
              style={{ width: 32, height: 32, minWidth: 0, background: 'none', borderRadius: '0.5rem' }}
            >
              <PlusIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
        </div>
      </div>
      {visibleEvents.length === 0 ? (
        <div className="text-slate-400 text-center py-4">{t('groupDetails.noEvents', 'No events found.')}</div>
      ) : (
        <ul>
          {visibleEvents.map((event) => {
            const eventDate: string = typeof event.startTime === 'string' ? event.startTime : event.startTime.toISOString();
            const eventType = event.eventType;
            const organizerName = event.creator?.name || 'Unknown';
            const isPast = isPastEvent(eventDate);
            // Accept any non-empty string as valid event ID (UUID)
            const eventIdStr: string | null = (typeof event.id === 'string' && event.id.trim() !== '') ? event.id : null;
            return (
              <li
                key={event.id}
                className={`mb-0.5 p-1.5 sm:p-2 bg-slate-700 rounded flex items-center gap-1.5 sm:gap-2 cursor-pointer transition hover:bg-slate-600 border-l-4 ${isPast ? "border-slate-500 opacity-70" : "border-green-500"}`}
                onClick={() => {
                  if (eventIdStr !== null) onEventClick(eventIdStr);
                }}
                tabIndex={0}
                aria-label={`${t('common.viewDetails')} ${event.title}`}
                style={eventIdStr === null ? { pointerEvents: 'none', opacity: 0.5 } : {}}
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-600 rounded flex items-center justify-center flex-shrink-0">
                  {/* Custom date icon: show month and day */}
                  {(() => {
                    const dateObj = new Date(eventDate);
                    const month = dateObj.toLocaleString('en-US', { month: 'short' });
                    const day = dateObj.getDate();
                    return (
                      <div className="flex flex-col items-center justify-center w-full h-full">
                        <span className="text-[9px] sm:text-[10px] font-bold text-blue-300 leading-none">{month}</span>
                        <span className="text-sm sm:text-base font-extrabold text-white leading-none">{day}</span>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium flex items-center gap-1 ${isPast ? 'line-through text-slate-400' : ''}`}>
                    <span className="text-xs sm:text-sm truncate">{event.title}</span>
                    {isPast && (
                      <span className="ml-1 text-[10px] bg-slate-500 px-1 py-0.5 rounded text-white flex-shrink-0">{t('groupDetails.past')}</span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">{eventType} • {formatEventDate(eventDate)}</div>
                  <div className="hidden sm:block text-[11px] text-slate-500">{t('groupDetails.organizer')}: {organizerName}</div>
                </div>
                {!isAdmin && <Button color="secondary" size="small" className="ml-auto text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 flex-shrink-0">{t('groupDetails.rsvp')}</Button>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
});

SessionList.displayName = 'SessionList';

export default SessionList;
