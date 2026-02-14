import { GatewayError } from "../errors.js";
import type {
  GatewayChatRequestInput,
  PlatformAdapter,
  SupportedPlatform,
} from "../types.js";

export class UnsupportedPlatformAdapter implements PlatformAdapter {
  public readonly platform: SupportedPlatform;

  constructor(platform: SupportedPlatform) {
    this.platform = platform;
  }

  private createNotImplementedError(): GatewayError {
    return new GatewayError({
      statusCode: 503,
      type: "service_unavailable",
      code: "service_degraded",
      message: `${this.platform} adapter is not available in v1.0`,
      degraded: true,
    });
  }

  async sendMessage(_input: GatewayChatRequestInput) {
    throw this.createNotImplementedError();
  }

  async *streamMessage(_input: GatewayChatRequestInput) {
    throw this.createNotImplementedError();
    // Keep generator shape for interface compatibility.
    yield {
      finishReason: "stop",
    } as never;
  }

  async stopGeneration(_taskId: string, _input: GatewayChatRequestInput) {
    return { stopType: "soft" as const };
  }

  async getConversation(_conversationId: string, _input: GatewayChatRequestInput) {
    return {
      id: "",
      exists: false,
    };
  }
}
