import React from "react";
import { useTranslation } from "react-i18next";

interface AdminTransferDialogProps {
  open: boolean;
  members: Array<{ email: string; name?: string; role?: string }>;
  selectedNewAdmin: string;
  onSelect: (email: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
}

const AdminTransferDialog: React.FC<AdminTransferDialogProps> = ({
  open,
  members,
  selectedNewAdmin,
  onSelect,
  onConfirm,
  onCancel,
  confirmDisabled,
}) => {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl w-[420px] text-center border border-slate-700">
        <div className="mb-6 text-2xl font-extrabold text-white tracking-wide">{t('groupDetails.transferAdminTitle')}</div>
        <div className="mb-8 text-base text-slate-400">{t('groupDetails.transferAdminDesc')}</div>
        <div className="mb-6">
          <select
            className="w-full p-3 rounded-lg bg-slate-800 text-white text-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedNewAdmin}
            onChange={e => onSelect(e.target.value)}
          >
            <option value="" disabled>{t('groupDetails.selectMember')}</option>
            {members.filter(m => m.role !== "admin").map(m => (
              <option key={m.email} value={m.email}>{m.name || m.email}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-6 justify-center mt-2">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full text-lg font-semibold shadow transition-all duration-150" onClick={onConfirm} disabled={confirmDisabled || !selectedNewAdmin}>{t('groupDetails.transferAndLeave')}</button>
          <button className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-3 rounded-full text-lg font-semibold shadow transition-all duration-150" onClick={onCancel}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
};

export default AdminTransferDialog;
