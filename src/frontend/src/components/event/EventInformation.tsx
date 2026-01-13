import React from 'react';
import { EventWithDetails } from '../../../../shared/types';


interface EventInformationProps {
  event: EventWithDetails;
  isParticipant: boolean;
  isCreator: boolean;
  isFull: boolean;
}

const EventInformation: React.FC<EventInformationProps> = ({
  event,
  isParticipant,
  isCreator,
  isFull,
}) => {
  return (
    <>
      {/* Header Section */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 text-white text-2xl font-bold">
          {event.eventType?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{event.title}</div>
          <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-semibold">
              {event.eventType}
            </span>
            {isFull && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-semibold">Full</span>
            )}
            {isParticipant && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-semibold">Joined</span>
            )}
            {isCreator && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-semibold">Organizer</span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <div className="text-lg font-semibold mb-1">Description</div>
        <div className="text-base text-gray-700 dark:text-gray-300">
          {event.description || 'No description provided'}
        </div>
      </div>

      {/* Time and Location Details */}
      <div>
        <div className="text-lg font-semibold mb-2">Event Details</div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            {/* Clock SVG */}
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <div>
              <div className="text-xs text-gray-500">Start Time</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {new Date(event.startTime).toLocaleString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
          {event.endTime && (
            <div className="flex items-center gap-2">
              {/* Calendar SVG */}
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" /></svg>
              <div>
                <div className="text-xs text-gray-500">End Time</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {new Date(event.endTime).toLocaleString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2">
              {/* Location SVG */}
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 21c-4.418 0-8-3.582-8-8 0-4.418 3.582-8 8-8s8 3.582 8 8c0 4.418-3.582 8-8 8z" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></svg>
              <div>
                <div className="text-xs text-gray-500">Location</div>
                <div className="font-medium text-gray-900 dark:text-white">{event.location}</div>
              </div>
            </div>
          )}
          {event.isRecurring && event.recurrenceRule && (
            <div className="flex items-start gap-2">
              {/* Repeat SVG */}
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 1l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 11V9a4 4 0 014-4h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M7 23l-4-4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <div>
                <div className="text-xs text-gray-500">Recurring Event</div>
                <div className="font-medium text-gray-900 dark:text-white">{event.recurrenceRule}</div>
                {event.recurrenceEnd && (
                  <div className="text-xs text-gray-500">Until {new Date(event.recurrenceEnd).toLocaleDateString()}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default EventInformation;
