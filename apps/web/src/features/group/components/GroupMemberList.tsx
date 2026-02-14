/**
 * GroupMemberList Component
 *
 * List of group members with role display and actions
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@agentifui/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@agentifui/ui/Card";

/**
 * Group member
 */
export interface GroupMember {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  addedAt: string;
}

/**
 * GroupMemberList props
 */
export interface GroupMemberListProps {
  /**
   * List of members
   */
  members: GroupMember[];
  /**
   * Is loading
   */
  isLoading?: boolean;
  /**
   * Can manage members (edit/remove)
   */
  canManage?: boolean;
  /**
   * Remove member handler
   */
  onRemove?: (memberId: string) => void;
  /**
   * Update role handler
   */
  onUpdateRole?: (memberId: string, role: string) => void;
}

/**
 * Role badge color
 */
function getRoleBadgeClass(role: string): string {
  switch (role) {
    case "admin":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
    case "manager":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    default:
      return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20";
  }
}

/**
 * GroupMemberList component
 */
export function GroupMemberList({
  members,
  isLoading = false,
  canManage = false,
  onRemove,
  onUpdateRole,
}: GroupMemberListProps) {
  const t = useTranslations("groups.members");

  const [removingId, setRemovingId] = React.useState<string | null>(null);

  /**
   * Handle remove member
   */
  const handleRemove = async (memberId: string) => {
    if (!confirm(t("confirmRemove"))) {
      return;
    }

    setRemovingId(memberId);
    try {
      await onRemove?.(memberId);
    } finally {
      setRemovingId(null);
    }
  };

  /**
   * Handle role change
   */
  const handleRoleChange = async (memberId: string, newRole: string) => {
    await onUpdateRole?.(memberId, newRole);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-32" />
                  <div className="h-3 bg-muted rounded animate-pulse w-48" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("title")} ({members.length})
        </CardTitle>
      </CardHeader>

      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {member.userName.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Member info */}
                  <div>
                    <p className="font-medium">{member.userName}</p>
                    <p className="text-sm text-muted-foreground">{member.userEmail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Role badge */}
                  <span
                    className={`px-2 py-1 rounded-md text-xs font-medium border ${getRoleBadgeClass(
                      member.role
                    )}`}
                  >
                    {t.has(`roles.${member.role}`) ? t(`roles.${member.role}`) : member.role}
                  </span>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex items-center gap-1">
                      {/* Role selector */}
                      {onUpdateRole && (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className="h-8 px-2 rounded text-sm border bg-background"
                          disabled={removingId === member.id}
                        >
                          <option value="member">{t(`roles.member`)}</option>
                          <option value="manager">{t(`roles.manager`)}</option>
                          <option value="admin">{t(`roles.admin`)}</option>
                        </select>
                      )}

                      {/* Remove button */}
                      {onRemove && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemove(member.id)}
                          disabled={removingId === member.id}
                          className="h-8 px-2 text-destructive hover:text-destructive"
                        >
                          {removingId === member.id ? (
                            <span className="animate-spin">⟳</span>
                          ) : (
                            t("actions.remove")
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
