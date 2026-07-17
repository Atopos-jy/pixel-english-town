import { redis } from '@/lib/redis';

const PRESENCE_KEY = 'plaza:presence';

const COUNT_ONLINE_USERS_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
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

export async function getPlazaOnlineCount(): Promise<number> {
  const result = await redis.eval(COUNT_ONLINE_USERS_SCRIPT, 1, PRESENCE_KEY, Date.now());
  return typeof result === 'number' ? result : Number(result);
}
