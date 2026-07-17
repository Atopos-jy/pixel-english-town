import { createServer } from 'node:http';
import Redis from 'ioredis';
import { getToken } from 'next-auth/jwt';
import { Server } from 'socket.io';

const port = Number(process.env.SOCKET_IO_PORT || 3001);
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const subscriber = redis.duplicate();
const io = new Server(createServer(), { cors: { origin: process.env.NEXTAUTH_URL, credentials: true } });
const server = io.httpServer;

async function onlineCount() {
  const members = await redis.smembers('plaza:online');
  return members.length;
}

io.on('connection', async (socket) => {
  const token = await getToken({ req: socket.request, secret: process.env.NEXTAUTH_SECRET });
  const userId = token?.id;
  if (typeof userId !== 'string' || userId.length === 0) return socket.disconnect(true);
  socket.data.userId = userId;
  await redis.sadd('plaza:online', userId);
  socket.join('plaza');
  io.to('plaza').emit('plaza:online-update', { count: await onlineCount() });
  socket.on('disconnect', async () => {
    const remaining = [...io.sockets.sockets.values()].some((item) => item.data.userId === userId);
    if (!remaining) await redis.srem('plaza:online', userId);
    io.to('plaza').emit('plaza:online-update', { count: await onlineCount() });
  });
});

await subscriber.subscribe('plaza:events');
subscriber.on('message', (_channel, message) => io.to('plaza').emit('plaza:feed', JSON.parse(message)));
server.listen(port, () => console.log(`Socket.IO listening on ${port}`));
