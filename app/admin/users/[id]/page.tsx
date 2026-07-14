import UserDetail from '@/components/UserDetail';

export default function UserDetailPage({ params }: { params: { id: string } }) {
  return <UserDetail userId={params.id} />;
}
