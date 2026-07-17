# 像素英语小镇：代码规范

> 本文档定义项目编码标准。所有提交代码必须符合本文档要求。
> 现有代码中违反规范的部分（`@ts-ignore`、`any`、`strict: false` 等）应在后续迭代中逐步修正。

---

## 1. TypeScript 严格模式

### 1.1 编译器配置

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
  },
}
```

当前项目 `strict: false`，编码时按 `strict: true` 标准书写，逐步消除类型漏洞。

### 1.2 禁止 `any`

- **禁止**在任何新增代码中使用 `any`
- 现有 `any`（如 `lib/db-utils.ts` 的 `catch (error: any)`）在触及该文件时改为 `unknown`
- 回调、泛型参数使用具体类型或 `unknown`，不偷懒用 `any`

```ts
// ❌ 禁止
catch (error: any) { ... }
const data: any = await fetchSomething();

// ✅ 正确
catch (error: unknown) {
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```

### 1.3 禁止 `@ts-ignore`

- **禁止**在新增代码中使用 `@ts-ignore`
- 现有 6 处 `@ts-ignore` 需逐一修复（见附录）
- 已知类型不匹配用 `@ts-expect-error` 带注释说明原因，且仅在暂无法修复时使用
- 必须附带说明：`// @ts-expect-error: NextAuth session.user.role 类型扩展中`

```ts
// ❌ 禁止
// @ts-ignore
session.user.role;

// ✅ 已修复：扩展 next-auth 类型声明（见 types/next-auth.d.ts）
session.user.role; // 类型安全
```

### 1.4 类型定义

| 场景          | 使用           | 示例                                                           |
| ------------- | -------------- | -------------------------------------------------------------- |
| 对象/参数形状 | `interface`    | `interface ArticleContent { en: string; zh: string }`          |
| 联合类型      | `type`         | `type Difficulty = 'Beginner' \| 'Intermediate' \| 'Advanced'` |
| 固定值枚举    | `enum`         | `enum UserRole { User = 'user', Admin = 'admin' }`             |
| 映射/字典     | `Record<K, V>` | `Record<Difficulty, string>`                                   |

```ts
// ❌ 不需要的冗余
export interface SingleFieldInterface {
  value: string;
}

// ✅ 直接内联或使用 type
export type Status = 'idle' | 'loading' | 'success' | 'error';
```

---

## 2. 文件组织

### 2.0 多包演进边界

当前仓库是单包 Next.js 项目。引入独立 Socket.IO 服务时，按以下结构迁移：`apps/web` 存放 Next.js，`apps/realtime` 存放 Socket.IO，`packages/contracts` 存放 HTTP DTO、广场快照和事件类型。`web` 与 `realtime` 只能依赖 `contracts`；`contracts` 不得依赖 Next.js、Prisma、React、浏览器 API 或数据库。

单包阶段的 `types/plaza.ts` 是过渡位置；迁移多包时必须移至 `@pixel-town/contracts`。`@/` 别名只适用于同一应用内导入，跨包必须使用包名导入。

### 2.1 目录结构

```text
├── app/                       # Next.js App Router
│   ├── (user)/               # 用户端路由组（无 URL 前缀）
│   │   ├── learn/            # /learn
│   │   ├── plaza/            # /plaza
│   │   ├── town/             # /town
│   │   └── ...
│   ├── admin/                # /admin 管理后台
│   ├── api/                  # API Routes
│   └── page.tsx              # / 首页
├── components/               # 可复用组件
├── contexts/                 # React Context
├── hooks/                    # 自定义 Hooks
├── lib/                      # 工具函数 + 服务端库
│   └── ai/                   # AI 相关（加密、出题、限流）
├── prisma/                   # Prisma schema + 迁移
├── services/                 # 客户端服务层（API 调用封装）
├── types/                    # 类型声明文件 (.d.ts 模块扩展)
│   ├── types.ts              # ⚠️ 根目录也有一份 types.ts，逐步迁移到 types/ 目录下
├── public/                   # 静态资源
│   └── images/               # 图片（按功能分子目录）
└── docs/                     # 项目文档
```

### 2.2 命名规则

| 类型         | 规则                         | 示例                        |
| ------------ | ---------------------------- | --------------------------- |
| 路由目录     | kebab-case                   | `(user)/article/[id]/`      |
| 组件文件     | PascalCase                   | `ArticleReader.tsx`         |
| 页面文件     | `page.tsx`（Next.js 保留名） | `app/(user)/learn/page.tsx` |
| API Route    | `route.ts`（Next.js 保留名） | `app/api/articles/route.ts` |
| 工具/库文件  | kebab-case                   | `db-utils.ts`               |
| 类型声明文件 | kebab-case + `.d.ts`         | `next-auth.d.ts`            |
| 静态图片目录 | kebab-case                   | `public/images/home/`       |

### 2.3 每个文件的职责

- **单文件不超过 300 行**（不含类型声明和模板代码多的组件）
- 一个文件只做一件事：一个组件、一个 Hook、一组相关工具函数
- 超过两处重复的逻辑必须抽取到 `lib/` 或 `hooks/`
- 不同运行时不得互相导入：客户端不导入 Prisma、Redis 或服务端密钥；Socket.IO 服务不导入页面、组件或客户端 `services/`

---

## 3. 组件规范

### 3.1 客户端 vs 服务端

- **默认是服务端组件**，不写 `'use client'`
- 仅在需要交互（事件、状态、Effect、浏览器 API）时声明 `'use client'`
- 把交互逻辑下沉到叶子组件，不要把整页变成客户端组件

```tsx
// ✅ 正确：服务端页面 + 客户端叶子
// app/(user)/learn/page.tsx（服务端，没有 'use client'）
import { ArticleReader } from '@/components/ArticleReader'; // 客户端组件

// components/ArticleReader.tsx
('use client');
```

### 3.2 组件结构

```tsx
'use client'; // 仅客户端组件需要（放在文件第一行）

// 1. React / Next.js 导入
import { useState } from 'react';
// 2. 第三方库
import { useSession } from 'next-auth/react';
// 3. 项目内部（@/ 别名）
import { Loading } from '@/components/Loading';
// 4. 类型导入
import type { Article } from '@/types';

// Props 类型定义
interface ArticleReaderProps {
  article: Article;
  onComplete?: () => void;
}

// 组件：导出方式统一为命名导出（页面组件可用 default）
export function ArticleReader({ article, onComplete }: ArticleReaderProps) {
  const { status } = useSession();
  const [loading, setLoading] = useState(false);

  // 事件处理器以 handle 开头
  const handleComplete = async () => {
    setLoading(true);
    // ...
    setLoading(false);
    onComplete?.();
  };

  return <div>{/* JSX */}</div>;
}
```

### 3.3 导出规则

| 文件类型                 | 导出方式         | 原因                      |
| ------------------------ | ---------------- | ------------------------- |
| 页面组件（`page.tsx`）   | `export default` | Next.js 要求              |
| 布局组件（`layout.tsx`） | `export default` | Next.js 要求              |
| 普通组件                 | **命名导出**     | IDE 自动导入 + 重命名安全 |
| 工具函数                 | **命名导出**     | 便于 tree-shaking         |
| Context                  | **命名导出**     | 与 Provider 搭配          |

```tsx
// components/MyComponent.tsx
export function MyComponent() { ... }        // ✅ 普通组件
export default function AdminLayout() { ... } // ✅ 布局（Next.js 要求）

// lib/utils.ts
export function formatDate(date: string) { ... } // ✅ 工具函数
```

### 3.4 Props

- Props 类型定义在组件文件的 import 之后、组件之前
- 命名：`{ComponentName}Props`
- 可选 props 用 `?`，不传 `undefined`
- 不允许 `props: Record<string, any>` 或 `props: any`

```tsx
interface MyComponentProps {
  title: string;
  count?: number; // 可选，不传为 undefined
  onClose?: () => void;
}
```

### 3.5 State 与 Hooks

```tsx
// 事件处理器命名
const handleSubmit = () => { ... };
const handleInputChange = () => { ... };

// 布尔状态以 is/has/can 开头
const [isOpen, setIsOpen] = useState(false);
const [hasError, setHasError] = useState(false);

// 计算变量使用 useMemo 或直接派生
const displayCount = count ?? 0;
```

---

## 4. API Route 规范

### 4.1 结构

```ts
// app/api/resource/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/resource
 * 获取资源列表
 */
export async function GET() {
  try {
    // 1. 认证/授权
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // 2. 业务逻辑
    const items = await prisma.resource.findMany();

    // 3. 返回
    return NextResponse.json(items);
  } catch (error) {
    console.error('获取资源失败:', error);
    return NextResponse.json({ error: '获取资源失败' }, { status: 500 });
  }
}
```

### 4.2 规则

- 每个 HTTP 方法导出一个同名函数（`GET`、`POST`、`PUT`、`DELETE`）
- 错误日志用 `console.error` 并带中文描述
- 返回给客户端的错误信息用中文
- 不要在 API Route 中写业务逻辑——抽取到 `lib/` 中
- 认证检查放在业务逻辑之前

### 4.3 验证

```ts
// 输入验证在路由中完成，不依赖数据库约束报错
if (!titleEn || !titleZh) {
  return NextResponse.json({ error: '缺少必需字段' }, { status: 400 });
}
```

---

## 5. 数据库操作规范

### 5.1 Prisma 使用

```ts
// 全局单例（见 lib/prisma.ts）
import { prisma } from '@/lib/prisma';

// 读取：直接调用
const user = await prisma.user.findUnique({ where: { id } });

// 多表写入：使用交互式事务
const result = await prisma.$transaction(async (tx) => {
  const record = await tx.articleCompletion.create({ data });
  await tx.userProgress.update({ where: { userId }, data });
  return record;
});

// 原生查询仅用于无法用 Prisma API 表达的场景
const count = await prisma.$queryRaw<Array<{ cnt: bigint }>>`SELECT COUNT(*) as cnt FROM articles`;
```

### 5.2 规则

- 不直接操作 `prisma` 对象之外的数据源
- `$transaction` 用于多表原子写入，不用于只读操作
- 事务回调内的所有操作使用传入的 `tx`，不用外层的 `prisma`
- 含用户输入的原生查询必须使用参数化（`` $queryRaw`...` `` 或 `$executeRaw`），禁止拼接 SQL
- Prisma 错误码（`P2002`、`P2025` 等）仅在需要区分错误类型时判断，一般情况用 `try/catch` 兜底

---

## 6. 错误处理

### 6.1 规则

```ts
// ✅ API Route：区分已知错误和未知错误
try {
  const result = await someOperation();
  return NextResponse.json(result);
} catch (error: unknown) {
  if (error instanceof SomeKnownError) {
    return NextResponse.json({ error: '已知错误' }, { status: 400 });
  }
  console.error('操作失败:', error);
  return NextResponse.json({ error: '服务器错误' }, { status: 500 });
}

// ✅ 工具函数：抛出可理解的错误
export function getOssClient(): OSS {
  if (!accessKeyId) {
    throw new Error('OSS 配置不完整');
  }
  return new OSS({ ... });
}

// ✅ 数据库：区分连接错误和业务错误
try {
  await prisma.article.create({ data });
} catch (error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      // 唯一约束冲突
    }
  }
  throw error;
}
```

### 6.2 禁止

- 禁止 `catch {}` 空块（吞掉错误）
- 禁止仅 `console.log(error)` 而不重新抛出或处理
- 禁止在前端展示原始 `error.message` 给用户（应映射为友好文案）

---

## 7. 导入排序

使用以下固定顺序，组间空一行：

```ts
// 1. React / Next.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. 第三方库
import { signIn } from 'next-auth/react';
import { BookOpen } from 'lucide-react';

// 3. 项目内部（@/ 别名）
import { ArticleReader } from '@/components/ArticleReader';
import { prisma } from '@/lib/prisma';

// 4. 类型导入（import type 放在最后）
import type { Article, Difficulty } from '@/types';
```

- 同组内按字母序排列
- `import type` 单独成组
- **所有项目内导入必须使用 `@/` 别名**，禁止 `../` 相对路径引用跨目录模块
- 字符串使用**单引号** `'`，JSX 属性使用**双引号** `"`（Prettier 默认）

```ts
// ❌ 禁止相对路径 + 双引号混用
import { Article } from '../types';
import { DIFFICULTY_LABELS } from '../constants';
import { Loading } from './Loading';

// ✅ 统一 @/ 别名 + 单引号
import { Article } from '@/types';
import { DIFFICULTY_LABELS } from '@/constants';
import { Loading } from '@/components/Loading';
```

---

## 8. 样式规范

### 8.1 Tailwind CSS

项目使用 Tailwind CSS，规则：

- 单个页面布局可保留 Tailwind utility；仅当同一组视觉类在两处及以上重复时，才抽为组件或 `globals.css` 的 `@layer components`
- 使用 Tailwind 内置 token（如 `bg-slate-50`），不随意用方括号写任意值
- 仅在 Tailwind token 不存在时使用方括号：`shadow-[7px_7px_0_#070b14]`

### 8.2 图片资源

- 图片放在 `public/images/{功能目录}/`
- 引用：`<img src="/images/home/enter-town-button.png" alt="进入小镇" />`
- 必须写 `alt` 属性（装饰性图片用 `alt=""`）

---

## 9. 注释规范

### 9.1 JSDoc

```ts
/**
 * 使用原子序列生成下一个文章编号（art-NNN 格式）。
 * 在 Prisma 事务内递增 article_id_sequences 表，保证并发安全。
 */
export async function getNextArticleId(): Promise<string> { ... }
```

- 导出函数必须写 JSDoc
- 复杂逻辑的**为什么**用注释，**做什么**用 JSDoc
- 注释用中文（项目语言）

### 9.2 注释标记

```ts
// TODO: 切换到 ArticleCompletion 表后移除此字段
// FIXME: 当前使用 @ts-ignore 绕过 next-auth 类型，需在 types/next-auth.d.ts 中扩展
// HACK: 临时方案，等待 Prisma 版本升级后移除
```

---

## 10. Git 提交规范

```text
<type>(<scope>): <subject>

type:
  feat      — 新功能
  fix       — Bug 修复
  refactor  — 重构（不改变行为）
  chore     — 工程化（依赖、配置、脚本）
  docs      — 文档
  style     — 纯样式调整
  test      — 测试

scope: 功能模块（如 广场、文章、后台、认证）

示例:
  feat: 添加实时在线人数统计
  fix: 使用事务生成连续编号
  refactor: 移除 auth.ts 中的 @ts-ignore
  chore: 添加 ESLint 和 Prettier 配置
```

提交信息用**中文**，与现有提交风格保持一致。

---

## 11. 工具链配置

### 11.0 提交前检查

项目使用 ESLint、Prettier、Husky 与 lint-staged。`pre-commit` 仅检查暂存的代码和文档：TypeScript/JavaScript 运行 ESLint 与 Prettier 检查，JSON/Markdown/YAML/CSS 运行 Prettier 检查。检查失败时提交被阻止；修复后重新暂存即可。

### 11.1 推荐安装

```bash
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D prettier eslint-config-prettier
pnpm exec eslint --init  # 按提示选择 Next.js + TypeScript + Prettier
```

### 11.2 推荐 ESLint 规则

```jsonc
// .eslintrc.json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/ban-ts-comment": ["error", { "ts-ignore": true }],
    "no-console": ["warn", { "allow": ["error", "warn"] }],
    "import/order": [
      "warn",
      {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "type"],
        "newlines-between": "always",
      },
    ],
  },
}
```

---

## 附录 A：现有 `@ts-ignore` 修复计划

| 文件                                 | 行         | 原因                     | 修复方案                                                    |
| ------------------------------------ | ---------- | ------------------------ | ----------------------------------------------------------- |
| `lib/prisma.ts`                      | 1          | PrismaClient 导入        | 移除，Prisma Client 类型正常                                |
| `lib/auth.ts`                        | 63, 65, 87 | `session.user.role` 类型 | `types/next-auth.d.ts` 已扩展类型，移除 `@ts-ignore` 并验证 |
| `components/AdminLayout.tsx`         | 27, 43     | 同上                     | 同上                                                        |
| `app/api/progress/route.ts`          | 16         | 同上                     | 同上                                                        |
| `app/api/progress/complete/route.ts` | 16         | 同上                     | 同上                                                        |
| `App.tsx`                            | 127        | 未知                     | 排查后修复或补充类型                                        |

---

## 附录 B：现有 `any` 清理计划

### catch (error: any) — 7 处

| 文件                             | 修复                                                                       |
| -------------------------------- | -------------------------------------------------------------------------- |
| `lib/db-utils.ts`                | 改为 `unknown` + `instanceof Error` + Prisma 错误码判断                    |
| `components/AuthForm.tsx`        | 改为 `unknown`，使用 `error instanceof Error ? error.message : '发生错误'` |
| `components/ArticleReader.tsx`   | 同上                                                                       |
| `components/ArticleQuiz.tsx`     | 同上                                                                       |
| `app/api/progress/route.ts`      | 同上                                                                       |
| `app/api/speaking-eval/route.ts` | 同上                                                                       |
| `app/api/transcribe/route.ts`    | 同上                                                                       |

### as any — 用于 Prisma JSON 列

| 文件                                 | 用法                              | 修复                                                        |
| ------------------------------------ | --------------------------------- | ----------------------------------------------------------- |
| `constants.ts`                       | `content: article.content as any` | 修复 `Article` 类型，使 `content` 类型与 Prisma JSON 列对齐 |
| `app/api/articles/route.ts`          | `content: article.content as any` | 同上                                                        |
| `app/api/progress/complete/route.ts` | `activityLog as any`              | 定义 `ActivityLog` 类型替代 `any`                           |
| `app/api/progress/route.ts`          | `completedArticleIds as any`      | 用 `ArticleCompletion` 表替代 JSON 字段后自然消除           |

---

## 附录 C：代码检查清单

提交前自检：

- [ ] 无 `any`
- [ ] 无 `@ts-ignore`
- [ ] 项目内导入使用 `@/` 别名，无相对路径
- [ ] 字符串单引号、JSX 属性双引号
- [ ] 导出函数有 JSDoc
- [ ] Props 有类型定义
- [ ] 错误有友好提示且不暴露内部信息
- [ ] 无重复代码（超过两次使用应抽取）
- [ ] 导入排序正确（React → 第三方 → 项目 → type）
- [ ] 组件文件不超过 300 行
- [ ] `'use client'` 仅在需要交互的叶子组件上
- [ ] `console.error` 日志带中文描述
- [ ] 提交信息符合 `<type>(<scope>): <subject>` 格式
