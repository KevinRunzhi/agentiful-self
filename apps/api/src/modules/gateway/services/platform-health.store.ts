import type { SupportedPlatform } from "../types.js";

type CircuitState = "closed" | "open" | "half_open";
type PlatformStatus = "available" | "degraded" | "unavailable";

interface MutablePlatformState {
  platform: SupportedPlatform;
  circuitState: CircuitState;
  consecutiveFailures: number;
  timeoutFailuresWindow: number[];
  openedAtEpochMs: number | null;
  lastCheckedAt: string;
  lastFailureReason: string | null;
  lastFailureAt: string | null;
}

export interface PlatformHealthSnapshot {
  status: PlatformStatus;
  lastCheckedAt: string;
  reason?: string;
}

const FAILURE_THRESHOLD = 5;
const TIMEOUT_THRESHOLD = 3;
const TIMEOUT_WINDOW_MS = 30_000;
const OPEN_TO_HALF_OPEN_AFTER_MS = 60_000;

function nowIso(): string {
  return new Date().toISOString();
}

function createInitialState(platform: SupportedPlatform): MutablePlatformState {
  return {
    platform,
    circuitState: "closed",
    consecutiveFailures: 0,
    timeoutFailuresWindow: [],
    openedAtEpochMs: null,
    lastCheckedAt: nowIso(),
    lastFailureReason: null,
    lastFailureAt: null,
  };
}

export class PlatformHealthStore {
  private readonly states = new Map<SupportedPlatform, MutablePlatformState>();

  constructor(platforms: SupportedPlatform[] = ["dify", "coze", "n8n"]) {
    for (const platform of platforms) {
      this.states.set(platform, createInitialState(platform));
    }
  }

  shouldAllowRequest(platform: SupportedPlatform): boolean {
    const state = this.getState(platform);
    const now = Date.now();
    state.lastCheckedAt = nowIso();

    if (state.circuitState === "open") {
      if (state.openedAtEpochMs !== null && now - state.openedAtEpochMs >= OPEN_TO_HALF_OPEN_AFTER_MS) {
        state.circuitState = "half_open";
        return true;
      }
      return false;
    }

    return true;
  }

  recordSuccess(platform: SupportedPlatform): void {
    const state = this.getState(platform);
    state.circuitState = "closed";
    state.consecutiveFailures = 0;
    state.timeoutFailuresWindow = [];
    state.openedAtEpochMs = null;
    state.lastCheckedAt = nowIso();
    state.lastFailureReason = null;
    state.lastFailureAt = null;
  }

  recordFailure(platform: SupportedPlatform, input: { reason: string; timeout?: boolean }): void {
    const state = this.getState(platform);
    const now = Date.now();
    state.lastCheckedAt = nowIso();
    state.lastFailureReason = input.reason;
    state.lastFailureAt = state.lastCheckedAt;
    state.consecutiveFailures += 1;

    state.timeoutFailuresWindow = state.timeoutFailuresWindow.filter((timestamp) => now - timestamp <= TIMEOUT_WINDOW_MS);
    if (input.timeout) {
      state.timeoutFailuresWindow.push(now);
    }

    const timeoutTriggered = state.timeoutFailuresWindow.length >= TIMEOUT_THRESHOLD;
    const failureTriggered = state.consecutiveFailures >= FAILURE_THRESHOLD;
    if (timeoutTriggered || failureTriggered || state.circuitState === "half_open") {
      state.circuitState = "open";
      state.openedAtEpochMs = now;
    } else {
      state.circuitState = "closed";
    }
  }

  getSnapshot(platform: SupportedPlatform): PlatformHealthSnapshot {
    const state = this.getState(platform);
    const status = this.resolveStatus(state);
    return {
      status,
      lastCheckedAt: state.lastCheckedAt,
      ...(state.lastFailureReason ? { reason: state.lastFailureReason } : {}),
    };
  }

  listSnapshots(): Record<SupportedPlatform, PlatformHealthSnapshot> {
    const dify = this.getSnapshot("dify");
    const coze = this.getSnapshot("coze");
    const n8n = this.getSnapshot("n8n");
    return { dify, coze, n8n };
  }

  private getState(platform: SupportedPlatform): MutablePlatformState {
    const existing = this.states.get(platform);
    if (existing) {
      return existing;
    }

    const next = createInitialState(platform);
    this.states.set(platform, next);
    return next;
  }

  private resolveStatus(state: MutablePlatformState): PlatformStatus {
    if (state.circuitState === "open") {
      return "unavailable";
    }
    if (state.circuitState === "half_open") {
      return "degraded";
    }
    if (state.consecutiveFailures > 0) {
      return "degraded";
    }
    return "available";
  }
}

export const platformHealthStore = new PlatformHealthStore();
