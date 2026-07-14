export type WordStatus = 'correct' | 'substituted' | 'deleted';

export interface WordEvalResult {
  originalWord: string;
  status: WordStatus;
  spokenAs?: string;
}

function normalize(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * 用编辑距离（Levenshtein）对齐原文单词和用户朗读单词。
 *
 * 返回原文中每个单词的评测结果：
 *  - correct:     读对了（normalize 后匹配）
 *  - substituted: 读错了（该位置发音不同）
 *  - deleted:     漏读（原文有，用户没说）
 *
 * 用户多说的词（insertions）直接丢弃，不计入原文对应位置。
 */
export function alignWords(original: string, spoken: string): WordEvalResult[] {
  const orig = original.split(/\s+/).filter(w => normalize(w).length > 0);
  const spkn = spoken.split(/\s+/).filter(w => normalize(w).length > 0);
  const m = orig.length;
  const n = spkn.length;

  // DP 表：dp[i][j] = edit distance between orig[0..i-1] and spkn[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (normalize(orig[i - 1]) === normalize(spkn[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯：优先匹配 > 替换 > 删除 > 插入
  const result: WordEvalResult[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (
      i > 0 && j > 0 &&
      normalize(orig[i - 1]) === normalize(spkn[j - 1]) &&
      dp[i][j] === dp[i - 1][j - 1]
    ) {
      result.unshift({ originalWord: orig[i - 1], status: 'correct' });
      i--; j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      result.unshift({ originalWord: orig[i - 1], status: 'substituted', spokenAs: spkn[j - 1] });
      i--; j--;
    } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
      result.unshift({ originalWord: orig[i - 1], status: 'deleted' });
      i--;
    } else {
      j--; // 用户多说的词，跳过
    }
  }
  return result;
}
