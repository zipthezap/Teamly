import React from "react";
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
        <h2 className="text-xl font-semibold">Events</h2>
        {isAdmin && (
          <Button color="primary" size="sm" onClick={onCreate}>Create Event</Button>
        )}
      </div>
      <ul>
        {events.map((e) => (
          <li
            key={e.id}
            className={`mb-3 p-3 bg-slate-700 rounded flex items-center gap-3 cursor-pointer transition hover:bg-slate-600 border-l-4 ${isPastEvent(e.date) ? "border-slate-500 opacity-70" : "border-green-500"}`}
            onClick={() => onEventClick(e.id)}
            tabIndex={0}
            aria-label={`View details for ${e.title}`}
          >
            <div className="w-10 h-10 bg-slate-600 rounded flex items-center justify-center text-2xl">
              {e.type === "Football" ? "⚽" : e.type === "Tennis" ? "🎾" : "📅"}
            </div>
            <div>
              <div className="font-medium flex items-center gap-2">
                {e.title}
                {isPastEvent(e.date) && (
                  <span className="ml-2 text-xs bg-slate-500 px-2 py-0.5 rounded text-white">Past</span>
                )}
              </div>
              <div className="text-xs text-slate-400">{e.type} • {e.date}</div>
              <div className="text-xs text-slate-500">Organizer: {e.organizer}</div>
            </div>
            {isAdmin && (
              <div className="flex gap-2 ml-auto">
                <Button color="secondary" size="xs" onClick={e => { e.stopPropagation(); onEdit && onEdit(e); }}>Edit</Button>
                <Button color="danger" size="xs" onClick={ev => { ev.stopPropagation(); handleDeleteClick(e); }}>Delete</Button>
              </div>
            )}
            {!isAdmin && <Button color="secondary" size="xs" className="ml-auto">RSVP</Button>}
          </li>
        ))}
      </ul>
      {/* Delete confirmation dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-slate-800 p-6 rounded shadow-lg w-80 text-center">
            <div className="mb-4 text-lg">Delete this event?</div>
            <div className="mb-6 text-slate-400">Are you sure you want to delete <span className="font-bold">{eventToDelete?.title}</span>? This action cannot be undone.</div>
            <div className="flex gap-4 justify-center">
              <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded" onClick={confirmDelete}>Delete</button>
              <button className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded" onClick={() => setDeleteDialogOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default EventList;
