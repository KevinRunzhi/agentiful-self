/**
 * MFA Service
 *
 * TOTP multi-factor authentication using otplib
 */

import { authenticator } from "otplib";
import crypto from "crypto";

/**
 * TOTP setup result
 */
export interface TOTPSetupResult {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * Verify result
 */
export interface VerifyResult {
  success: boolean;
  error?: string;
}

/**
 * Encryption key (should be from env)
 */
const ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

/**
 * Encrypt secret
 */
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt secret
 */
function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Generate backup codes
 */
function generateBackupCodes(count = 10): string[] {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
  }
  return codes;
}

/**
 * Hash backup code
 */
function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Create TOTP setup for user
 */
export async function createTOTPSetup(userId: string): Promise<TOTPSetupResult> {
  // Generate random secret
  const secret = authenticator.generateSecret();

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);

  // Create QR code URL
  const issuer = process.env.APP_NAME || "Agentiful";
  const qrCode = authenticator.keyuri(userId, issuer, secret);

  return {
    secret,
    qrCode,
    backupCodes,
  };
}

/**
 * Verify TOTP token
 */
export async function verifyTOTP(
  userId: string,
  token: string,
  storedSecret: string
): Promise<VerifyResult> {
  const secret = decrypt(storedSecret);

  const isValid = authenticator.verify({
    token,
    secret,
    window: 2, // Allow 2 time steps (60 seconds) for clock skew
  });

  if (!isValid) {
    return { success: false, error: "Invalid code" };
  }

  return { success: true };
}

/**
 * Generate backup codes (hash them for storage)
 */
export function generateBackupCodesForStorage(codes: string[]): string[] {
  return codes.map(hashBackupCode);
}

/**
 * Verify backup code
 */
export function verifyBackupCode(
  storedCodes: string[] | null,
  providedCode: string
): boolean {
  if (!storedCodes) return false;

  const hashed = hashBackupCode(providedCode);
  return storedCodes.includes(hashed);
}

/**
 * Remove used backup code
 */
export function removeBackupCode(
  storedCodes: string[],
  usedCode: string
): string[] {
  const hashed = hashBackupCode(usedCode);
  return storedCodes.filter((c) => c !== hashed);
}
