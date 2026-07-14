import { Article, Difficulty, Badge, UserStats } from './types';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  [Difficulty.Beginner]: '初级',
  [Difficulty.Intermediate]: '中级',
  [Difficulty.Advanced]: '高级',
};

// Simulating local files
export const MOCK_ARTICLES: Article[] = [
  {
    id: 'art-001',
    title: {
      en: 'The Benefits of Morning Sunlight',
      zh: '清晨阳光的益处'
    },
    date: new Date().toISOString().split('T')[0], // Today's article
    summary: {
      en: 'Discover why getting sunlight early in the morning can improve your sleep and mood.',
      zh: '探索为什么早晨晒太阳可以改善你的睡眠和情绪。'
    },
    content: [
      {
        en: "Exposure to sunlight in the morning is crucial for maintaining a healthy circadian rhythm. Your body's internal clock relies on light signals to know when to wake up and when to sleep.",
        zh: "早晨接触阳光对于维持健康的昼夜节律至关重要。你身体的生物钟依赖光信号来判断何时醒来以及何时入睡。"
      },
      {
        en: "Scientists suggest that viewing sunlight within the first hour of waking can increase cortisol levels appropriately, leading to better alertness during the day. Furthermore, it triggers the release of serotonin, a hormone that boosts mood and focus.",
        zh: "科学家建议，在醒来后的一小时内接触阳光可以适当提高皮质醇水平，从而在白天保持更好的警觉性。此外，它还能触发血清素的释放，这是一种能提升情绪和专注力的荷尔蒙。"
      },
      {
        en: "Just 10 to 15 minutes of exposure is often enough for most people. However, looking through a window reduces the effectiveness, so it is best to step outside.",
        zh: "对大多数人来说，只需接触10到15分钟就足够了。然而，透过窗户看阳光会降低效果，所以最好是走到户外。"
      }
    ],
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/morning_farm_birds.ogg', 
    difficulty: Difficulty.Intermediate,
    durationSeconds: 120,
  },
  {
    id: 'art-002',
    title: {
      en: 'A Brief History of Coffee',
      zh: '咖啡简史'
    },
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
    summary: {
      en: 'From Ethiopian legends to global dominance, trace the journey of the world’s favorite bean.',
      zh: '从埃塞俄比亚的传说到全球风靡，追溯这颗世界上最受欢迎的豆子的旅程。'
    },
    content: [
      {
        en: "The story of coffee begins in Ethiopia, where legend has it that a goat herder named Kaldi noticed his goats becoming energetic after eating red berries from a certain tree.",
        zh: "咖啡的故事始于埃塞俄比亚，传说那里的一位名叫卡尔迪（Kaldi）的牧羊人注意到他的山羊在吃了一种树上的红浆果后变得精力充沛。"
      },
      {
        en: "By the 15th century, coffee was being grown in the Yemeni district of Arabia. By the 16th century, it was known in Persia, Egypt, Syria, and Turkey.",
        zh: "到了15世纪，阿拉伯的也门地区开始种植咖啡。到了16世纪，波斯、埃及、叙利亚和土耳其也都知道了咖啡。"
      },
      {
        en: "Today, coffee is one of the most traded commodities in the world, second only to oil.",
        zh: "如今，咖啡是世界上交易量最大的商品之一，仅次于石油。"
      }
    ],
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg',
    difficulty: Difficulty.Beginner,
    durationSeconds: 180,
  },
  {
    id: 'art-003',
    title: {
      en: 'Understanding Artificial Intelligence',
      zh: '理解人工智能'
    },
    date: '2023-10-25',
    summary: {
      en: 'What is AI, and how is it reshaping our future?',
      zh: '什么是人工智能，它又是如何重塑我们的未来的？'
    },
    content: [
      {
        en: "Artificial Intelligence (AI) refers to the simulation of human intelligence in machines. These machines are programmed to think like humans and mimic their actions.",
        zh: "人工智能（AI）指的是在机器中模拟人类智能。这些机器被编程为像人类一样思考并模仿人类的行为。"
      },
      {
        en: "From chess-playing computers to self-driving cars, AI is rapidly evolving. Machine learning, a subset of AI, allows systems to learn from data rather than being explicitly programmed.",
        zh: "从下棋电脑到自动驾驶汽车，人工智能正在迅速发展。机器学习是人工智能的一个子集，它允许系统从数据中学习，而不是被明确编程。"
      }
    ],
    audioUrl: '', 
    difficulty: Difficulty.Advanced,
    durationSeconds: 240,
  },
  {
    id: 'art-004',
    title: {
      en: 'The Art of Minimalist Living',
      zh: '极简生活的艺术'
    },
    date: '2023-10-24',
    summary: {
      en: 'Less is more: how decluttering can lead to a happier life.',
      zh: '少即是多：清理杂物如何带来更幸福的生活。'
    },
    content: [
      {
        en: "Minimalism is not just about getting rid of possessions; it's about making room for what truly matters.",
        zh: "极简主义不仅仅是摆脱财产；它是为了给真正重要的事情腾出空间。"
      }
    ],
    difficulty: Difficulty.Intermediate,
    durationSeconds: 90,
  }
];

export const BADGES: Badge[] = [
  {
    id: 'badge-first-step',
    name: '初次启程',
    description: '完成你的第一篇文章',
    icon: '🌱',
    condition: (stats: UserStats) => stats.totalArticlesCompleted >= 1,
  },
  {
    id: 'badge-on-fire',
    name: '状态火热',
    description: '达成连续 3 天学习打卡',
    icon: '🔥',
    condition: (stats: UserStats) => stats.currentStreak >= 3,
  },
  {
    id: 'badge-scholar',
    name: '博学者',
    description: '累计完成 10 篇文章',
    icon: '🎓',
    condition: (stats: UserStats) => stats.totalArticlesCompleted >= 10,
  },
  {
    id: 'badge-master',
    name: '阅读大师',
    description: '完成一篇高级难度文章',
    icon: '👑',
    condition: (stats: UserStats) => stats.articlesByDifficulty[Difficulty.Advanced] > 0,
  }
];

export const MOTIVATIONAL_QUOTES = [
  "做得好！你每天都在进步。",
  "坚持就是胜利。明天见！",
  "知识就是力量。保持阅读！",
  "太棒了！你掌握了今天的课程。",
];