import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { Server } from 'socket.io';

// 兼容 Node < 22：手动加载 .env 文件（Node 22+ 才有 loadEnvFile）
// 从脚本路径反推仓库根目录，不依赖 process.cwd()
function loadEnv() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const envPath = join(scriptDir, '..', '..', '..', '.env');
  if (!existsSync(envPath)) {
    console.warn('[socket] .env 文件不存在，仅使用系统环境变量');
    return;
  }
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // 去除引号
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const port = Number(process.env.SOCKET_IO_PORT || 3001);
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const prisma = new PrismaClient();
const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET || '');
const allowedOrigins = (process.env.SOCKET_CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// ---- Redis 连接（必须成功，广场实时功能强依赖 Redis） ----
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  lazyConnect: true,
});

try {
  await redis.connect();
  console.warn('[socket] Redis 连接成功:', redisUrl);
} catch (error) {
  console.error('========================================');
  console.error('[socket] Redis 连接失败，Socket.IO 服务无法启动');
  console.error('[socket]');
  console.error('[socket] 请检查 .env 中的 REDIS_URL，当前值:', redisUrl);
  console.error('[socket]');
  console.error('[socket] 如果是通过 SSH 隧道连接远程 Redis：');
  console.error('[socket]   ssh -L 6379:127.0.0.1:6379 user@your-server');
  console.error('[socket]   然后 .env 中写 REDIS_URL=redis://127.0.0.1:6379');
  console.error('[socket]');
  console.error('[socket] 如果是本地 Docker Redis：');
  console.error('[socket]   docker run -d --name redis -p 6379:6379 redis:7-alpine');
  console.error('[socket]');
  console.error('[socket] 错误详情:', error.message);
  console.error('========================================');
  process.exit(1);
}

const subscriber = redis.duplicate({ maxRetriesPerRequest: null });

// ---- HTTP + Socket.IO 服务 ----
const httpServer = createServer();
const io = new Server(httpServer, {
  path: '/socket.io/',
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('[socket] CORS 拒绝来源:', origin);
        callback(new Error('Socket.IO CORS origin is not allowed'));
      }
    },
    credentials: true,
  },
});

// ---- Redis Lua 脚本：在线状态管理 ----
const presenceKey = 'plaza:presence';
const presenceTtlMs = 45_000;
const presenceRefreshMs = 30_000;

const upsertPresenceScript = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
local members = redis.call('ZRANGE', KEYS[1], 0, -1)
local users = {}
local count = 0

for _, member in ipairs(members) do
  local separator = string.find(member, '|', 1, true)
  if separator then
    local userId = string.sub(member, separator + 1)
    if not users[userId] then
      users[userId] = true
      count = count + 1
    end
  end
end

return count
`;

const removePresenceScript = `
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[2])
local members = redis.call('ZRANGE', KEYS[1], 0, -1)
local users = {}
local count = 0

for _, member in ipairs(members) do
  local separator = string.find(member, '|', 1, true)
  if separator then
    local userId = string.sub(member, separator + 1)
    if not users[userId] then
      users[userId] = true
      count = count + 1
    end
  end
end

