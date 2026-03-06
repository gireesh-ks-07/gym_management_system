/**
 * AES-256-CBC field-level encryption utility.
 *
 * Use this to encrypt sensitive PII stored in the database (e.g., aadhaar_number).
 *
 * Requirements:
 *   - Set ENCRYPTION_KEY in .env as a 64-character hex string (= 32 bytes for AES-256).
 *   - Generate a key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Encrypted values are stored as "enc:<iv_hex>:<ciphertext_hex>".
 * Plain values are returned unchanged if encryption is disabled or if the value
 * was stored before encryption was enabled (graceful fallback).
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

let KEY = null;
let ENCRYPTION_ENABLED = false;

const RAW_KEY = process.env.ENCRYPTION_KEY;
if (RAW_KEY) {
    if (RAW_KEY.length === 64) {
        KEY = Buffer.from(RAW_KEY, 'hex');
        ENCRYPTION_ENABLED = true;
        console.log('[Encryption] Field-level encryption: ENABLED (AES-256-CBC)');
    } else {
        console.warn('[Encryption] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Encryption DISABLED.');
    }
} else {
    console.warn('[Encryption] ENCRYPTION_KEY not set. Sensitive field encryption is DISABLED.');
}

/**
 * Encrypts a plain-text string.
 * Returns the original value if encryption is disabled or value is empty.
 * @param {string|null|undefined} text
 * @returns {string|null|undefined}
 */
function encrypt(text) {
    if (!ENCRYPTION_ENABLED || !text) return text;
    if (text.startsWith('enc:')) return text; // Already encrypted, skip

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([
        cipher.update(String(text), 'utf8'),
        cipher.final()
    ]);
    return `enc:${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an encrypted string produced by encrypt().
 * Returns the original value unchanged if not encrypted (graceful fallback).
 * @param {string|null|undefined} text
 * @returns {string|null|undefined}
 */
function decrypt(text) {
    if (!text || !text.startsWith('enc:')) return text; // Not encrypted or empty

    try {
        const parts = text.split(':');
        if (parts.length !== 3) return text; // Malformed, return as-is

        const iv = Buffer.from(parts[1], 'hex');
        const encryptedData = Buffer.from(parts[2], 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        const decrypted = Buffer.concat([
            decipher.update(encryptedData),
            decipher.final()
        ]);
        return decrypted.toString('utf8');
    } catch (err) {
        console.error('[Encryption] Decryption failed:', err.message);
        return text; // Return raw value on failure rather than crash
    }
}

module.exports = { encrypt, decrypt, ENCRYPTION_ENABLED };
