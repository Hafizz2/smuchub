// lib/cryptoUtil.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

if (!process.env.ENCRYPTION_SECRET_KEY) {
  throw new Error('ENCRYPTION_SECRET_KEY missing');
}
if (process.env.ENCRYPTION_SECRET_KEY.length !== 64) {
  throw new Error('ENCRYPTION_SECRET_KEY must be 64 hex characters (32 bytes).');
}
const SECRET_KEY = Buffer.from(process.env.ENCRYPTION_SECRET_KEY, 'hex');

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(String(text), 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(enc) {
  const parts = enc.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
