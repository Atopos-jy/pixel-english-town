import React, { useState } from 'react';
import { Article, Difficulty, WordTimestamp } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { DIFFICULTY_LABELS } from '../constants';
import { Bookmark, CheckCircle2, Calendar, Trophy, Mic, Square, BookOpen, BookOpenCheck, Settings } from 'lucide-react';
import { Viewer } from '@bytemd/react';
import gfm from '@bytemd/plugin-gfm';
import { alignWords, WordStatus } from '../lib/textDiff';

interface ArticleReaderProps {
  article: Article;
  isCompleted: boolean;
  onComplete: () => void;
  onOpenQuiz?: () => void;
  onOpenQuestionFolder?: () => void;
  onOpenAiSettings?: () => void;
  onOpenShelf?: () => void;
}

type ViewMode = 'en' | 'zh' | 'bilingual';

export const ArticleReader: React.FC<ArticleReaderProps> = ({
  article,
  isCompleted,
  onComplete,
  onOpenQuiz = () => {},
  onOpenQuestionFolder = () => {},
  onOpenAiSettings = () => {},
  onOpenShelf = () => {},
}) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('en');
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [actualAudioDuration, setActualAudioDuration] = useState(0);
  const [activeBlockPara, setActiveBlockPara] = useState<string | null>(null);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  // 记录历史最远读到的单词下标，只增不减，音频暂停/结束后已读颜色不丢失
  const maxReadWordIndexRef = React.useRef<number>(-1);
  // 跟读练习状态
  const [evalMode, setEvalMode] = useState(false);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  // globalIdx → 评测结果，多次跟读累积（同一句重试时会覆盖）
  const [evalResultsByGlobalIdx, setEvalResultsByGlobalIdx] = useState<Map<number, WordStatus>>(new Map());
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const recordingStreamRef = React.useRef<MediaStream | null>(null);
  // 录音回放：存储最近一次录音的 blob URL 和 Deepgram 逐词时间戳
  const [recordingPlaybackUrl, setRecordingPlaybackUrl] = useState<string | null>(null);
  const [recordingTimestamps, setRecordingTimestamps] = useState<WordTimestamp[] | null>(null);
  const recordingAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // 用于存储段落元素的引用
  const paragraphRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  // 是否启用单词级高亮模式
  const wordTimestamps = article.wordTimestamps as WordTimestamp[] | null | undefined;
  const hasWordTimestamps = !!wordTimestamps && wordTimestamps.length > 0;

  // ByteMD插件配置 - 只使用GFM插件
  const plugins = [gfm()];

  // 将Markdown内容按段落分割（智能处理列表）
  const splitIntoParagraphs = (markdown: string): string[] => {
    const lines = markdown.split('\n').map((l) => l.trim());
    const paragraphs: string[] = [];
    let currentParagraph: string[] = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 空行处理
      if (line === '') {
        if (currentParagraph.length > 0 && !inList) {
          paragraphs.push(currentParagraph.join('\n'));
          currentParagraph = [];
        }
        continue;
      }

      // 检测列表项（- * + 或数字开头）
      const isListItem = /^[-*+]\s/.test(line) || /^\d+\.\s/.test(line);

      if (isListItem) {
        // 如果之前不在列表中，先保存之前的段落
        if (!inList && currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join('\n'));
          currentParagraph = [];
        }
        inList = true;
        currentParagraph.push(line);
      } else {
        // 如果之前在列表中，现在遇到非列表项，保存列表
        if (inList && currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join('\n'));
          currentParagraph = [];
          inList = false;
        }
        currentParagraph.push(line);
      }
    }

    // 保存最后的段落
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join('\n'));
    }

    return paragraphs.filter((p) => p.length > 0);
  };

  // 将段落进一步切分为句子（列表块/标题保持整体）
  const splitIntoSentences = (markdown: string): string[] => {
    const paragraphs = splitIntoParagraphs(markdown);
    const result: string[] = [];
    for (const para of paragraphs) {
      const trimmed = para.trim();
      const isSpecialBlock = /^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed) || /^#{1,6}\s/.test(trimmed);
      if (isSpecialBlock) {
        result.push(para);
        continue;
      }
      const parts = trimmed.split(/(?<=[.!?])\s+(?=[A-Z"'])/);
      parts.forEach((s) => {
        const t = s.trim();
        if (t.length > 0) result.push(t);
      });
    }
    return result.filter((s) => s.length > 0);
  };

  // 移除Markdown符号，只保留纯文本
  const stripMarkdown = (text: string): string => {
    return text
      .replace(/^#{1,6}\s+/gm, '') // 标题
      .replace(/(\*\*|__)(.*?)\1/g, '$2') // 粗体
      .replace(/(\*|_)(.*?)\1/g, '$2') // 斜体
      .replace(/~~(.*?)~~/g, '$1') // 删除线
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // 链接
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1') // 图片
      .replace(/`([^`]+)`/g, '$1') // 行内代码
      .replace(/```[\s\S]*?```/g, '') // 代码块
      .replace(/^>\s+/gm, '') // 引用
      .replace(/^[\*\-\+]\s+/gm, '') // 列表
      .replace(/^\d+\.\s+/gm, '') // 有序列表
      .replace(/<[^>]+>/g, '') // HTML标签
      .trim();
  };

  // 将全局 wordTimestamps 与 content blocks 对应，附加 blockIdx/globalIdx/sentIdx
  const enrichedWordData = React.useMemo(() => {
    if (!hasWordTimestamps) return null;
    const result: Array<WordTimestamp & { blockIdx: number; localIdx: number; globalIdx: number; sentIdx: number }> =
      [];

    // Whisper 有时会将多个词合并成一个 token（如 "need $10"），
    // 需要先拆开，按比例分配时间，以避免文本词数与 token 数不匹配导致后续错位
    const flatTokens: WordTimestamp[] = [];
    for (const wt of wordTimestamps!) {
      const subWords = wt.word.split(/\s+/).filter((s) => s.length > 0);
      if (subWords.length > 1) {
        const duration = (wt.end - wt.start) / subWords.length;
        subWords.forEach((sw, i) => {
          flatTokens.push({ word: sw, start: wt.start + i * duration, end: wt.start + (i + 1) * duration });
        });
      } else {
        flatTokens.push(wt);
      }
    }

    // 构建 globalIdx → sentIdx 的映射（按块内句子顺序计算）
    const sentIdxMap: number[] = [];
    article.content.forEach((block) => {
      const sentences = splitIntoSentences(block.en);
      sentences.forEach((sent, sIdx) => {
        const wordCount = stripMarkdown(sent)
          .split(/\s+/)
          .filter((w) => w.length > 0).length;
        for (let k = 0; k < wordCount; k++) sentIdxMap.push(sIdx);
      });
    });

    let globalIdx = 0;
    article.content.forEach((block, blockIdx) => {
      const plainText = stripMarkdown(block.en);
      const words = plainText.split(/\s+/).filter((w) => w.length > 0);
      words.forEach((_, localIdx) => {
        if (globalIdx < flatTokens.length) {
          result.push({
            ...flatTokens[globalIdx],
            blockIdx,
            localIdx,
            globalIdx,
            sentIdx: sentIdxMap[globalIdx] ?? 0,
          });
          globalIdx++;
        }
      });
    });
    return result;
  }, [article.content, wordTimestamps, hasWordTimestamps]); // eslint-disable-line react-hooks/exhaustive-deps

  // 音频时长：优先使用实际加载的音频时长，否则使用文章数据中的时长
  const audioDuration = actualAudioDuration || article.durationSeconds || 0;

  // 全局计算所有句子的时间范围（降级模式，无 wordTimestamps 时使用）
  const allParagraphsData = React.useMemo(() => {
    const result: Array<{
      blockIdx: number;
      sentIdx: number;
      text: string;
      plainText: string;
      wordCount: number;
      startTime: number;
      endTime: number;
    }> = [];

    const tempSentences: Array<{
      blockIdx: number;
      sentIdx: number;
      text: string;
      plainText: string;
      wordCount: number;
    }> = [];

    article.content.forEach((block, blockIdx) => {
      const sentences = splitIntoSentences(block.en);
      sentences.forEach((sent, sentIdx) => {
        const plainText = stripMarkdown(sent);
        const words = plainText.split(/\s+/).filter((w) => w.length > 0);
        const wordCount = words.length;
        tempSentences.push({ blockIdx, sentIdx, text: sent, plainText, wordCount });
      });
    });

    const totalWords = tempSentences.reduce((sum, s) => sum + s.wordCount, 0);

    if (totalWords === 0 || audioDuration === 0) {
      return result;
    }

    let accumulatedTime = 0;
    tempSentences.forEach((sent, index) => {
      const proportion = sent.wordCount / totalWords;
      const duration = audioDuration * proportion;
      const startTime = accumulatedTime;
      const endTime = index === tempSentences.length - 1 ? audioDuration : accumulatedTime + duration;

      result.push({
        ...sent,
        startTime,
        endTime,
      });

      accumulatedTime = endTime;
    });

    return result;
    // splitIntoSentences 是无状态纯函数；重算只由文章内容和音频时长触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.content, audioDuration]);

  // 根据当前播放时间更新高亮
  const updateActiveBlock = (time: number) => {
    setCurrentAudioTime(time);

    if (hasWordTimestamps && enrichedWordData) {
      // 单词级模式：精确匹配（time 在 start~end 内）
      let activeIdx = enrichedWordData.findIndex((w) => time >= w.start && time < w.end);

      // 词间空隙时不做回溯，保持空状态（无加粗），已读颜色由 maxReadWordIndexRef 保留
      // 仅对最后一词做特殊处理：音频播完后让它也变色
      if (activeIdx === -1 && time > 0) {
        const last = enrichedWordData[enrichedWordData.length - 1];
        if (last && time >= last.end) {
          activeIdx = enrichedWordData.length - 1;
        }
      }
      const newIdx = activeIdx >= 0 ? activeIdx : null;
      setActiveWordIndex(newIdx);
      // 无论前进还是后退（拖进度条），都同步更新到当前位置
      // 暂停/词间空隙时（newIdx=null）保持上次位置不变
      if (newIdx !== null) {
        maxReadWordIndexRef.current = newIdx;
      }

      // 跟读模式下不自动滚动，让用户自由定位
      if (!evalMode && activeIdx >= 0) {
        const blockKey = `block-${enrichedWordData[activeIdx].blockIdx}`;
        if (blockKey !== activeBlockPara) {
          setActiveBlockPara(blockKey);
          const element = paragraphRefs.current.get(blockKey);
          if (element) {
            // nearest：元素已在视口内则不滚动，避免超高 div 被强制居中
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }
        }
      }
    } else {
      // 句子级降级模式
      if (!evalMode) {
        const activeSent = allParagraphsData.find((s) => time >= s.startTime && time < s.endTime);
        if (activeSent) {
          const key = `${activeSent.blockIdx}-${activeSent.sentIdx}`;
          if (key !== activeBlockPara) {
            setActiveBlockPara(key);
            const element = paragraphRefs.current.get(key);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
          }
        } else if (activeBlockPara !== null) {
          setActiveBlockPara(null);
        }
      }
    }
  };

  // 判断某个句子是否应该高亮（降级模式用）
  const shouldHighlight = (blockIdx: number, sentIdx: number): boolean => {
    if (hasWordTimestamps || !article.audioUrl || audioDuration === 0 || currentAudioTime === 0) {
      return false;
    }
    const sentence = allParagraphsData.find((s) => s.blockIdx === blockIdx && s.sentIdx === sentIdx);
    if (!sentence) return false;
    return currentAudioTime >= sentence.startTime && currentAudioTime < sentence.endTime;
  };

  // ───── 跟读录音逻辑 ─────

  const startRecording = async (sentKey: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => handleRecordingStop(sentKey);
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingKey(sentKey);
    } catch {
      alert('无法访问麦克风，请检查浏览器权限设置。');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    setRecordingKey(null);
  };

  const handleRecordingStop = async (sentKey: string) => {
    setProcessingKey(sentKey);
    try {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const form = new FormData();
      form.append('audio', blob, 'recording.webm');

      const res = await fetch('/api/v1/speaking-eval', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json();
        alert(`转录失败：${data.message || '未知错误'}`);
        return;
      }
      const { data } = (await res.json()) as {
        data: { transcript: string; words?: Array<{ word: string; start: number; end: number }> };
      };
      const { transcript, words: evalWords } = data;

      // 释放旧的录音回放 URL
      if (recordingPlaybackUrl) URL.revokeObjectURL(recordingPlaybackUrl);
      const playbackUrl = URL.createObjectURL(blob);
      setRecordingPlaybackUrl(playbackUrl);
      setRecordingTimestamps(evalWords ?? null);

      // 解析 sentKey → blockIdx / sentIdx
      const [blockIdxStr, sentIdxStr] = sentKey.split('-');
      const bIdx = parseInt(blockIdxStr);
      const sIdx = parseInt(sentIdxStr);

      // 取该句的原文纯文本
      const sentences = splitIntoSentences(article.content[bIdx]?.en ?? '');
      const originalText = stripMarkdown(sentences[sIdx] ?? '');

      // 用编辑距离对齐
      const aligned = alignWords(originalText, transcript);

      // 找到该句对应的所有 globalIdx（按顺序）
      const sentWords = (enrichedWordData ?? []).filter((w) => w.blockIdx === bIdx && w.sentIdx === sIdx);

      // 存储 globalIdx 映射供回放时逐词高亮
      recordingWordGlobalIdxRef.current = sentWords.map((w) => w.globalIdx);

      // 更新评测结果（Map 不可变更新）
      setEvalResultsByGlobalIdx((prev) => {
        const next = new Map(prev);
        aligned.forEach((r, i) => {
          const wd = sentWords[i];
          if (wd) next.set(wd.globalIdx, r.status);
        });
        return next;
      });
    } catch (e: unknown) {
      alert(`评测出错：${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setProcessingKey(null);
    }
  };

  // ───── 录音回放（逐词时间轴同步高亮） ─────

  // recordingTimestamps[] 对齐的单词 globalIdx 映射（在 handleRecordingStop 中设置）
  const recordingWordGlobalIdxRef = React.useRef<number[]>([]);
  const [recordingPlaybackGlobalIdx, setRecordingPlaybackGlobalIdx] = useState<number | null>(null);

  const handlePlayRecording = () => {
    if (!recordingPlaybackUrl || !recordingTimestamps || recordingTimestamps.length === 0) return;
    const audio = recordingAudioRef.current;
    if (!audio) return;

    setRecordingPlaybackGlobalIdx(null);
    audio.currentTime = 0;
    audio.play().catch(() => undefined);
  };

  const handleRecordingTimeUpdate = () => {
    const audio = recordingAudioRef.current;
    if (!audio || !recordingTimestamps || recordingTimestamps.length === 0) return;
    const t = audio.currentTime;
    const idx = recordingTimestamps.findIndex((w) => t >= w.start && t < w.end);
    if (idx >= 0 && idx < recordingWordGlobalIdxRef.current.length) {
      setRecordingPlaybackGlobalIdx(recordingWordGlobalIdxRef.current[idx]);
    } else {
      setRecordingPlaybackGlobalIdx(null);
    }
  };

  // ───── 完成文章 ─────

  const handleComplete = () => {
    if (!isCompleted) {
      setShowConfetti(true);
      onComplete();
      setTimeout(() => setShowConfetti(false), 3000);
    }
  };

  // Difficulty badge color map
  const difficultyColors = {
    [Difficulty.Beginner]: 'border-emerald-700 bg-[#e2f3d0] text-emerald-900',
    [Difficulty.Intermediate]: 'border-amber-600 bg-[#fff0ad] text-amber-950',
    [Difficulty.Advanced]: 'border-[#b94d3c] bg-[#ffe1d6] text-[#8b2c21]',
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 animate-fade-in">
      <div className="mb-5 flex items-center justify-between gap-3 border-b-2 border-slate-800 pb-4">
        <p className="text-xs font-black tracking-[0.15em] text-emerald-700">阅读小屋</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpenShelf}
            className="inline-flex items-center gap-1.5 border-2 border-slate-700 bg-[#fff9e8] px-3 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-700 hover:bg-[#e2f3d0] hover:text-emerald-900 xl:hidden"
          >
            <BookOpen size={15} />
            书架
          </button>
          <button
            type="button"
            onClick={onOpenAiSettings}
            className="inline-flex items-center gap-1.5 border-2 border-slate-700 bg-[#fff9e8] px-3 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-700 hover:bg-[#e2f3d0] hover:text-emerald-900"
          >
            <Settings size={15} />
            AI 设置
          </button>
          <button
            type="button"
            onClick={onOpenQuestionFolder}
            className="inline-flex items-center gap-1.5 border-2 border-slate-700 bg-[#fff9e8] px-3 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-700 hover:bg-[#e2f3d0] hover:text-emerald-900"
          >
            <Bookmark size={15} />
            收藏夹
          </button>
          <button
            type="button"
            onClick={onOpenQuiz}
            className="inline-flex items-center gap-1.5 border-2 border-slate-800 bg-amber-300 px-3 py-2 text-xs font-black text-slate-900 shadow-[2px_2px_0_#7c2d12] transition hover:bg-amber-400"
          >
            <BookOpenCheck size={15} />
            开始测验
          </button>
        </div>
      </div>
      {/* View Mode Toggle */}
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        {/* 跟读练习开关（仅有词级时间戳时显示） */}
        {hasWordTimestamps && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setEvalMode((v) => !v);
              if (evalMode) setEvalResultsByGlobalIdx(new Map());
            }}
            className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 text-xs font-semibold transition-all ${
              evalMode
                ? 'border-emerald-800 bg-emerald-700 text-white shadow-[2px_2px_0_#14532d]'
                : 'border-slate-700 bg-[#fff9e8] text-slate-700 hover:border-emerald-700 hover:bg-[#e2f3d0] hover:text-emerald-900'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            {evalMode ? '退出跟读' : '跟读练习'}
          </button>
        )}
        <div className="ml-auto inline-flex border-2 border-slate-800 bg-[#e8f0d8] p-1">
          <button
            onClick={() => setViewMode('en')}
            className={`px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'en' ? 'bg-amber-300 text-slate-900 shadow-[1px_1px_0_#7c2d12]' : 'text-slate-600 hover:bg-[#fff9e8] hover:text-slate-900'}`}
          >
            English
          </button>
          <button
            onClick={() => setViewMode('zh')}
            className={`px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'zh' ? 'bg-amber-300 text-slate-900 shadow-[1px_1px_0_#7c2d12]' : 'text-slate-600 hover:bg-[#fff9e8] hover:text-slate-900'}`}
          >
            中文
          </button>
          <button
            onClick={() => setViewMode('bilingual')}
            className={`px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'bilingual' ? 'bg-amber-300 text-slate-900 shadow-[1px_1px_0_#7c2d12]' : 'text-slate-600 hover:bg-[#fff9e8] hover:text-slate-900'}`}
          >
            中英对照
          </button>
        </div>
      </div>{' '}
      {/* end flex justify-between */}
      {/* Article Header */}
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${difficultyColors[article.difficulty]}`}
          >
            {DIFFICULTY_LABELS[article.difficulty]}
          </span>
          <span className="flex items-center text-xs text-slate-500">
            <Calendar className="w-3 h-3 mr-1" />
            {article.date}
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-2 font-serif">
          {(viewMode === 'en' || viewMode === 'bilingual') && <div className="mb-2">{article.title.en}</div>}
          {(viewMode === 'zh' || viewMode === 'bilingual') && (
            <div className={viewMode === 'bilingual' ? 'text-3xl text-slate-700' : ''}>{article.title.zh}</div>
          )}
        </h1>

        <div className="mt-4 border-l-4 border-emerald-600 py-2 pl-4 text-xl italic text-slate-600">
          {(viewMode === 'en' || viewMode === 'bilingual') && <p className="mb-2">{article.summary.en}</p>}
          {(viewMode === 'zh' || viewMode === 'bilingual') && (
            <p className={viewMode === 'bilingual' ? 'text-lg text-slate-500' : ''}>{article.summary.zh}</p>
          )}
        </div>
      </header>
      {/* Sticky Audio Player on Mobile, or Inline on Desktop */}
      <div className="sticky top-2 z-20 mb-8 border-2 border-slate-800 bg-[#fff9e8] p-2 shadow-[3px_3px_0_#d7b958] md:static md:border-none md:bg-transparent md:p-0 md:shadow-none">
        <AudioPlayer
          src={article.audioUrl}
          onTimeUpdate={updateActiveBlock}
          onDurationChange={setActualAudioDuration}
        />
      </div>
      {/* Article Content */}
      <article className="prose prose-slate prose-xl max-w-none font-serif text-slate-800 mb-10 leading-relaxed">
        {article.content.map((block, blockIdx) => {
          const zhParagraphs = splitIntoParagraphs(block.zh);

          // 单词级渲染：该 block 的所有单词渲染成 span，播到哪个词高亮哪个
          const renderWordLevel = () => {
            if (!enrichedWordData) return null;
            const blockWords = enrichedWordData.filter((w) => w.blockIdx === blockIdx);
            const plainText = stripMarkdown(block.en);
            const tokens = plainText.split(/(\s+)/).filter((t) => t !== '');

            // ── 按 sentIdx 分组 tokens ──
            type TokenEntry = { token: string; globalIdx: number; isSpace: boolean };
            type SentGroup = { sentIdx: number; sentKey: string; items: TokenEntry[] };
            const groups: SentGroup[] = [];
            let wc = 0;
            const pending: string[] = [];

            tokens.forEach((token) => {
              if (/^\s+$/.test(token)) {
                pending.push(token);
                return;
              }
              const wd = blockWords[wc++];
              const sIdx = wd?.sentIdx ?? (groups.length > 0 ? groups[groups.length - 1].sentIdx : 0);
              if (groups.length === 0 || groups[groups.length - 1].sentIdx !== sIdx) {
                groups.push({ sentIdx: sIdx, sentKey: `${blockIdx}-${sIdx}`, items: [] });
              }
              // 将积压的空白加到当前句的开头（词间换行）
              pending.forEach((s) => groups[groups.length - 1].items.push({ token: s, globalIdx: -1, isSpace: true }));
              pending.length = 0;
              groups[groups.length - 1].items.push({ token, globalIdx: wd?.globalIdx ?? -1, isSpace: false });
            });
            // 结尾空白归入最后一句
            pending.forEach(
              (s) =>
                groups.length > 0 && groups[groups.length - 1].items.push({ token: s, globalIdx: -1, isSpace: true }),
            );

            return (
              <div
                ref={(el) => {
                  const key = `block-${blockIdx}`;
                  if (el) paragraphRefs.current.set(key, el);
                  else paragraphRefs.current.delete(key);
                }}
                className="leading-relaxed mb-2 text-xl font-serif text-slate-800"
              >
                {(() => {
                  // 用于跟踪上一个 group 是否是标题，从而决定是否跳过下一 group 开头的 <br>
                  let prevWasHeading = false;
                  const allSentences = splitIntoSentences(block.en);
                  return groups.map(({ sentIdx, sentKey, items }) => {
                    const isRecording = recordingKey === sentKey;
                    const isProcessing = processingKey === sentKey;
                    const hasEval = items.some((it) => !it.isSpace && evalResultsByGlobalIdx.has(it.globalIdx));

                    const rawSent = (allSentences[sentIdx] ?? '').trim();
                    const isHeading = /^#{1,6}\s/.test(rawSent);
                    const headingLevel = rawSent.match(/^(#{1,6})/)?.[1].length ?? 0;
                    const skipLeadingBr = prevWasHeading; // 紧跟标题后的 group 跳过开头换行
                    prevWasHeading = isHeading; // 更新给下一次迭代用
                    const showMicButton = evalMode;
                    // 标题样式
                    const headingClass =
                      headingLevel === 1
                        ? 'block font-bold text-3xl mt-4'
                        : headingLevel === 2
                          ? 'block font-bold text-2xl mt-3'
                          : headingLevel >= 3
                            ? 'block font-bold text-xl mt-2'
                            : '';
                    const score = hasEval
                      ? (() => {
                          const wordItems = items.filter((it) => !it.isSpace && it.globalIdx >= 0);
                          const correct = wordItems.filter(
                            (it) => evalResultsByGlobalIdx.get(it.globalIdx) === 'correct',
                          ).length;
                          return `${correct}/${wordItems.length}`;
                        })()
                      : null;

                    let leadingBrSkipped = false; // 每个 group 独立追踪是否已跳过开头换行
                    return (
                      <span key={sentIdx} className={isHeading ? headingClass : 'inline'}>
                        {items.map((item, ii) => {
                          // 换行符保留为 <br>，还原段落/列表的视觉结构
                          if (item.isSpace) {
                            // 紧跟标题后的第一个换行跳过，避免"标题换行 + <br>"双重间距
                            if (skipLeadingBr && !leadingBrSkipped && item.token.includes('\n')) {
                              leadingBrSkipped = true;
                              return null;
                            }
                            leadingBrSkipped = true;
                            return item.token.includes('\n') ? <br key={ii} /> : <span key={ii}> </span>;
                          }
                          leadingBrSkipped = true;
                          const { globalIdx } = item;
                          const isCurrent = activeWordIndex === globalIdx;
                          const hasBeenRead = globalIdx >= 0 && globalIdx <= maxReadWordIndexRef.current;
                          const evalStatus = evalResultsByGlobalIdx.get(globalIdx);
                          const isRecordingActive =
                            recordingPlaybackGlobalIdx !== null && recordingPlaybackGlobalIdx === globalIdx;

                          let color: string;
                          let textDecoration = 'none';
                          if (isRecordingActive) {
                            color = '#2563eb'; // 回放高亮：蓝色
                          } else if (evalStatus === 'correct') color = '#22c55e';
                          else if (evalStatus === 'substituted') color = '#f59e0b';
                          else if (evalStatus === 'deleted') {
                            color = '#ef4444';
                            textDecoration = 'line-through';
                          } else color = hasBeenRead ? '#14896d' : '#aab69b';

                          return (
                            <span
                              key={ii}
                              className="transition-all duration-150 ease-out"
                              style={{
                                color,
                                fontWeight: isCurrent || isRecordingActive ? 600 : undefined,
                                textDecoration,
                                ...(isRecordingActive
                                  ? { backgroundColor: '#dbeafe', borderRadius: 2, padding: '0 1px' }
                                  : {}),
                              }}
                            >
                              {item.token}
                            </span>
                          );
                        })}

                        {/* 跟读按钮（跟读模式开启，且句子足够长时显示） */}
                        {showMicButton && (
                          <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => (isRecording ? stopRecording() : startRecording(sentKey))}
                            disabled={isProcessing || (recordingKey !== null && !isRecording)}
                            title={isRecording ? '点击停止录音' : '点击开始跟读这句话'}
                            className={`inline-flex items-center gap-1 ml-1.5 border-2 px-2 py-0.5 text-xs font-medium transition-all align-middle ${
                              isRecording
                                ? 'border-[#b94d3c] bg-[#e77e65] text-white animate-pulse cursor-pointer'
                                : isProcessing
                                  ? 'border-slate-300 bg-slate-200 text-slate-400 cursor-wait'
                                  : recordingKey !== null && !isRecording
                                    ? 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
                                    : hasEval
                                      ? 'border-emerald-700 bg-[#e2f3d0] text-emerald-900 hover:bg-[#cfeab5] cursor-pointer'
                                      : 'border-slate-500 bg-[#fff9e8] text-slate-600 hover:border-emerald-700 hover:bg-[#e2f3d0] hover:text-emerald-900 cursor-pointer'
                            }`}
                          >
                            {isRecording ? (
                              <>
                                <Square className="w-2.5 h-2.5" /> 停止
                              </>
                            ) : isProcessing ? (
                              '分析中…'
                            ) : hasEval ? (
                              <>
                                <Mic className="w-2.5 h-2.5" /> {score} 重试
                              </>
                            ) : (
                              <>
                                <Mic className="w-2.5 h-2.5" /> 跟读
                              </>
                            )}
                          </button>
                        )}

                        {/* 录音回放按钮（有评测结果 + 录音可用时显示） */}
                        {hasEval && recordingPlaybackUrl && recordingTimestamps && recordingTimestamps.length > 0 && (
                          <button
                            type="button"
                            onClick={handlePlayRecording}
                            title="播放录音并同步逐词高亮"
                            className="inline-flex items-center gap-1 ml-0.5 border-2 border-emerald-700 bg-[#e2f3d0] px-2 py-0.5 text-xs font-medium text-emerald-900 hover:bg-[#cfeab5] transition cursor-pointer"
                          >
                            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            回放
                          </button>
                        )}
                      </span>
                    );
                  });
                })()}
              </div>
            );
          };

          return (
            <div key={blockIdx} className="mb-6">
              {(viewMode === 'en' || viewMode === 'bilingual') && (
                <div className="mb-2">
                  {hasWordTimestamps
                    ? renderWordLevel()
                    : splitIntoSentences(block.en).map((sent, sentIdx) => {
                        const isActive = shouldHighlight(blockIdx, sentIdx);
                        const refKey = `${blockIdx}-${sentIdx}`;
                        return (
                          <div
                            key={sentIdx}
                            ref={(el) => {
                              if (el) paragraphRefs.current.set(refKey, el);
                              else paragraphRefs.current.delete(refKey);
                            }}
                            className={`bytemd-viewer transition-all duration-200 ${
                              isActive ? 'border-l-4 border-amber-500 bg-[#fff4cc] px-2 -mx-2' : ''
                            }`}
                          >
                            <Viewer value={sent} plugins={plugins} />
                          </div>
                        );
                      })}
                </div>
              )}
              {(viewMode === 'zh' || viewMode === 'bilingual') && (
                <div
                  className={
                    viewMode === 'bilingual'
                      ? 'border-l-4 border-emerald-600 bg-[#f3f8e9] p-3 text-base text-slate-600'
                      : ''
                  }
                >
                  {zhParagraphs.map((para, paraIdx) => (
                    <div key={paraIdx} className="bytemd-viewer my-1">
                      <Viewer value={para} plugins={plugins} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </article>
      <button
        type="button"
        onClick={onOpenQuiz}
        aria-label="打开阅读理解测验"
        className="fixed right-0 top-1/2 z-30 hidden -translate-y-1/2 border-2 border-r-0 border-slate-800 bg-amber-300 px-2 py-4 text-xs font-black text-slate-900 shadow-[-3px_3px_0_#7c2d12] lg:flex lg:flex-col lg:items-center lg:gap-1"
      >
        <BookOpenCheck size={17} />
        <span className="[writing-mode:vertical-rl]">测验</span>
      </button>
      {/* Action Footer */}
      <div className="fixed bottom-20 left-0 right-0 px-4 md:static md:px-0">
        <button
          onClick={handleComplete}
          disabled={isCompleted}
          className={`flex w-full items-center justify-center gap-2 border-2 border-slate-800 py-4 font-bold transition-all transform active:scale-95 md:w-auto md:min-w-[200px] ${
            isCompleted
              ? 'bg-[#e2f3d0] text-emerald-900 cursor-default'
              : 'bg-amber-300 text-slate-900 shadow-[3px_3px_0_#7c2d12] hover:bg-amber-400'
          }`}
        >
          {isCompleted ? (
            <>
              <CheckCircle2 size={20} />
              已完成
            </>
          ) : (
            <>标记为已完成</>
          )}
        </button>
      </div>
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          {/* Simple CSS animation for "confetti" or celebration feedback */}
          <div className="border-2 border-slate-800 bg-[#fff9e8] p-6 text-center shadow-[4px_4px_0_#7c2d12] animate-bounce">
            <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-2" />
            <h3 className="text-xl font-bold text-emerald-900">太棒了！</h3>
            <p className="text-slate-500">文章学习已完成。</p>
          </div>
        </div>
      )}
      {/* 录音回放音频元素（隐藏，仅用于 timeupdate 逐词同步） */}
      {recordingPlaybackUrl && (
        <audio
          ref={recordingAudioRef}
          src={recordingPlaybackUrl}
          onTimeUpdate={handleRecordingTimeUpdate}
          onEnded={() => setRecordingPlaybackGlobalIdx(null)}
          className="hidden"
        />
      )}
    </div>
  );
};
