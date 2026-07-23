'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Difficulty } from '@/types';
import { Editor } from '@bytemd/react';
import gfm from '@bytemd/plugin-gfm';
import OssUploader from './OssUploader';

interface ContentBlock {
  en: string;
  zh: string;
}

// 难度中英文映射
const DIFFICULTY_MAP = {
  [Difficulty.Beginner]: '初级',
  [Difficulty.Intermediate]: '中级',
  [Difficulty.Advanced]: '高级',
};

interface ArticleFormData {
  id?: string;
  date: string;
  titleEn: string;
  titleZh: string;
  summaryEn: string;
  summaryZh: string;
  content: ContentBlock[];
  difficulty: string;
  durationSeconds: number;
  audioUrl?: string;
}

interface ArticleFormProps {
  mode: 'create' | 'edit';
  articleId?: string;
}

export default function ArticleForm({ mode, articleId }: ArticleFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeResult, setTranscribeResult] = useState<string | null>(null);
  const [formData, setFormData] = useState<ArticleFormData>({
    date: new Date().toISOString().split('T')[0],
    titleEn: '',
    titleZh: '',
    summaryEn: '',
    summaryZh: '',
    content: [{ en: '', zh: '' }],
    difficulty: Difficulty.Beginner,
    durationSeconds: 0,
    audioUrl: '',
  });

  // ByteMD插件配置 - 只使用GFM插件
  const plugins = [gfm()];

  // 移除Markdown语法符号，只保留纯文本用于计算单词数
  const stripMarkdown = (text: string): string => {
    return (
      text
        // 移除标题标记 (# ## ###)
        .replace(/^#{1,6}\s+/gm, '')
        // 移除粗体 (**text** 或 __text__)
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        // 移除斜体 (*text* 或 _text_)
        .replace(/(\*|_)(.*?)\1/g, '$2')
        // 移除删除线 (~~text~~)
        .replace(/~~(.*?)~~/g, '$1')
        // 移除链接 [text](url)
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        // 移除图片 ![alt](url)
        .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1')
        // 移除行内代码 `code`
        .replace(/`([^`]+)`/g, '$1')
        // 移除代码块标记
        .replace(/```[\s\S]*?```/g, '')
        // 移除引用标记 (>)
        .replace(/^>\s+/gm, '')
        // 移除列表标记 (- * +)
        .replace(/^[\*\-\+]\s+/gm, '')
        // 移除有序列表标记 (1. 2. 3.)
        .replace(/^\d+\.\s+/gm, '')
        // 移除HTML标签
        .replace(/<[^>]+>/g, '')
        // 移除多余空格
        .replace(/\s+/g, ' ')
        .trim()
    );
  };

  // 计算阅读时长（基于英文内容，慢速阅读：50词/分钟）
  const calculateDuration = (titleEn: string, summaryEn: string, content: ContentBlock[]) => {
    // 统计所有英文文本的单词数
    const allEnglishText = [titleEn, summaryEn, ...content.map((block) => block.en)].join(' ');

    // 移除Markdown符号后再计算单词数
    const plainText = stripMarkdown(allEnglishText);
    const wordCount = plainText
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;

    // 按照50词/分钟计算，转换为秒
    const durationMinutes = wordCount / 50;
    const durationSeconds = Math.ceil(durationMinutes * 60);

    return durationSeconds;
  };

  // 当内容变化时自动更新阅读时长（仅在没有上传音频时）
  useEffect(() => {
    // 如果已经有音频URL，说明用户上传了音频，不自动计算时长
    if (formData.audioUrl) {
      return;
    }

    const duration = calculateDuration(formData.titleEn, formData.summaryEn, formData.content);
    if (duration !== formData.durationSeconds) {
      setFormData((prev) => ({ ...prev, durationSeconds: duration }));
    }
  }, [formData.titleEn, formData.summaryEn, formData.content, formData.audioUrl]); // eslint-disable-line react-hooks/exhaustive-deps -- 保持既有的表单联动时机，避免改动历史组件行为。

  useEffect(() => {
    if (mode === 'edit' && articleId) {
      fetchArticle();
    }
  }, [mode, articleId]); // eslint-disable-line react-hooks/exhaustive-deps -- 保持既有的编辑态加载时机，避免改动历史组件行为。

  const fetchArticle = async () => {
    try {
      const response = await fetch(`/api/v1/admin/articles/${articleId}`);

      if (!response.ok) {
        throw new Error('获取文章失败');
      }

      const result = (await response.json()) as { data: ArticleFormData | null };
      const data = result.data;
      if (!data) throw new Error('获取文章失败');
      setFormData({
        id: data.id,
        date: data.date,
        titleEn: data.titleEn,
        titleZh: data.titleZh,
        summaryEn: data.summaryEn,
        summaryZh: data.summaryZh,
        content: data.content,
        difficulty: data.difficulty,
        durationSeconds: data.durationSeconds,
        audioUrl: data.audioUrl || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 客户端验证
      if (!formData.titleEn || !formData.titleZh || !formData.summaryEn || !formData.summaryZh) {
        throw new Error('请填写所有必需字段');
      }

      if (formData.content.some((block) => !block.en || !block.zh)) {
        throw new Error('所有内容块必须包含英文和中文');
      }

      // 重新计算阅读时长以确保是最新的
      const calculatedDuration = calculateDuration(formData.titleEn, formData.summaryEn, formData.content);
      if (calculatedDuration <= 0) {
        throw new Error('请添加英文内容以计算阅读时长');
      }

      const url = mode === 'create' ? '/api/v1/admin/articles' : `/api/v1/admin/articles/${articleId}`;

      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || '操作失败');
      }

      router.push('/admin/articles');
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  const handleTranscribe = async () => {
    if (!articleId) return;
    setTranscribing(true);
    setTranscribeResult(null);
    try {
      const res = await fetch(`/api/v1/admin/articles/${articleId}/transcribe`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '生成失败');
      setTranscribeResult(`成功生成 ${data.data?.wordCount || 0} 个单词的时间戳`);
    } catch (err) {
      setTranscribeResult(err instanceof Error ? `失败: ${err.message}` : '生成失败');
    } finally {
      setTranscribing(false);
    }
  };

  const addContentBlock = () => {
    setFormData({
      ...formData,
      content: [...formData.content, { en: '', zh: '' }],
    });
  };

  const removeContentBlock = (index: number) => {
    if (formData.content.length === 1) {
      alert('至少需要一个内容块');
      return;
    }
    const newContent = formData.content.filter((_, i) => i !== index);
    setFormData({ ...formData, content: newContent });
  };

  const updateContentBlock = (index: number, field: 'en' | 'zh', value: string) => {
    const newContent = [...formData.content];
    newContent[index][field] = value;
    setFormData({ ...formData, content: newContent });
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">{mode === 'create' ? '创建新文章' : '编辑文章'}</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">日期 *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">难度 *</label>
            <select
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value={Difficulty.Beginner}>{DIFFICULTY_MAP[Difficulty.Beginner]} (Beginner)</option>
              <option value={Difficulty.Intermediate}>{DIFFICULTY_MAP[Difficulty.Intermediate]} (Intermediate)</option>
              <option value={Difficulty.Advanced}>{DIFFICULTY_MAP[Difficulty.Advanced]} (Advanced)</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">音频文件（可选）</label>
          <OssUploader
            value={formData.audioUrl || ''}
            onChange={(url) => setFormData({ ...formData, audioUrl: url })}
            onDurationChange={(duration) => {
              // eslint-disable-next-line no-console -- 保留既有调试输出，避免改变历史音频上传行为。
              console.log('接收到音频时长:', duration, '秒');
              setFormData({ ...formData, durationSeconds: duration });
            }}
          />
          {formData.durationSeconds > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              音频时长: {Math.floor(formData.durationSeconds / 60)}分{formData.durationSeconds % 60}秒
            </p>
          )}

          {/* 仅编辑模式且有音频时显示生成时间戳按钮 */}
          {mode === 'edit' && formData.audioUrl && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleTranscribe}
                disabled={transcribing}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {transcribing ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Whisper 识别中...
                  </>
                ) : (
                  '✨ 生成逐词时间戳'
                )}
              </button>
              {transcribeResult && (
                <span className={`text-sm ${transcribeResult.startsWith('失败') ? 'text-red-500' : 'text-green-600'}`}>
                  {transcribeResult}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">中文标题 *</label>
            <input
              type="text"
              value={formData.titleZh}
              onChange={(e) => setFormData({ ...formData, titleZh: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              placeholder="输入中文标题"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">英文标题 *</label>
            <input
              type="text"
              value={formData.titleEn}
              onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              placeholder="Enter English title"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">中文摘要 *</label>
            <textarea
              value={formData.summaryZh}
              onChange={(e) => setFormData({ ...formData, summaryZh: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              required
              placeholder="输入中文摘要"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">英文摘要 *</label>
            <textarea
              value={formData.summaryEn}
              onChange={(e) => setFormData({ ...formData, summaryEn: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              required
              placeholder="Enter English summary"
            />
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <label className="block text-sm font-medium text-gray-700">内容块 *</label>
            <button
              type="button"
              onClick={addContentBlock}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              添加内容块
            </button>
          </div>

          {formData.content.map((block, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-700">内容块 {index + 1}</span>
                {formData.content.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeContentBlock(index)}
                    className="text-red-600 text-sm hover:text-red-800"
                  >
                    删除
                  </button>
                )}
              </div>

              <div className="mb-3">
                <label className="block text-xs text-gray-600 mb-2">中文内容</label>
                <div className="border border-gray-300 rounded-lg overflow-hidden bytemd-editor-custom">
                  <Editor
                    value={block.zh}
                    plugins={plugins}
                    onChange={(value) => updateContentBlock(index, 'zh', value)}
                    placeholder="输入中文内容（支持 Markdown）"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-2">英文内容</label>
                <div className="border border-gray-300 rounded-lg overflow-hidden bytemd-editor-custom">
                  <Editor
                    value={block.en}
                    plugins={plugins}
                    onChange={(value) => updateContentBlock(index, 'en', value)}
                    placeholder="Enter English content (Markdown supported)"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            disabled={loading}
          >
            取消
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? '保存中...' : mode === 'create' ? '创建' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
