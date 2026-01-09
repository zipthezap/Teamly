import React from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";

interface JoinRequest {
  id: string;
  name: string;
  email: string;
}

interface JoinRequestsPopoverProps {
  requests: JoinRequest[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

const JoinRequestsPopover: React.FC<JoinRequestsPopoverProps> = ({ requests, onAccept, onDecline }) => {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const requestCount = requests.length;

  return (
    <div className="relative">
      <button
        className="ml-2 relative text-yellow-400 hover:text-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-slate-900 rounded-full p-1"
        title={t('groupDetails.joinRequests')}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('groupDetails.joinRequests')}
      >
        {/* User group icon with plus */}
        <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          <circle cx="19" cy="8" r="1" fill="currentColor"/>
          <path d="M19 5v2h-2v2h2v2h2V9h2V7h-2V5h-2z" fill="currentColor" stroke="currentColor" strokeWidth="0.5"/>
        </svg>
        {/* Count badge */}
        {requestCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
            {requestCount}
          </span>
        )}
      </button>
      {open && (
        <>
          {/* Backdrop to close popover when clicking outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
              <h3 className="font-semibold text-yellow-300 flex items-center gap-2">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                {t('groupDetails.joinRequests')} ({requestCount})
              </h3>
              <button 
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Close join requests"
              >
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            {requests.length === 0 ? (
              <div className="text-slate-400 text-center py-4">{t('groupDetails.noJoinRequests')}</div>
            ) : (
              <ul className="space-y-3">
                {requests.map((req) => (
                  <li key={req.id} className="bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition">
                    <div className="mb-2">
                      <div className="font-medium text-white">{req.name}</div>
                      <div className="text-xs text-slate-400">{req.email}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        color="success" 
                        size="sm" 
                        onClick={() => {
                          onAccept(req.id);
                          // Keep popover open to handle multiple requests
                        }}
                        className="flex-1"
                      >
                        ✓ {t('common.accept')}
                      </Button>
                      <Button 
                        color="danger" 
                        size="sm" 
                        onClick={() => {
                          onDecline(req.id);
                          // Keep popover open to handle multiple requests
                        }}
                        className="flex-1"
                      >
                        ✗ {t('common.decline')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default JoinRequestsPopover;
