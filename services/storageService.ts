import { UserProgress, Article } from '../types';

// API Service to replace LocalStorage
// Note: In a real app you might use SWR or React Query

export const getArticles = async (): Promise<Article[]> => {
  try {
    const res = await fetch('/api/articles');
    if (!res.ok) throw new Error('Failed to fetch articles');
    return res.json();
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const getProgress = async (): Promise<UserProgress | null> => {
  try {
    const res = await fetch('/api/progress');
    if (!res.ok) throw new Error('Failed to fetch progress');
    return res.json();
  } catch (e) {
    console.error(e);
    return null;
  }
};

type CompleteArticleResponse = {
  success: boolean;
  message: string;
  data: {
    progress: UserProgress;
    newBadges: string[];
  } | null;
};

export const markArticleComplete = async (
  article: Article,
): Promise<{ progress: UserProgress | null; newBadges: string[] }> => {
  try {
    const res = await fetch('/api/progress/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: article.id,
        difficulty: article.difficulty,
      }),
    });

    if (!res.ok) throw new Error('Failed to update');
    const result = (await res.json()) as CompleteArticleResponse;
    return {
      progress: result.data?.progress ?? null,
      newBadges: result.data?.newBadges ?? [],
    };
  } catch (e) {
    console.error(e);
    return { progress: null, newBadges: [] };
  }
};

// Deprecated: No-op for saveProgress as we save to server immediately
export const saveProgress = (progress: UserProgress) => {
  // console.log('Progress saved to server via API');
};
