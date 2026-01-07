import React from "react";
import { useTranslation } from "react-i18next";
import { Member } from "../../types/group";
import Button from "../ui/Button";

interface MemberListProps {
  members: Member[];
  onRemove?: (email: string) => void;
}

const getInitials = (name: string) => {
  if (!name || typeof name !== 'string') return '';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
};

const MemberList: React.FC<MemberListProps> = ({ members, onRemove }) => {
  const { t } = useTranslation();
  
  return (
    <section className="bg-slate-800 rounded-lg p-4 shadow">
      <h2 className="text-xl font-semibold mb-2">{t('groupDetails.members', { count: members.length })}</h2>
      <ul>
        {members.map((m) => (
          <li key={m.email} className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-lg font-bold overflow-hidden">
              {m.avatar ? (
                <img src={m.avatar} alt={m.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span>{getInitials(m.name)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium">{m.name}</span>
              {m.role === "Admin" && (
                <span className="ml-2 text-xs bg-blue-700 px-2 py-0.5 rounded">{t('groupDetails.admin')}</span>
              )}
              <div className="text-xs text-slate-400">{m.email}</div>
            </div>
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${m.online ? "bg-green-400" : "bg-slate-500"}`}
              title={m.online ? t('groupDetails.online') : t('groupDetails.offline')}
            ></span>
            {onRemove && (
              <Button color="danger" size="xs" className="ml-2 flex-shrink-0" onClick={() => onRemove(m.email)}>
                {t('groupDetails.remove')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default MemberList;
