import { createDecipheriv } from "node:crypto";
import { GatewayError } from "../errors.js";

export interface GatewayAppIntegrationConfig {
  baseUrl: string;
  apiKey: string;
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function resolveEncryptionKey(): Buffer | null {
  const raw = process.env.APP_CONFIG_ENCRYPTION_KEY;
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    const decoded = Buffer.from(trimmed, "base64");
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    return null;
  }

  return null;
}

function decryptApiKeyIfNeeded(value: string): string {
  if (!value.startsWith("enc:v1:")) {
    return value;
  }

  const key = resolveEncryptionKey();
  if (!key) {
    throw new GatewayError({
      statusCode: 502,
      type: "server_error",
      code: "upstream_credentials_invalid",
      message: "Encrypted app credential cannot be decrypted",
    });
  }

  const parts = value.split(":");
  if (parts.length !== 5) {
    throw new GatewayError({
      statusCode: 502,
      type: "server_error",
      code: "upstream_credentials_invalid",
      message: "Encrypted app credential format is invalid",
    });
  }

  const iv = Buffer.from(parts[2] || "", "base64");
  const tag = Buffer.from(parts[3] || "", "base64");
  const encrypted = Buffer.from(parts[4] || "", "base64");

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new GatewayError({
      statusCode: 502,
      type: "server_error",
      code: "upstream_credentials_invalid",
      message: "Encrypted app credential decryption failed",
    });
  }
}

export function resolveGatewayAppIntegrationConfig(rawConfig: unknown): GatewayAppIntegrationConfig {
  const config = normalizeRecord(rawConfig);
  const baseUrl = normalizeString(config.baseUrl);
  const apiKeyValue = normalizeString(config.apiKey);

  if (!baseUrl) {
    throw new GatewayError({
      statusCode: 502,
      type: "server_error",
      code: "upstream_config_missing",
      message: "App integration baseUrl is missing",
    });
  }

  if (!apiKeyValue) {
    throw new GatewayError({
      statusCode: 502,
      type: "server_error",
      code: "upstream_credentials_missing",
      message: "App integration apiKey is missing",
    });
  }

  const apiKey = decryptApiKeyIfNeeded(apiKeyValue);

  return {
    baseUrl,
    apiKey,
  };
}
