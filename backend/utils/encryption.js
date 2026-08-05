/**
 * AES-256-CBC field-level encryption utility.
 *
 * Use this to encrypt sensitive PII stored in the database (e.g., aadhaar_number).
 *
 * Requirements:
 *   - Set ENCRYPTION_KEY in .env as a 64-character hex string (= 32 bytes for AES-256).
 *   - Generate a key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * New values are stored as "encv2:<iv_hex>:<authTag_hex>:<ciphertext_hex>" using
 * authenticated AES-256-GCM (tamper-evident). Legacy "enc:<iv>:<ct>" values
 * written by the older AES-256-CBC scheme are still decrypted for backward
 * compatibility. Plain values are returned unchanged if encryption is disabled
 * or if the value predates encryption (graceful fallback).
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const LEGACY_ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 12; // Recommended IV size for GCM

let KEY = null;
let ENCRYPTION_ENABLED = false;

const RAW_KEY = process.env.ENCRYPTION_KEY;
if (RAW_KEY) {
    if (RAW_KEY.length === 64) {
        KEY = Buffer.from(RAW_KEY, 'hex');
        ENCRYPTION_ENABLED = true;
        console.log('[Encryption] Field-level encryption: ENABLED (AES-256-GCM)');
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
    if (text.startsWith('enc:') || text.startsWith('encv2:')) return text; // Already encrypted, skip

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([
        cipher.update(String(text), 'utf8'),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return `encv2:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an encrypted string produced by encrypt().
 * Returns the original value unchanged if not encrypted (graceful fallback).
 * @param {string|null|undefined} text
 * @returns {string|null|undefined}
 */
function decrypt(text) {
    if (!text) return text;

    try {
        if (text.startsWith('encv2:')) {
            const parts = text.split(':');
            if (parts.length !== 4) return text; // Malformed, return as-is
            const iv = Buffer.from(parts[1], 'hex');
            const authTag = Buffer.from(parts[2], 'hex');
            const encryptedData = Buffer.from(parts[3], 'hex');
            const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
            decipher.setAuthTag(authTag);
            const decrypted = Buffer.concat([
                decipher.update(encryptedData),
                decipher.final()
            ]);
            return decrypted.toString('utf8');
        }

        if (text.startsWith('enc:')) {
            // Legacy AES-256-CBC values (no integrity tag).
            const parts = text.split(':');
            if (parts.length !== 3) return text; // Malformed, return as-is
            const iv = Buffer.from(parts[1], 'hex');
            const encryptedData = Buffer.from(parts[2], 'hex');
            const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, KEY, iv);
            const decrypted = Buffer.concat([
                decipher.update(encryptedData),
                decipher.final()
            ]);
            return decrypted.toString('utf8');
        }

        return text; // Not encrypted
    } catch (err) {
        console.error('[Encryption] Decryption failed:', err.message);
        return text; // Return raw value on failure rather than crash
    }
}

module.exports = { encrypt, decrypt, ENCRYPTION_ENABLED };
