import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/app/AppShell';
import { HOME } from './components/app/nav';
import { useSession } from './demo/session';
import { Login } from './screens/Login';
import { CheckIn } from './screens/checkin/CheckIn';
import { Dashboard } from './screens/Dashboard';
import { MembersRollup } from './screens/members/MembersRollup';
import { MemberList } from './screens/members/MemberList';
import { MemberDetail } from './screens/members/MemberDetail';
import { Collect } from './screens/members/Collect';
import { Equipment } from './screens/Equipment';
import { Accounts } from './screens/accounts/Accounts';
import { CoachToday } from './screens/coach/CoachToday';
import { CoachClients } from './screens/coach/CoachClients';
import { SessionLog } from './screens/coach/SessionLog';
import { Staff } from './screens/Staff';
import { Branches } from './screens/Branches';
import { AuditLog } from './screens/AuditLog';
import { Roadmap } from './screens/Roadmap';
import { MemberApp } from './screens/mobile/MemberApp';
import { EmptyState } from './components/ui';

/** Sends each role to its own landing screen. Scope decides where you enter. */
function Home() {
  const { role } = useSession();
  return <Navigate to={HOME[role]} replace />;
}

function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="page">
      <EmptyState
        icon="search"
        title="No such screen"
        body={`Nothing lives at ${pathname}. Use ⌘K to jump to a member or a page.`}
      />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* The member's phone app runs outside the staff shell — four tabs, no sidebar. */}
      <Route path="/app/member/*" element={<MemberApp />} />

      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/checkin" element={<CheckIn />} />

        <Route path="/members" element={<MembersRollup />} />
        <Route path="/members/branch/:branchId" element={<MemberList />} />
        <Route path="/members/:memberId" element={<MemberDetail />} />
        <Route path="/collect" element={<Collect />} />

        <Route path="/equipment" element={<Equipment />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/branches" element={<Branches />} />

        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:tab" element={<Accounts />} />

        <Route path="/coach" element={<CoachToday />} />
        <Route path="/coach/clients" element={<CoachClients />} />
        <Route path="/coach/session/:memberId" element={<SessionLog />} />

        <Route path="/audit" element={<AuditLog />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
