/**
 * MFA Setup Form Component
 *
 * Form for enabling TOTP multi-factor authentication
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@agentifui/ui/Button";
import { Input } from "@agentifui/ui/Input";
import { Label } from "@agentifui/ui/Label";
import { Card, CardContent, CardHeader, CardTitle } from "@agentifui/ui/Card";

/**
 * MFA setup props
 */
export interface MFASetupFormProps {
  /**
   * QR code URL
   */
  qrCode: string;
  /**
   * Secret key (for manual entry)
   */
  secret: string;
  /**
   * Backup codes
   */
  backupCodes: string[];
  /**
   * Submit handler (verify TOTP code)
   */
  onVerify: (code: string) => Promise<void>;
  /**
   * Is loading
   */
  isLoading?: boolean;
}

/**
 * MFASetupForm component
 */
export function MFASetupForm({
  qrCode,
  secret,
  backupCodes,
  onVerify,
  isLoading = false,
}: MFASetupFormProps) {
  const t = useTranslations("mfa.setup");

  const [code, setCode] = React.useState("");
  const [step, setStep] = React.useState<"setup" | "backup">("setup");
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Handle verify
   */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code || code.length !== 6) {
      setError(t("errors.invalidCode"));
      return;
    }

    try {
      await onVerify(code);
      setStep("backup");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.verifyFailed"));
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {step === "setup" ? (
          <>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {t("instructions")}
              </p>

              {/* QR Code */}
              <div className="inline-block p-4 bg-white rounded-lg border">
                {/* In real implementation, use a QR code library */}
                <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`} alt="QR Code" />
                </div>
              </div>

              {/* Manual entry */}
              <details className="mt-4 text-left">
                <summary className="text-sm text-muted-foreground cursor-pointer">
                  {t("manualEntry")}
                </summary>
                <div className="mt-2 p-3 bg-muted rounded text-xs font-mono break-all">
                  {secret}
                </div>
              </details>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              {/* Error */}
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
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
                  placeholder={t("fields.code.placeholder")}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setError(null);
                  }}
                  error={!!error}
                  disabled={isLoading}
                  maxLength={6}
                  pattern="\d{6}"
                  autoComplete="one-time-code"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("actions.verifying") : t("actions.verify")}
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">{t("success.title")}</h3>
              <p className="text-sm text-muted-foreground">{t("success.message")}</p>
            </div>

            {/* Backup codes */}
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">{t("backupCodes.title")}</h4>
              <p className="text-xs text-muted-foreground mb-3">{t("backupCodes.description")}</p>
              <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                {backupCodes.map((code, i) => (
                  <div key={i} className="p-2 bg-background rounded">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={() => window.print()} variant="outline" className="w-full">
              {t("actions.saveCodes")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
