import crypto from 'node:crypto';

export function decryptApiKey(encryptedValue: string, encodedKey: string): string {
  const [version, ivValue, authTagValue, ciphertextValue] = encryptedValue.split('.');
  const key = Buffer.from(encodedKey, 'base64');
  if (version !== 'v1' || !ivValue || !authTagValue || !ciphertextValue || key.length !== 32) {
    throw new Error('已保存的 AI Key 无效');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8');
}
