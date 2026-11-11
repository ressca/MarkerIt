import { redirect } from 'next/navigation';
import { getSessionUser } from '../../lib/session';
import { ProjectPage } from './project-page';

export default async function ProjectPageRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  const { projectId } = await params;

  return <ProjectPage initialUser={user} projectId={projectId} />;
}
