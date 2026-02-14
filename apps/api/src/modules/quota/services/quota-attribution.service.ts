/**
 * Quota Attribution Service
 *
 * Resolves effective group attribution for quota operations.
 */

import type { QuotaRepository } from "../repositories/quota.repository";

export interface ResolveQuotaAttributionInput {
  tenantId: string;
  userId: string;
  appId?: string | null;
  requestedGroupId?: string | null;
}

export interface ResolveQuotaAttributionResult {
  groupId: string | null;
  source: "requested" | "default" | "direct" | "none";
}

export class InvalidActiveGroupError extends Error {
  constructor(message = "Provided active group is not valid for this user and tenant") {
    super(message);
    this.name = "InvalidActiveGroupError";
  }
}

export async function resolveQuotaAttributionGroupId(
  quotaRepository: QuotaRepository,
  input: ResolveQuotaAttributionInput
): Promise<ResolveQuotaAttributionResult> {
  const normalizedAppId =
    typeof input.appId === "string" && input.appId.trim().length > 0
      ? input.appId.trim()
      : null;

  if (normalizedAppId) {
    const directPermission = await quotaRepository.getUserAppGrantPermission(
      input.userId,
      normalizedAppId
    );

    if (directPermission === "deny") {
      throw new InvalidActiveGroupError("User is explicitly denied for this app");
    }

    if (input.requestedGroupId) {
      const hasMembership = await quotaRepository.hasActiveGroupMembership(
        input.tenantId,
        input.userId,
        input.requestedGroupId
      );

      if (!hasMembership) {
        throw new InvalidActiveGroupError();
      }

      const hasGroupGrant = await quotaRepository.hasGroupAppGrant(
        input.requestedGroupId,
        normalizedAppId
      );
      if (!hasGroupGrant) {
        throw new InvalidActiveGroupError(
          "Provided active group does not grant access to the target app"
        );
      }

      return {
        groupId: input.requestedGroupId,
        source: "requested",
      };
    }

    if (directPermission === "use") {
      return {
        groupId: null,
        source: "direct",
      };
    }

    const appDefaultGroup = await quotaRepository.findDefaultGroupIdForApp(
      input.tenantId,
      input.userId,
      normalizedAppId
    );

    if (appDefaultGroup) {
      return {
        groupId: appDefaultGroup,
        source: "default",
      };
    }

    return {
      groupId: null,
      source: "none",
    };
  }

  if (input.requestedGroupId) {
    const hasMembership = await quotaRepository.hasActiveGroupMembership(
      input.tenantId,
      input.userId,
      input.requestedGroupId
    );

    if (!hasMembership) {
      throw new InvalidActiveGroupError();
    }

    return {
      groupId: input.requestedGroupId,
      source: "requested",
    };
  }

  const defaultGroupId = await quotaRepository.findDefaultGroupId(
    input.tenantId,
    input.userId
  );

  if (defaultGroupId) {
    return {
      groupId: defaultGroupId,
      source: "default",
    };
  }

  return {
    groupId: null,
    source: "none",
  };
}
