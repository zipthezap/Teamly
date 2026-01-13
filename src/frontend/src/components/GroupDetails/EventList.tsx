import React, { useState } from "react";
import GroupEventsModal from "./GroupEventsModal";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import PlusIcon from "../icons/PlusIcon";
import { EventWithDetails } from "../../../../shared/types";

interface EventListProps {
  events: EventWithDetails[];
  onEventClick: (eventId: number) => void;
  onCreate?: () => void;
  onEdit?: (event: EventWithDetails) => void;
  onDelete?: (event: EventWithDetails) => void;
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


const EventList: React.FC<EventListProps> = ({ events, onEventClick, onCreate, onEdit, onDelete, isAdmin, groupId, isMember }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventWithDetails | null>(null);
  const [viewAllOpen, setViewAllOpen] = useState(false);

  const handleDeleteClick = (event: EventWithDetails) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };
  const confirmDelete = () => {
    if (eventToDelete && onDelete) onDelete(eventToDelete);
    setDeleteDialogOpen(false);
    setEventToDelete(null);
  };

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


  // Debug: Log filtered events
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.debug('[Group EventList] Filtered events:', filteredEvents);
  }

  // Wrap t to match GroupEventsModal's required signature
  const tModal = (key: string, defaultText?: string) => t(key, defaultText ?? "");

  // All events for modal, sorted soonest first
  const allUpcomingEvents = filteredEvents;

  return (
    <section className="bg-slate-800 rounded-lg p-4 shadow">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">{t('groupDetails.events', 'Events')}</h2>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setViewAllOpen(true)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-pink-400 rounded text-sm font-medium transition shadow-none focus:outline-none"
            style={{ minWidth: 0 }}
          >
            {t('groupDetails.viewAll', 'View All')}
          </button>
          {/* View All Modal */}
          <GroupEventsModal
            open={viewAllOpen}
            onClose={() => setViewAllOpen(false)}
            events={allUpcomingEvents}
            onEventClick={onEventClick}
            t={tModal}
          />
          {/* Request Event button for non-admin members */}
          {!isAdmin && isMember && groupId && (
            <button
              onClick={handleRequestEvent}
              className="ml-2 flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition shadow-none focus:outline-none"
              aria-label={t('groupDetails.requestEvent', 'Request Event')}
            >
              <PlusIcon className="w-4 h-4" />
              {t('groupDetails.requestEvent', 'Request Event')}
            </button>
          )}
          {isAdmin && onCreate && (
            <button
              onClick={onCreate}
              className="ml-2 flex items-center justify-center text-blue-500 hover:text-blue-700 transition focus:outline-none"
              aria-label={t('groupDetails.createEvent', 'Create Event')}
                    style={{ width: 40, height: 40, minWidth: 0, background: 'none', borderRadius: '0.5rem' }}
                  >
                    <PlusIcon className="w-6 h-6" />
                  </button>
                )}
              </div>
            </div>
            {filteredEvents.length === 0 ? (
              <div className="text-slate-400 text-center py-4">{t('groupDetails.noEvents', 'No events found.')}</div>
            ) : (
              <ul>
                {filteredEvents.map((event) => {
                  const eventDate: string = typeof event.startTime === 'string' ? event.startTime : event.startTime.toISOString();
                  const eventType = event.eventType;
                  const organizerName = event.creator?.name || 'Unknown';
                  const isPast = isPastEvent(eventDate);
                  // Accept any non-empty string as valid event ID (UUID)
                  const eventIdStr: string | null = (typeof event.id === 'string' && event.id.trim() !== '') ? event.id : null;
                  if (eventIdStr === null) {
                    // eslint-disable-next-line no-console
                    console.warn('[EventList] Invalid event.id:', event.id, event);
                  }
                  return (
                    <li
                      key={event.id}
                      className={`mb-3 p-3 bg-slate-700 rounded flex items-center gap-3 cursor-pointer transition hover:bg-slate-600 border-l-4 ${isPast ? "border-slate-500 opacity-70" : "border-green-500"}`}
                      onClick={() => {
                        if (eventIdStr !== null) onEventClick(eventIdStr);
                      }}
                      tabIndex={0}
                      aria-label={`${t('common.viewDetails')} ${event.title}`}
                      style={eventIdStr === null ? { pointerEvents: 'none', opacity: 0.5 } : {}}
                    >
                      <div className="w-10 h-10 bg-slate-600 rounded flex items-center justify-center">
                        {/* Custom date icon: show month and day */}
                        {(() => {
                          const dateObj = new Date(eventDate);
                          const month = dateObj.toLocaleString('en-US', { month: 'short' });
                          const day = dateObj.getDate();
                          return (
                            <div className="flex flex-col items-center justify-center w-full h-full">
                              <span className="text-xs font-bold text-blue-300 leading-none">{month}</span>
                              <span className="text-lg font-extrabold text-white leading-none">{day}</span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex-1">
                        <div className={`font-medium flex items-center gap-2 ${isPast ? 'line-through text-slate-400' : ''}`}> 
                          {event.title}
                          {isPast && (
                            <span className="ml-2 text-xs bg-slate-500 px-2 py-0.5 rounded text-white">{t('groupDetails.past')}</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{eventType} • {formatEventDate(eventDate)}</div>
                        <div className="text-xs text-slate-500">{t('groupDetails.organizer')}: {organizerName}</div>
                      </div>
                      {/* Removed Edit and Delete buttons for events as requested */}
                      {!isAdmin && <Button color="secondary" size="xs" className="ml-auto">{t('groupDetails.rsvp')}</Button>}
                    </li>
                  );
                })}
              </ul>
            )}
        {deleteDialogOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
            <div className="bg-slate-800 p-6 rounded shadow-lg w-80 text-center">
              <div className="mb-4 text-lg">{t('groupDetails.deleteThisEvent')}</div>
              <div className="mb-6 text-slate-400">
                {t('groupDetails.confirmDeleteEventDesc', { title: eventToDelete?.title })}
              </div>
              <div className="flex gap-4 justify-center">
                <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded" onClick={confirmDelete}>{t('common.delete')}</button>
                <button className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded" onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        )}
    </section>
  );
};

export default EventList;
