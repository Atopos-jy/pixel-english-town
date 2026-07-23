import crypto from 'node:crypto';

function getKey(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) throw new Error('AI_SETTINGS_ENCRYPTION_KEY 必须是 32 字节的 Base64 密钥。');
  return key;
}

export function encryptApiKey(value: string, encodedKey: string): string {
  const key = getKey(encodedKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptApiKey(encryptedValue: string, encodedKey: string): string {
  const [version, ivValue, authTagValue, ciphertextValue] = encryptedValue.split('.');
  const key = getKey(encodedKey);
  if (version !== 'v1' || !ivValue || !authTagValue || !ciphertextValue) {
    throw new Error('已保存的 AI Key 无效');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8');
}
