type GatewayErrorType =
  | "invalid_request_error"
  | "authentication_error"
  | "permission_denied"
  | "not_found_error"
  | "rate_limit_error"
  | "service_unavailable"
  | "server_error"
  | "internal_error";

export class GatewayError extends Error {
  public readonly statusCode: number;
  public readonly type: GatewayErrorType;
  public readonly code: string;
  public readonly param?: string;
  public readonly degraded: boolean;

  constructor(input: {
    statusCode: number;
    type: GatewayErrorType;
    code: string;
    message: string;
    param?: string;
    degraded?: boolean;
  }) {
    super(input.message);
    this.name = "GatewayError";
    this.statusCode = input.statusCode;
    this.type = input.type;
    this.code = input.code;
    this.param = input.param;
    this.degraded = input.degraded ?? false;
  }
}

export class UpstreamTimeoutError extends Error {
  constructor(message = "Upstream request timed out") {
    super(message);
    this.name = "UpstreamTimeoutError";
  }
}

export class UpstreamResponseError extends Error {
  public readonly statusCode: number;
  public readonly upstreamCode?: string;

  constructor(message: string, statusCode = 502, upstreamCode?: string) {
    super(message);
    this.name = "UpstreamResponseError";
    this.statusCode = statusCode;
    this.upstreamCode = upstreamCode;
  }
}

export class ServiceDegradedError extends Error {
  constructor(message = "Service is degraded") {
    super(message);
    this.name = "ServiceDegradedError";
  }
}

export function toGatewayError(error: unknown): GatewayError {
  if (error instanceof GatewayError) {
    return error;
  }

  if (error instanceof UpstreamTimeoutError) {
    return new GatewayError({
      statusCode: 504,
      type: "server_error",
      code: "timeout",
      message: error.message,
    });
  }

  if (error instanceof UpstreamResponseError) {
    return new GatewayError({
      statusCode: 502,
      type: "server_error",
      code: "upstream_error",
      message: error.message,
    });
  }

  if (error instanceof ServiceDegradedError) {
    return new GatewayError({
      statusCode: 503,
      type: "service_unavailable",
      code: "service_degraded",
      message: error.message,
      degraded: true,
    });
  }

  const message = error instanceof Error ? error.message : "Internal gateway error";
  return new GatewayError({
    statusCode: 500,
    type: "internal_error",
    code: "internal_error",
    message,
  });
}

export function buildGatewayErrorResponse(error: GatewayError, traceId: string): {
  error: {
    message: string;
    type: string;
    code: string;
    param?: string;
  };
  traceId: string;
  degraded: boolean;
} {
  const payload = {
    error: {
      message: error.message,
      type: error.type,
      code: error.code,
      ...(error.param ? { param: error.param } : {}),
    },
    traceId,
    degraded: error.degraded,
  };

  return payload;
}
