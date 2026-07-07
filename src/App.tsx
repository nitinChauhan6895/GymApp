import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import BottomNav from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberProfile from './pages/MemberProfile';
import MemberForm from './pages/MemberForm';
import Renewals from './pages/Renewals';
import Campaigns from './pages/Campaigns';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Packages from './pages/Packages';
import ImportMembers from './pages/ImportMembers';
import Join from './pages/Join';
import Notifications from './pages/Notifications';
import { db } from './db';
import { buildMemberViews } from './data';
import { todayISO } from './utils';

/** Fires the once-a-day browser notification summary if enabled. */
function useMorningSummary() {
  const settings = useLiveQuery(() => db.settings.get(1));
  const data = useLiveQuery(async () => {
    const [members, memberships, payments] = await Promise.all([
      db.members.toArray(),
      db.memberships.toArray(),
      db.payments.toArray(),
    ]);
    return buildMemberViews(members, memberships, payments);
  });

  useEffect(() => {
    if (!settings?.notificationsEnabled || !data) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const today = todayISO();
    if (settings.lastMorningSummary === today) return;
    const expToday = data.filter((v) => v.daysLeft === 0).length;
    const exp7 = data.filter((v) => v.daysLeft !== null && v.daysLeft > 0 && v.daysLeft <= 7).length;
    const expired = data.filter((v) => v.status === 'expired').length;
    new Notification('GymApp — Morning Summary', {
      body: `${expToday} expiring today · ${exp7} expiring in 7 days · ${expired} expired`,
      icon: './icon.svg',
    });
    db.settings.update(1, { lastMorningSummary: today });
  }, [settings, data]);
}

export default function App() {
  useMorningSummary();
  // kiosk mode: no bottom nav, so a self-registering member can't browse data
  const isKiosk = useLocation().pathname === '/join';
  return (
    <div className="app">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/join" element={<Join />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/new" element={<MemberForm />} />
          <Route path="/members/:id" element={<MemberProfile />} />
          <Route path="/members/:id/edit" element={<MemberForm />} />
          <Route path="/renewals" element={<Renewals />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/packages" element={<Packages />} />
          <Route path="/settings/import" element={<ImportMembers />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isKiosk && <BottomNav />}
    </div>
  );
}
