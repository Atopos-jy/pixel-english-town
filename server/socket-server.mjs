import { createServer } from 'node:http';
import { loadEnvFile } from 'node:process';
import Redis from 'ioredis';
import { getToken } from 'next-auth/jwt';
import { Server } from 'socket.io';

loadEnvFile('.env');

const port = Number(process.env.SOCKET_IO_PORT || 3001);
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
});
const subscriber = redis.duplicate({ maxRetriesPerRequest: null });
const httpServer = createServer();
const io = new Server(httpServer, {
  path: '/socket.io/',
  cors: { origin: /^http:\/\/localhost:\d+$/, credentials: true },
});
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
  if (process.env.PLAZA_INTERNAL_SECRET) return process.env.PLAZA_INTERNAL_SECRET;
  if (process.env.NODE_ENV !== 'production') return process.env.NEXTAUTH_SECRET;
  return undefined;
}

async function notifyEnterPlaza(userId) {
  const internalSecret = getInternalSecret();
  const nextAppUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  if (!internalSecret) {
    console.error('[socket] 缺少 PLAZA_INTERNAL_SECRET，无法创建进入广场动态');
    return;
  }

  try {
    const response = await fetch(new URL('/api/internal/plaza/enter', nextAppUrl), {
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

io.use(async (socket, next) => {
  try {
    const request = {
      headers: socket.request.headers,
      cookies: parseCookieHeader(socket.request.headers.cookie),
    };
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: 'next-auth.session-token',
      secureCookie: false,
    });

    if (typeof token?.id !== 'string') {
      console.warn('[socket] 未解析到有效登录会话', {
        hasCookieHeader: Boolean(socket.request.headers.cookie),
        hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
        tokenFields: token ? Object.keys(token) : [],
      });
      return next(new Error('未登录'));
    }

    socket.data.userId = token.id;
    next();
  } catch (error) {
    console.error('[socket] 握手认证失败', error);
    next(new Error('认证失败'));
  }
});

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
