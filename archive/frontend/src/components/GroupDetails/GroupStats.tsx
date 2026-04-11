import React from "react";
import { useTranslation } from "react-i18next";
import { Event } from "../../../../shared/types";

interface GroupStatsProps {
  memberCount: number;
  events: Event[];
}

const GroupStats: React.FC<GroupStatsProps> = React.memo(({ memberCount, events }) => {
  const { t } = useTranslation();
  
  const now = new Date();
  const safeEvents = Array.isArray(events) ? events : [];
  const upcomingEvents = safeEvents.filter(e => {
    const eventDate = e.date || e.startTime;
    return eventDate && new Date(eventDate) >= now;
  }).length;
  const pastEvents = safeEvents.filter(e => {
    const eventDate = e.date || e.startTime;
    return eventDate && new Date(eventDate) < now;
  }).length;

  return (
    <section className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg p-3 sm:p-6 shadow-lg mb-3 sm:mb-6">
      <h2 className="text-base sm:text-xl font-semibold mb-2 sm:mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        {t('groupDetails.groupStats')}
      </h2>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-slate-900/50 rounded-lg p-2 sm:p-4 border border-slate-600">
          <div className="text-xl sm:text-3xl font-bold text-blue-400">{memberCount}</div>
          <div className="text-xs sm:text-sm text-slate-400 mt-0.5 sm:mt-1 leading-tight">{t('groupDetails.totalMembers')}</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2 sm:p-4 border border-slate-600">
          <div className="text-xl sm:text-3xl font-bold text-purple-400">{upcomingEvents}</div>
          <div className="text-xs sm:text-sm text-slate-400 mt-0.5 sm:mt-1 leading-tight">{t('groupDetails.upcomingEvents')}</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2 sm:p-4 border border-slate-600">
          <div className="text-xl sm:text-3xl font-bold text-orange-400">{pastEvents}</div>
          <div className="text-xs sm:text-sm text-slate-400 mt-0.5 sm:mt-1 leading-tight">{t('groupDetails.pastEvents')}</div>
        </div>
      </div>
    </section>
  );
});

GroupStats.displayName = 'GroupStats';

export default GroupStats;
