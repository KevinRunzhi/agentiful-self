/**
 * Shared DTOs for S1-3 app workbench.
 */

export type AppWorkbenchView = "all" | "recent" | "favorites";

export type AppMode = "chat" | "workflow" | "agent" | "completion";

export interface AppGroupContextDto {
  groupId: string;
  groupName: string;
  hasAccess: boolean;
}

export interface AccessibleAppsQueryDto {
  view?: AppWorkbenchView;
  q?: string;
  category?: string;
  limit?: number;
  cursor?: string;
}

export interface AccessibleAppItemDto {
  id: string;
  name: string;
  description: string | null;
  mode: AppMode;
  icon: string | null;
  iconType?: string | null;
  tags: string[];
  isFeatured?: boolean;
  sortOrder?: number;
  isFavorite: boolean;
  lastUsedAt: string | null;
  currentGroup?: AppGroupContextDto;
  availableGroups: AppGroupContextDto[];
  requiresSwitch: boolean;
}

export interface AccessibleAppsResponseDto {
  items: AccessibleAppItemDto[];
  nextCursor: string | null;
}

export interface AppContextOptionsResponseDto {
  currentGroup?: AppGroupContextDto;
  availableGroups: AppGroupContextDto[];
}

export interface ToggleFavoriteDto {
  appId: string;
}

export interface MarkRecentUseDto {
  appId: string;
}
