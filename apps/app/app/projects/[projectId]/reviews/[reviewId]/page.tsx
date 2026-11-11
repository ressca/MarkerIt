import { redirect } from 'next/navigation';
import { getSessionUser } from '../../../../lib/session';
import { ReviewThreadPage } from './review-thread-page';

export default async function ReviewThreadPageRoute({
  params,
}: {
  params: Promise<{ projectId: string; reviewId: string }>;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  const { projectId, reviewId } = await params;

  return (
    <ReviewThreadPage
      initialUser={user}
      projectId={projectId}
      reviewId={reviewId}
    />
  );
}
