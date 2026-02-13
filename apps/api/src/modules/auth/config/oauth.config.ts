/**
 * OAuth2 Configuration for better-auth
 *
 * Extends better-auth with social providers for SSO
 */

import type { OAuthConfig } from "better-auth";
import { ssoConfigRepository } from "../sso/repositories/sso.repository";

/**
 * Dynamic OAuth provider configuration
 */
export interface DynamicOAuthProvider {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
}

/**
 * Get OAuth config for better-auth
 * Loads tenant-specific SSO configurations dynamically
 */
export async function getOAuthConfig(tenantId: string): Promise<Record<string, OAuthConfig>> {
  const configs = await ssoConfigRepository.findEnabledByTenant(tenantId);

  const oauthConfig: Record<string, OAuthConfig> = {};

  for (const config of configs) {
    switch (config.provider) {
      case "google":
        oauthConfig.google = {
          clientId: config.providerClientId,
          clientSecret: config.providerClientSecret,
          enabled: config.enabled,
        };
        break;

      case "microsoft":
        oauthConfig.microsoft = {
          clientId: config.providerClientId,
          clientSecret: config.providerClientSecret,
          enabled: config.enabled,
        };
        break;

      case "github":
        oauthConfig.github = {
          clientId: config.providerClientId,
          clientSecret: config.providerClientSecret,
          enabled: config.enabled,
        };
        break;

      case "gitlab":
        oauthConfig.gitlab = {
          clientId: config.providerClientId,
          clientSecret: config.providerClientSecret,
          enabled: config.enabled,
        };
        break;

      case "oidc":
        // Generic OIDC provider
        oauthConfig.oidc = {
          clientId: config.providerClientId,
          clientSecret: config.providerClientSecret,
          issuer: process.env.OIDC_ISSUER || "",
          enabled: config.enabled,
        };
        break;
    }
  }

  return oauthConfig;
}

/**
 * Get available OAuth providers for a tenant
 */
export async function getAvailableProviders(tenantId: string): Promise<string[]> {
  const configs = await ssoConfigRepository.findEnabledByTenant(tenantId);
  return configs.map((c) => c.provider);
}

/**
 * Validate OAuth provider
 */
export function isValidProvider(provider: string): boolean {
  const validProviders = ["google", "microsoft", "github", "gitlab", "oidc"];
  return validProviders.includes(provider);
}
