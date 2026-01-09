import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import PlusIcon from "../icons/PlusIcon";

interface EventListProps {
  events: any[];
  onEventClick: (eventId: number) => void;
  onCreate?: () => void;
  onEdit?: (event: any) => void;
  onDelete?: (event: any) => void;
  isAdmin?: boolean;
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


const EventList: React.FC<EventListProps> = ({ events, onEventClick, onCreate, onEdit, onDelete, isAdmin }) => {
  const { t } = useTranslation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  const handleDeleteClick = (event: any) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };
  const confirmDelete = () => {
    if (eventToDelete && onDelete) onDelete(eventToDelete);
    setDeleteDialogOpen(false);
    setEventToDelete(null);
  };

  const filteredEvents = events;

  return (
    <section className="bg-slate-800 rounded-lg p-4 shadow">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">{t('groupDetails.events', 'Events')}</h2>
        <div className="flex gap-2">
            <a
              href="/events"
              className="text-pink-400 hover:underline text-sm font-medium"
              onClick={(e) => { e.preventDefault(); window.location.href = '/events'; }}
            >
              {t('groupDetails.viewAll', 'View All')}
            </a>
          {isAdmin && onCreate && (
            <Button color="primary" size="sm" onClick={onCreate} className="rounded-full p-2 min-w-0 w-10 h-10 flex items-center justify-center" aria-label={t('groupDetails.createEvent', 'Create Event')}>
              <PlusIcon className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
      {filteredEvents.length === 0 ? (
        <div className="text-slate-400 text-center py-4">{t('groupDetails.noEvents', 'No events found.')}</div>
      ) : (
        <ul>
          {filteredEvents.map((event) => {
            const eventDate = event.startTime || event.date;
            const eventType = event.eventType || event.type;
            const organizerName = event.creator?.name || event.organizer || 'Unknown';
            return (
              <li
                key={event.id}
                className={`mb-3 p-3 bg-slate-700 rounded flex items-center gap-3 cursor-pointer transition hover:bg-slate-600 border-l-4 ${isPastEvent(eventDate) ? "border-slate-500 opacity-70" : "border-green-500"}`}
                onClick={() => onEventClick(event.id)}
                tabIndex={0}
                aria-label={`${t('common.viewDetails')} ${event.title}`}
              >
                <div className="w-10 h-10 bg-slate-600 rounded flex items-center justify-center text-2xl">
                  {eventType === "Football" ? "⚽" : eventType === "Tennis" ? "🎾" : "📅"}
                </div>
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {event.title}
                    {isPastEvent(eventDate) && (
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
      {/* Delete confirmation dialog */}
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
