export type SupportedPlatform = "dify" | "coze" | "n8n";

export interface GatewayChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface GatewayUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GatewayChatRequestInput {
  tenantId: string;
  userId: string;
  appId: string;
  model: string;
  messages: GatewayChatMessage[];
  tools?: unknown[];
  temperature?: number;
  maxTokens?: number;
  traceId: string;
  traceparent: string;
  conversationId: string;
  externalConversationId?: string | null;
  activeGroupId?: string | null;
  signal?: AbortSignal;
}

export interface GatewayCompletionResult {
  id: string;
  content: string;
  created: number;
  model: string;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter";
  usage: GatewayUsage;
  externalConversationId?: string;
  externalRunId?: string;
}

export interface GatewayStreamChunk {
  id?: string;
  delta?: string;
  finishReason?: "stop" | "length" | "tool_calls" | "content_filter";
  usage?: GatewayUsage;
  externalConversationId?: string;
  externalRunId?: string;
}

export interface PlatformAdapter {
  platform: SupportedPlatform;
  sendMessage(input: GatewayChatRequestInput): Promise<GatewayCompletionResult>;
  streamMessage(input: GatewayChatRequestInput): AsyncGenerator<GatewayStreamChunk>;
  stopGeneration(taskId: string, input: GatewayChatRequestInput): Promise<{ stopType: "hard" | "soft" }>;
  getConversation(
    conversationId: string,
    input: GatewayChatRequestInput
  ): Promise<{ id: string; exists: boolean }>;
}
