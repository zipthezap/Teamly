import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { eventsAPI } from '../../services/api';

interface Statistics {
  totalEventsJoined: number;
  totalEventsCreated: number;
  upcomingEvents: number;
  pastEvents: number;
  confirmedEvents: number;
  eventTypeBreakdown: Record<string, number>;
  upcomingEventsDetails: Array<{
    id: string;
    title: string;
    eventType: string;
    startTime: string;
    group: { name: string };
    status: string;
  }>;
  createdEventsStats: {
    total: number;
    totalParticipants: number;
    avgParticipantsPerEvent: number;
  };
}

const UserStatistics: React.FC = () => {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await eventsAPI.getStatistics();
      setStatistics(response.data);
    } catch (err: unknown) {
      console.error('Error fetching statistics:', err);
      setError(t('common.error') + ': ' + t('dashboard.loadingDashboard'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-gray-500">{t('common.loading')}</span>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>;
  }

  if (!statistics) {
    return null;
  }

  const StatCard = ({ title, value, icon, color }: { title: string; value: number | string; icon: React.ReactNode; color: string }) => (
    <div className={`bg-[#1a2233] rounded-xl shadow-md p-5 flex flex-col h-full justify-between`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs text-[#a1a6b4] mb-1">{title}</div>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
        </div>
        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#232946]">{icon}</div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="text-lg font-bold mb-4">{t('dashboard.yourActivity', 'Your Activity')}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.eventsJoined', 'Events Joined')}
          value={statistics.totalEventsJoined}
          icon={
            <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
          }
          color="text-blue-500"
        />
        <StatCard
          title={t('dashboard.upcomingEvents', 'Upcoming Events')}
          value={statistics.upcomingEvents}
          icon={
            <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          }
          color="text-green-500"
        />
        <StatCard
          title={t('dashboard.pastEvents', 'Past Events')}
          value={statistics.pastEvents}
          icon={
            <svg className="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          }
          color="text-yellow-500"
        />
        <StatCard
          title={t('dashboard.confirmed', 'Confirmed')}
          value={statistics.confirmedEvents}
          icon={
            <svg className="w-7 h-7 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2l4-4" /></svg>
          }
          color="text-pink-500"
        />
      </div>
    </div>
  );
};

export default UserStatistics;
