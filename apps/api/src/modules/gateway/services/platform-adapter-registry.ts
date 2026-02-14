import { DifyAdapter } from "../adapters/dify.adapter.js";
import { UnsupportedPlatformAdapter } from "../adapters/unsupported.adapter.js";
import type { GatewayAppIntegrationConfig } from "./app-config.service.js";
import type { PlatformAdapter, SupportedPlatform } from "../types.js";

interface RegistryOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

class PlatformAdapterRegistry {
  constructor(private readonly options: RegistryOptions = {}) {}

  get(platform: SupportedPlatform, config: GatewayAppIntegrationConfig): PlatformAdapter {
    if (platform === "dify") {
      return new DifyAdapter(config, {
        fetchFn: this.options.fetchFn,
        timeoutMs: this.options.timeoutMs,
      });
    }

    return new UnsupportedPlatformAdapter(platform);
  }
}

export function createPlatformAdapterRegistry(options: RegistryOptions = {}): PlatformAdapterRegistry {
  return new PlatformAdapterRegistry(options);
}
