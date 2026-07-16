import crypto from 'crypto';

const ENCRYPTION_VERSION = 'v1';

const getEncryptionKey = () => {
  const encodedKey = process.env.AI_SETTINGS_ENCRYPTION_KEY;
  if (!encodedKey) throw new Error('服务器未配置 AI_SETTINGS_ENCRYPTION_KEY。');

  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) throw new Error('AI_SETTINGS_ENCRYPTION_KEY 必须是 32 字节的 Base64 密钥。');
  return key;
};

export const encryptApiKey = (apiKey: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [ENCRYPTION_VERSION, iv.toString('base64url'), authTag.toString('base64url'), ciphertext.toString('base64url')].join('.');
};

export const decryptApiKey = (encryptedValue: string) => {
  const [version, ivValue, authTagValue, ciphertextValue] = encryptedValue.split('.');
  if (version !== ENCRYPTION_VERSION || !ivValue || !authTagValue || !ciphertextValue) {
    throw new Error('已保存的 AI Key 格式无效。');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8');
};

export const getApiKeyLast4 = (apiKey: string) => apiKey.slice(-4);
