import React from "react";
import { useTranslation } from "react-i18next";
import { Event } from "../../types/group";
import Button from "../ui/Button";

interface EventListProps {
  events: Event[];
  onEventClick: (eventId: number) => void;
  onCreate?: () => void;
  onEdit?: (event: Event) => void;
  onDelete?: (event: Event) => void;
  isAdmin?: boolean;
}

const isPastEvent = (date: string) => new Date(date) < new Date();


const EventList: React.FC<EventListProps> = ({ events, onEventClick, onCreate, onEdit, onDelete, isAdmin }) => {
  const { t } = useTranslation();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [eventToDelete, setEventToDelete] = React.useState<Event | null>(null);

  const handleDeleteClick = (event: Event) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };
  const confirmDelete = () => {
    if (eventToDelete && onDelete) onDelete(eventToDelete);
    setDeleteDialogOpen(false);
    setEventToDelete(null);
  };

  return (
    <section className="bg-slate-800 rounded-lg p-4 shadow">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">{t('groupDetails.events')}</h2>
        {isAdmin && onCreate && (
          <Button color="primary" size="sm" onClick={onCreate}>{t('groupDetails.createEvent')}</Button>
        )}
      </div>
      {events.length === 0 ? (
        <div className="text-slate-400 text-center py-4">{t('groupDetails.noEvents')}</div>
      ) : (
        <ul>
          {events.map((event) => (
            <li
              key={event.id}
              className={`mb-3 p-3 bg-slate-700 rounded flex items-center gap-3 cursor-pointer transition hover:bg-slate-600 border-l-4 ${isPastEvent(event.date) ? "border-slate-500 opacity-70" : "border-green-500"}`}
              onClick={() => onEventClick(event.id)}
              tabIndex={0}
              aria-label={`${t('common.viewDetails')} ${event.title}`}
            >
              <div className="w-10 h-10 bg-slate-600 rounded flex items-center justify-center text-2xl">
                {event.type === "Football" ? "⚽" : event.type === "Tennis" ? "🎾" : "📅"}
              </div>
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  {event.title}
                  {isPastEvent(event.date) && (
                    <span className="ml-2 text-xs bg-slate-500 px-2 py-0.5 rounded text-white">{t('groupDetails.past')}</span>
                  )}
                </div>
                <div className="text-xs text-slate-400">{event.type} • {event.date}</div>
                <div className="text-xs text-slate-500">{t('groupDetails.organizer')}: {event.organizer}</div>
              </div>
              {isAdmin && (
                <div className="flex gap-2 ml-auto" onClick={(ev) => ev.stopPropagation()}>
                  {onEdit && <Button color="secondary" size="xs" onClick={() => onEdit(event)}>{t('groupDetails.editEvent')}</Button>}
                  {onDelete && <Button color="danger" size="xs" onClick={() => handleDeleteClick(event)}>{t('groupDetails.deleteEvent')}</Button>}
                </div>
              )}
              {!isAdmin && <Button color="secondary" size="xs" className="ml-auto">{t('groupDetails.rsvp')}</Button>}
            </li>
          ))}
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
