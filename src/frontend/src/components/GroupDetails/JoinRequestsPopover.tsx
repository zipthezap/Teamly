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

  return (
    <div className="relative">
      <button
        className="ml-2 text-yellow-400 hover:text-yellow-500"
        title={t('groupDetails.joinRequests')}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('groupDetails.joinRequests')}
      >
        <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-7v-4a1 1 0 112 0v4a1 1 0 11-2 0zm1 4a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded shadow-lg p-4">
          <h3 className="font-semibold mb-2 text-yellow-300">{t('groupDetails.joinRequests')}</h3>
          {requests.length === 0 ? (
            <div className="text-slate-400">{t('groupDetails.noJoinRequests')}</div>
          ) : (
            <ul>
              {requests.map((req) => (
                <li key={req.id} className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{req.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{req.email}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button color="success" size="xs" onClick={() => onAccept(req.id)}>{t('common.accept')}</Button>
                    <Button color="danger" size="xs" onClick={() => onDecline(req.id)}>{t('common.decline')}</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default JoinRequestsPopover;
