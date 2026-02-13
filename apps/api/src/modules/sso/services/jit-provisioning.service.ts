/**
 * JIT (Just-In-Time) User Provisioning Service
 *
 * Automatically creates user accounts on first SSO login
 */

import { userRepository } from "../../auth/repositories/user.repository";
import { userRoleRepository } from "../../auth/repositories/user-role.repository";
import { tenantRepository } from "../../auth/repositories/tenant.repository";
import type { NewUser, NewUserRole } from "@agentifui/db/schema";

/**
 * SSO user profile data from OAuth provider
 */
export interface SSOUserProfile {
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
  locale?: string;
}

/**
 * JIT provisioning result
 */
export interface JITProvisioningResult {
  success: boolean;
  user?: { id: string; email: string; name: string };
  isNewUser: boolean;
  activated: boolean;
  error?: string;
}

/**
 * Default attribute mapping for OAuth providers
 */
const DEFAULT_ATTRIBUTE_MAPPING: Record<string, Record<string, string>> = {
  google: {
    email: "email",
    name: "name",
    picture: "picture",
    locale: "locale",
  },
  microsoft: {
    email: "mail",
    name: "displayName",
    picture: "photo",
    locale: "preferredLanguage",
  },
  github: {
    email: "email",
    name: "name",
    picture: "avatar_url",
    locale: "language",
  },
  gitlab: {
    email: "email",
    name: "name",
    picture: "avatar_url",
    locale: "language",
  },
};

/**
 * Provision or update user from SSO profile
 */
export async function provisionUserFromSSO(
  profile: SSOUserProfile,
  tenantId: string,
  configId: string,
  options: {
    autoActivate: boolean;
    defaultRole: string;
    attributeMapping?: Record<string, string>;
  }
): Promise<JITProvisioningResult> {
  try {
    // Check if user already exists by email
    let user = await userRepository.findByEmail(profile.email);

    if (user) {
      // User exists, update profile if needed
      const needsUpdate =
        !user.name && profile.name;

      if (needsUpdate) {
        user = await userRepository.update(user.id, {
          name: profile.name || user.name,
        });
      }

      // Check if user has role in this tenant
      const existingRole = await userRoleRepository.findByUserAndTenant(user.id, tenantId);

      if (!existingRole) {
        // Add role for this tenant
        await userRoleRepository.create({
          userId: user.id,
          tenantId,
          role: options.defaultRole,
        } as NewUserRole);
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        isNewUser: false,
        activated: user.status === "active",
      };
    }

    // Create new user
    const userData: NewUser = {
      email: profile.email,
      name: profile.name,
      status: options.autoActivate ? "active" : "pending",
      emailVerified: profile.emailVerified ?? true,
    };

    const newUser = await userRepository.create(userData);

    // Create user role for the tenant
    await userRoleRepository.create({
      userId: newUser.id,
      tenantId,
      role: options.defaultRole,
    } as NewUserRole);

    return {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
      isNewUser: true,
      activated: options.autoActivate,
    };
  } catch (error) {
    return {
      success: false,
      isNewUser: false,
      activated: false,
      error: error instanceof Error ? error.message : "JIT provisioning failed",
    };
  }
}

/**
 * Map attributes from SSO provider response using custom mapping
 */
export function mapSSOAttributes(
  provider: string,
  providerData: Record<string, unknown>,
  customMapping?: Record<string, string>
): SSOUserProfile {
  // Use custom mapping if provided, otherwise use default
  const mapping = customMapping || DEFAULT_ATTRIBUTE_MAPPING[provider] || DEFAULT_ATTRIBUTE_MAPPING.google;

  const profile: SSOUserProfile = {
    email: String(providerData[mapping.email] || providerData["email"] || ""),
    name: String(providerData[mapping.name] || providerData["name"] || ""),
  };

  if (mapping.picture && providerData[mapping.picture]) {
    profile.picture = String(providerData[mapping.picture]);
  }

  if (mapping.locale && providerData[mapping.locale]) {
    profile.locale = String(providerData[mapping.locale]);
  }

  if (providerData["email_verified"] !== undefined) {
    profile.emailVerified = Boolean(providerData["email_verified"]);
  }

  return profile;
}
