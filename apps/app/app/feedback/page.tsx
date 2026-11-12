import { redirect } from 'next/navigation';
import { getSessionUser } from '../lib/session';
import { FeedbackPage } from './feedback-page';

export default async function WorkspaceFeedbackPageRoute() {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  return <FeedbackPage initialUser={user} />;
}
