import type { FastifyInstance } from "fastify";
import { outputComplianceChecker } from "../services/output-compliance-checker.service.js";
import { piiDetector } from "../services/pii-detector.service.js";
import { createSecurityPolicyConfigService } from "../services/security-policy-config.service.js";
import {
  badRequest,
  getRequestDb,
  requireAdminRole,
  resolveActorRole,
  resolveActorUserId,
  resolveTenantId,
} from "./shared.js";

interface SecurityPolicyBody {
  authMethods?: {
    password?: boolean;
    phone?: boolean;
    google?: boolean;
    github?: boolean;
    wechat?: boolean;
    sso?: boolean;
  };
  mfaPolicy?: "required" | "optional" | "disabled";
  sso?: {
    provider?: "oidc" | "saml" | "cas";
    issuerUrl?: string;
    clientId?: string;
    metadataUrl?: string;
    enabled?: boolean;
  };
  promptInjection?: {
    enabled?: boolean;
    action?: "log" | "alert" | "block";
    customKeywords?: string[];
  };
  pii?: {
    enabled?: boolean;
    strategy?: "mask" | "hash" | "remove";
    fields?: Array<"phone" | "email" | "id_card" | "bank_card" | "credit_card">;
  };
  outputCompliance?: {
    enabled?: boolean;
    action?: "log" | "alert" | "block";
    categories?: Array<"violence" | "hate" | "adult" | "political_cn" | "self_harm">;
    customKeywords?: string[];
  };
  audit?: {
    retentionDays?: number;
  };
  breakglassReason?: string;
}

export async function registerAdminSecurityRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Querystring: { breakglassReason?: string };
  }>("/security/policies", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const actorUserId = resolveActorUserId(request);
    const actorRole = resolveActorRole(request);
    const breakglassReason = request.query.breakglassReason;

    if (!tenantId || !actorUserId) {
      return badRequest(reply, request.id, "x-tenant-id and x-user-id are required");
    }
    if (!requireAdminRole(reply, actorRole, breakglassReason)) {
      return;
    }

    const db = getRequestDb(request);
    if (!db) {
      return reply.status(503).send({
        error: {
          type: "service_unavailable",
          code: "database_unavailable",
          message: "Database context unavailable",
          trace_id: request.id,
        },
      });
    }

    const service = createSecurityPolicyConfigService(db as any);
    const policy = await service.getPolicy(tenantId);
    return reply.status(200).send({
      data: policy,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.put<{
    Body: SecurityPolicyBody;
  }>("/security/policies", async (request, reply) => {
    const tenantId = resolveTenantId(request);
    const actorUserId = resolveActorUserId(request);
    const actorRole = resolveActorRole(request);
    const breakglassReason = request.body?.breakglassReason;

    if (!tenantId || !actorUserId) {
      return badRequest(reply, request.id, "x-tenant-id and x-user-id are required");
    }
    if (!requireAdminRole(reply, actorRole, breakglassReason)) {
      return;
    }

    const db = getRequestDb(request);
    if (!db) {
      return reply.status(503).send({
        error: {
          type: "service_unavailable",
          code: "database_unavailable",
          message: "Database context unavailable",
          trace_id: request.id,
        },
      });
    }

    const service = createSecurityPolicyConfigService(db as any);
    const policy = await service.updatePolicy({
      tenantId,
      actorUserId,
      actorRole,
      traceId: request.id,
      patch: {
        authMethods: request.body.authMethods,
        mfaPolicy: request.body.mfaPolicy,
        sso: request.body.sso,
        promptInjection: request.body.promptInjection,
        pii: request.body.pii,
        outputCompliance: request.body.outputCompliance,
        audit: request.body.audit,
      },
    });

    return reply.status(200).send({
      data: policy,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.post<{
    Body: {
      text?: string;
      categories?: Array<"violence" | "hate" | "adult" | "political_cn" | "self_harm">;
      action?: "log" | "alert" | "block";
    };
  }>("/security/output/check", async (request, reply) => {
    const text = request.body?.text ?? "";
    if (!text.trim()) {
      return badRequest(reply, request.id, "text is required");
    }

    const result = outputComplianceChecker.check({
      text,
      policy: {
        enabled: true,
        categories: request.body.categories,
        action: request.body.action,
      },
    });

    return reply.status(200).send({
      data: result,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.post<{
    Body: {
      text?: string;
      fields?: Array<"phone" | "email" | "id_card" | "bank_card" | "credit_card">;
    };
  }>("/security/pii/detect", async (request, reply) => {
    const text = request.body?.text ?? "";
    if (!text.trim()) {
      return badRequest(reply, request.id, "text is required");
    }

    const result = piiDetector.detect({
      text,
      enabledTypes: request.body.fields,
    });

    return reply.status(200).send({
      data: result,
      meta: {
        traceId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