return count
`;

function parseCookieHeader(cookieHeader = '') {
  return cookieHeader.split(';').reduce((cookies, cookiePart) => {
    const separatorIndex = cookiePart.indexOf('=');
    if (separatorIndex < 1) return cookies;

    const name = cookiePart.slice(0, separatorIndex).trim();
    const rawValue = cookiePart.slice(separatorIndex + 1).trim();

    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }

    return cookies;
  }, {});
}

async function upsertPresence(member) {
  const now = Date.now();
  const result = await redis.eval(upsertPresenceScript, 1, presenceKey, now, now + presenceTtlMs, member);
  return Number(result);
}

async function removePresence(member) {
  const result = await redis.eval(removePresenceScript, 1, presenceKey, member, Date.now());
  return Number(result);
}

function getInternalSecret() {
  return process.env.PLAZA_INTERNAL_SECRET;
}

async function notifyEnterPlaza(userId) {
  const internalSecret = getInternalSecret();
  const apiOrigin = process.env.API_ORIGIN || 'http://localhost:4000';

  if (!internalSecret) {
    console.error('[socket] 缺少 PLAZA_INTERNAL_SECRET，无法创建进入广场动态');
    return;
  }

  try {
    const response = await fetch(new URL('/api/v1/internal/plaza/enter', apiOrigin), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${internalSecret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ userId }),
      signal: AbortSignal.timeout(5_000),
    });
    const responseText = await response.text();

    if (!response.ok) {
      console.error('[socket] 创建进入广场动态失败', {
        status: response.status,
        response: responseText,
      });
    }
  } catch (error) {
    console.error('[socket] 调用进入广场内部接口失败', error);
  }
}

// ---- 认证中间件 ----
io.use(async (socket, next) => {
  try {
    const token = parseCookieHeader(socket.request.headers.cookie)['pixel-town.token'];
    if (!token || !process.env.JWT_SECRET) return next(new Error('Not authenticated'));
    const { payload } = await jwtVerify(token, jwtSecret);
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return next(new Error('Invalid session'));
    const session = await prisma.userSession.findFirst({
      where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { userId: true },
    });
    if (!session) return next(new Error('Session expired'));
    socket.data.userId = session.userId;
    next();
  } catch (error) {
    console.error('[socket] 握手认证失败', error);
    next(new Error('认证失败'));
  }
});

// ---- 连接处理 ----
io.on('connection', async (socket) => {
  const userId = socket.data.userId;
  const presenceMember = `${socket.id}|${userId}`;
  let refreshTimer;

  try {
    const count = await upsertPresence(presenceMember);
    await socket.join('plaza');

    console.warn('[socket] 广场连接成功', { socketId: socket.id, userId, count });
    io.to('plaza').emit('plaza:online-update', { count });
    void notifyEnterPlaza(userId);

    refreshTimer = setInterval(async () => {
      try {
        const refreshedCount = await upsertPresence(presenceMember);
        io.to('plaza').emit('plaza:online-update', { count: refreshedCount });
      } catch (error) {
        console.error('[socket] 续期在线状态失败', error);
      }
    }, presenceRefreshMs);
  } catch (error) {
    console.error('[socket] 写入在线状态失败', error);
    socket.disconnect(true);
    return;
  }

  socket.on('disconnect', async (reason) => {
    if (refreshTimer) clearInterval(refreshTimer);

    try {
      const count = await removePresence(presenceMember);
      console.warn('[socket] 广场连接断开', { socketId: socket.id, userId, reason, count });
      io.to('plaza').emit('plaza:online-update', { count });
    } catch (error) {
      console.error('[socket] 清理在线状态失败', error);
    }
  });
});

// ---- Redis Pub/Sub：跨进程消息广播 ----
await subscriber.subscribe('plaza:events');
subscriber.on('message', (_channel, message) => {
  try {
    const event = JSON.parse(message);
    if (event.type === 'leaderboard.updated') {
      io.to('plaza').emit('plaza:leaderboard-update', event);
      return;
    }
    if (event.type === 'feed.created') {
      io.to('plaza').emit('plaza:feed', event);
    }
  } catch (error) {
    console.error('[socket] 广场动态消息格式错误', error);
  }
});

redis.on('error', (error) => {
  console.error('[socket] Redis 命令连接错误', error.message);
});

subscriber.on('error', (error) => {
  console.error('[socket] Redis 订阅连接错误', error.message);
});

io.engine.on('connection_error', (error) => {
  console.error('[socket] Engine.IO 连接错误', {
    code: error.code,
    message: error.message,
    context: error.context,
  });
});

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[socket] 端口 ${port} 已被占用，请先关闭旧的 Socket.IO 进程`);
    return;
  }

  console.error('[socket] HTTP 服务错误', error);
});

httpServer.listen(port, () => console.warn(`Socket.IO listening on ${port}`));
