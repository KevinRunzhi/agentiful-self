/**
 * UserApprovalList Component
 *
 * List of pending users for admin approval
 */

"use client";

import * as React from "react";
import { Button } from "@agentifui/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@agentifui/ui/Card";
import { CheckIcon, XIcon } from "lucide-react";

/**
 * Pending user in approval queue
 */
export interface PendingUser {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  createdAt: string;
}

/**
 * UserApprovalList props
 */
export interface UserApprovalListProps {
  /**
   * Pending users
   */
  users: PendingUser[];
  /**
   * Is loading
   */
  isLoading?: boolean;
  /**
   * Approve handler
   */
  onApprove: (userId: string) => Promise<void>;
  /**
   * Reject handler
   */
  onReject: (userId: string, reason?: string) => Promise<void>;
}

/**
 * UserApprovalList component
 */
export function UserApprovalList({
  users,
  isLoading = false,
  onApprove,
  onReject,
}: UserApprovalListProps) {
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  /**
   * Handle approve
   */
  const handleApprove = async (userId: string) => {
    setProcessingId(userId);
    try {
      await onApprove(userId);
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Handle reject
   */
  const handleReject = async (userId: string) => {
    const reason = prompt("Enter rejection reason (optional):");
    if (reason === null) return; // Cancelled

    setProcessingId(userId);
    try {
      await onReject(userId, reason || undefined);
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground">No pending users to approve.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Pending Approvals ({users.length})
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.userId}
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {user.userName.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* User info */}
                <div>
                  <p className="font-medium">{user.userName}</p>
                  <p className="text-sm text-muted-foreground">{user.userEmail}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Role: {user.role} • Requested {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleApprove(user.userId)}
                  disabled={processingId === user.userId}
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  {processingId === user.userId ? (
                    <span className="animate-spin">⟳</span>
                  ) : (
                    <>
                      <CheckIcon className="w-4 h-4 mr-1" />
                      Approve
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleReject(user.userId)}
                  disabled={processingId === user.userId}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {processingId === user.userId ? (
                    <span className="animate-spin">⟳</span>
                  ) : (
                    <>
                      <XIcon className="w-4 h-4 mr-1" />
                      Reject
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
