/**
 * better-auth Configuration
 *
 * Main better-auth setup with Drizzle adapter
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDatabase } from "@agentifui/db/client";
import * as schema from "@agentifui/db/schema";

/**
 * better-auth instance
 */
export const auth = betterAuth({
  database: drizzleAdapter(getDatabase(), {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
    },
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  secret: process.env.BETTER_AUTH_SECRET || "change-this-secret-in-production",

  // Session configuration
  session: {
    expiresIn: {
      15: 15 * 60, // 15 minutes for access token
      7d: 7 * 24 * 60 * 60, // 7 days for refresh token
    },
    updateAge: 7 * 24 * 60 * 60, // 7 days
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Advanced session configuration with tenant context
  advanced: {
    session: {
      generateId: () => crypto.randomUUID(),
      cookiePrefix: "agentiful",
    },
  },

  // Account configuration
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },

  // Social providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: !!process.env.GITHUB_CLIENT_ID,
    },
  },

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      // TODO: Send reset password email
      console.log("Send reset password email to:", user.email, "url:", url);
    },
    sendVerificationEmail: async ({ user, url }) => {
      // TODO: Send verification email
      console.log("Send verification email to:", user.email, "url:", url);
    },
  },

  // Two-factor authentication
  twoFactor: {
    issuer: "Agentiful",
  },
});

/**
 * Auth API helper
 */
export const authApi = auth.api;
