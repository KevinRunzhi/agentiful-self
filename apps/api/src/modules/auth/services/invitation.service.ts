/**
 * Invitation Service
 *
 * Handles invitation token generation, validation, and user creation
 */

import { randomBytes } from "crypto";
import { userRepository } from "../repositories/user.repository.js";
import { tenantRepository } from "../repositories/tenant.repository.js";
import { invitationRepository } from "../repositories/invitation.repository.js";
import { invitation } from "@agentifui/db/schema";
import { hashPassword } from "./password.service.js";
import type { TenantConfig } from "@agentifui/shared/types";
import type { Role } from "@agentifui/db/schema";
import { InvitationStatus } from "@agentifui/db/schema";

/**
 * Invitation token options
 */
interface InvitationOptions {
  tenantId: string;
  email: string;
  role: Role;
  groupId?: string;
  expiresIn?: number; // days
  createdBy: string;
}

/**
 * Generated invitation token result
 */
export interface GeneratedInvitation {
  token: string;
  expiresAt: Date;
  inviteLink: string;
}

/**
 * Create invitation result
 */
export interface CreateInvitationResult {
  invitationId: string;
  token: string;
  expiresAt: Date;
  inviteLink: string;
}

/**
 * Generate invitation token
 */
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Calculate expiration date
 */
function calculateExpiration(days: number = 7): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Create invitation
 */
export async function createInvitation(
  options: InvitationOptions
): Promise<CreateInvitationResult> {
  const { tenantId, email, role, groupId, expiresIn, createdBy } = options;

  // Verify tenant exists
  const tenant = await tenantRepository.findById(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Check if user already exists
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    // Check if user already has role in this tenant
    // TODO: Add user role check
  }

  // Generate token
  const token = generateToken();
  const expiresAt = calculateExpiration(expiresIn || 7);

  // Create invitation
  const newInvitation = await invitationRepository.create({
    tenantId,
    email,
    role,
    groupId,
    expiresAt,
    status: InvitationStatus.PENDING,
    createdBy,
  });

  // Generate invite link
  const inviteLink = `${process.env.WEB_URL || "http://localhost:3000"}/invite/${token}`;

  return {
    invitationId: newInvitation.id,
    token,
    expiresAt,
    inviteLink,
  };
}

/**
 * Validate invitation token
 */
export async function validateInvitationToken(token: string): Promise<{
  valid: boolean;
  invitation?: any;
  error?: string;
}> {
  const invitationRecord = await invitationRepository.findByToken(token);

  if (!invitationRecord) {
    return { valid: false, error: "Invitation not found or expired" };
  }

  if (invitationRecord.status !== InvitationStatus.PENDING) {
    if (invitationRecord.status === InvitationStatus.USED) {
      return { valid: false, error: "Invitation has already been used" };
    }
    if (invitationRecord.status === InvitationStatus.EXPIRED) {
      return { valid: false, error: "Invitation has expired" };
    }
    if (invitationRecord.status === InvitationStatus.REVOKED) {
      return { valid: false, error: "Invitation has been revoked" };
    }
  }

  // Check expiration
  if (new Date() > invitationRecord.expiresAt) {
    await invitationRepository.updateStatus(invitationRecord.id, InvitationStatus.EXPIRED);
    return { valid: false, error: "Invitation has expired" };
  }

  // Get tenant details
  const tenant = await tenantRepository.findById(invitationRecord.tenantId);
  if (!tenant || tenant.status !== "active") {
    return { valid: false, error: "Tenant is not active" };
  }

  return {
    valid: true,
    invitation: {
      ...invitationRecord,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
    },
  };
}

/**
 * Accept invitation and create user account
 */
export async function acceptInvitation(
  token: string,
  password: string,
  name: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  // Validate invitation
  const validation = await validateInvitationToken(token);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const { invitation } = validation;

  // Check if user already exists
  let user = await userRepository.findByEmail(invitation.email);

  if (!user) {
    // Hash password
    const { hash, valid, errors } = await hashPassword(password);
    if (!valid) {
      return { success: false, error: errors.join(", ") };
    }

    // Create user
    user = await userRepository.create({
      email: invitation.email,
      name,
      status: "active", // Invited users are auto-activated
      emailVerified: true,
    });
  }

  // TODO: Create user role in tenant
  // TODO: Mark invitation as used
  await invitationRepository.markAsUsed(invitation.id);

  return { success: true, userId: user.id };
}

/**
 * Revoke invitation
 */
export async function revokeInvitation(invitationId: string): Promise<boolean> {
  return await invitationRepository.revoke(invitationId);
}

/**
 * Clean up expired invitations
 */
export async function cleanupExpiredInvitations(): Promise<number> {
  return await invitationRepository.markExpired();
}

/**
 * Get pending invitations by tenant
 */
export async function getPendingInvitations(tenantId: string) {
  return await invitationRepository.findPendingByTenant(tenantId);
}

/**
 * Resend invitation (create new token for same email/tenant)
 */
export async function resendInvitation(
  originalInvitationId: string
): Promise<CreateInvitationResult | null> {
  // Get original invitation
  const db = await import("@agentifui/db/client").then(m => m.getDatabase());
  const { invitation } = await import("@agentifui/db/schema");

  const [original] = await db
    .select()
    .from(invitation)
    .where(eq(invitation.id, originalInvitationId))
    .limit(1);

  if (!original) {
    return null;
  }

  // Create new invitation with same details
  return createInvitation({
    tenantId: original.tenantId,
    email: original.email,
    role: original.role,
    groupId: original.groupId || undefined,
    createdBy: original.createdBy || undefined,
  });
}

import { eq } from "drizzle-orm";
