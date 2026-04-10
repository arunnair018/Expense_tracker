const crypto = require('crypto');

// Derive a fixed 32-byte key from JWT_SECRET
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(process.env.JWT_SECRET || 'fallback-secret')
  .digest();

/**
 * Encrypts a plain-text string using AES-256-GCM.
 * Returns a "iv:tag:ciphertext" hex string safe to store in DB.
 */
function encrypt(text) {
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

/**
 * Decrypts a string produced by encrypt().
 */
function decrypt(stored) {
  const [ivHex, tagHex, encHex] = stored.split(':');
  const iv       = Buffer.from(ivHex,  'hex');
  const tag      = Buffer.from(tagHex, 'hex');
  const enc      = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc, undefined, 'utf8') + decipher.final('utf8');
}

module.exports = { encrypt, decrypt };
