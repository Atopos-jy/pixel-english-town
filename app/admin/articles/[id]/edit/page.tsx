import ArticleForm from '@/components/ArticleForm';

export default function EditArticlePage({ params }: { params: { id: string } }) {
  return <ArticleForm mode="edit" articleId={params.id} />;
}
