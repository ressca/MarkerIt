import { redirect } from 'next/navigation';
import { getSessionUser } from './lib/session';
import { DashboardView } from './components/dashboard-view';

export default async function DashboardPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  return <DashboardView initialUser={user} />;
}
