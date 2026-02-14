import type { AccessibleAppItemDto, AppWorkbenchView } from "@agentifui/shared/apps";
import type { CitationPayloadDto, RunDetailDto, RunSummaryDto } from "@agentifui/shared/execution";

export type WorkbenchView = AppWorkbenchView;
export type AccessibleApp = AccessibleAppItemDto;

export type AppsCategory = "all" | "chat" | "workflow" | "agent";

export interface AccessibleAppsResponsePayload {
  data?: {
    items?: AccessibleApp[];
    apps?: AccessibleApp[];
    nextCursor?: string | null;
  };
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
  error?: {
    code?: string;
    message?: string;
  };
}

export type CitationPayload = CitationPayloadDto;
export type RunSummary = RunSummaryDto;
export type RunDetail = RunDetailDto;

export interface RunsResponsePayload {
  data?: {
    items?: RunSummary[];
  };
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface RunDetailResponsePayload {
  data?: RunDetail;
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
  error?: {
    code?: string;
    message?: string;
  };
}
