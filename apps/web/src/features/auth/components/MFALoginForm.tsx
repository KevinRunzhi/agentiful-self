/**
 * MFA Login Form Component
 *
 * Form for entering TOTP code during login
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@agentifui/ui/Button";
import { Input } from "@agentifui/ui/Input";
import { Label } from "@agentifui/ui/Label";
import { Card, CardContent, CardHeader, CardTitle } from "@agentifui/ui/Card";

/**
 * MFALoginForm props
 */
export interface MFALoginFormProps {
  /**
   * Submit handler
   */
  onSubmit: (code: string) => Promise<void>;
  /**
   * Is loading
   */
  isLoading?: boolean;
  /**
   * Error message
   */
  error?: string | null;
}

/**
 * MFALoginForm component
 */
export function MFALoginForm({ onSubmit, isLoading = false, error }: MFALoginFormProps) {
  const t = useTranslations("mfa.login");

  const [code, setCode] = React.useState("");
  const [internalError, setInternalError] = React.useState<string | null>(null);

  const displayError = error || internalError;

  /**
   * Handle submit
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInternalError(null);

    if (!code || code.length !== 6) {
      setInternalError(t("errors.invalidCode"));
      return;
    }

    try {
      await onSubmit(code);
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : t("errors.verifyFailed"));
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error */}
          {displayError && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {displayError}
            </div>
          )}

          {/* Code input */}
          <div className="space-y-2">
            <Label htmlFor="code" required>
              {t("fields.code.label")}
            </Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              placeholder={t("fields.code.placeholder")}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setInternalError(null);
              }}
              error={displayError ?? undefined}
              disabled={isLoading}
              maxLength={6}
              pattern="\d{6}"
              autoComplete="one-time-code"
              autoFocus
              required
              className="text-center text-2xl tracking-widest"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t("actions.verifying") : t("actions.verify")}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <a href="/logout" className="text-sm text-muted-foreground hover:text-primary">
            {t("actions.back")}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
