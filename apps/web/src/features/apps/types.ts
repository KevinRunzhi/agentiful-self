import type { AccessibleAppItemDto, AppWorkbenchView } from "@agentifui/shared/apps";

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
