/**
 * PendingUserBanner Component
 *
 * Banner shown to pending users who need approval
 */

"use client";

import * as React from "react";
import { Button } from "@agentifui/ui/Button";
import { Card, CardContent } from "@agentifui/ui/Card";

/**
 * PendingUserBanner props
 */
export interface PendingUserBannerProps {
  /**
   * User's email
   */
  email: string;
  /**
   * Tenant name
   */
  tenantName?: string;
}

/**
 * PendingUserBanner component
 */
export function PendingUserBanner({ email, tenantName }: PendingUserBannerProps) {
  return (
    <Card className="border-yellow-500/50 bg-yellow-500/10">
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
              Account Pending Approval
            </h3>
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
              Your account is waiting for administrator approval. You'll receive an email
              when your account has been activated.
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
              Signed in as <strong>{email}</strong>
              {tenantName && <> in <strong>{tenantName}</strong></>}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
