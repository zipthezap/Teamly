import React from "react";
import { EventWithDetails } from '../../../../shared/types';

interface GroupEventsModalProps {
  open: boolean;
  onClose: () => void;
  events: EventWithDetails[];
  onEventClick: (eventId: string) => void;
  t: (key: string, defaultText?: string) => string;
}

const formatEventDate = (dateString: string | Date) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const GroupEventsModal: React.FC<GroupEventsModalProps> = ({ open, onClose, events, onEventClick, t }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-slate-900 p-0 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-800">
          <h2 className="text-3xl font-bold tracking-tight text-white">{t('groupDetails.allUpcomingEvents', 'All Upcoming Events')}</h2>
          <button className="text-slate-400 hover:text-white text-3xl font-bold px-2" onClick={onClose}>&times;</button>
        </div>
        {/* Event List (scrollable) */}
        <div className="flex-1 px-8 py-6 bg-slate-900">
          <div className="max-h-[60vh] overflow-y-auto">
            {events.length === 0 ? (
              <div className="text-slate-400 text-center py-8 text-lg">{t('groupDetails.noEvents', 'No events found.')}</div>
            ) : (
              <ul className="space-y-2">
                {events.map((event) => {
                  const eventDate = event.startTime || event.date || new Date().toISOString();
                  const eventType = event.eventType;
                  const organizerName = event.creator?.name || 'Unknown';
                  return (
                    <li
                      key={event.id}
                      className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg shadow flex items-center gap-3 p-2 cursor-pointer border border-slate-700 hover:border-pink-500 hover:shadow-lg transition group"
                      onClick={() => { onClose(); onEventClick(event.id); }}
                      tabIndex={0}
                      aria-label={`${t('common.viewDetails')} ${event.title}`}
                    >
                      {/* Smaller date badge */}
                      <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-slate-950 border-2 border-pink-500 group-hover:bg-pink-900/30 transition">
                        <span className="text-xs font-bold text-pink-400 leading-none">
                          {new Date(eventDate).toLocaleString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-base font-extrabold text-white leading-none">
                          {new Date(eventDate).getDate()}
                        </span>
                      </div>
                      {/* Event info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-sm font-medium text-white truncate">{event.title}</span>
                          <span className="ml-1 px-1 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-pink-600/20 text-pink-400">{eventType}</span>
                        </div>
                        <div className="text-xs text-slate-300 mb-0.5">
                          {formatEventDate(eventDate)}
                        </div>
                        <div className="text-[10px] text-slate-500 italic">
                          {t('groupDetails.organizer')}: {organizerName}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupEventsModal;
