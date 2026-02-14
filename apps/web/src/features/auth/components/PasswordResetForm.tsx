/**
 * PasswordResetForm Component
 *
 * Form for password reset (both request and reset with token)
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@agentifui/ui/Button";
import { Input } from "@agentifui/ui/Input";
import { Label } from "@agentifui/ui/Label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@agentifui/ui/Card";

/**
 * Reset request form data
 */
interface ResetRequestData {
  email: string;
  tenantSlug?: string;
}

/**
 * Password reset form data
 */
interface PasswordResetData {
  password: string;
  confirmPassword: string;
}

/**
 * Reset request form errors
 */
interface ResetRequestErrors {
  email?: string;
  general?: string;
}

/**
 * Password reset form errors
 */
interface PasswordResetErrors {
  password?: string;
  confirmPassword?: string;
  general?: string;
}

/**
 * PasswordResetForm props
 */
export interface PasswordResetFormProps {
  /**
   * Reset token (from URL) - if provided, shows reset form
   * Otherwise shows request form
   */
  token?: string;
}

/**
 * PasswordResetForm component
 */
export function PasswordResetForm({ token }: PasswordResetFormProps) {
  const router = useRouter();
  const t = useTranslations("auth.passwordReset");

  const [isRequestMode] = React.useState(!token);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Password visibility
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Reset request form state
  const [requestForm, setRequestForm] = React.useState<ResetRequestData>({
    email: "",
    tenantSlug: "",
  });
  const [requestErrors, setRequestErrors] = React.useState<ResetRequestErrors>({});

  // Password reset form state
  const [resetForm, setResetForm] = React.useState<PasswordResetData>({
    password: "",
    confirmPassword: "",
  });
  const [resetErrors, setResetErrors] = React.useState<PasswordResetErrors>({});

  /**
   * Validate email
   */
  const validateEmail = (): boolean => {
    const errors: ResetRequestErrors = {};

    if (!requestForm.email) {
      errors.email = t("errors.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestForm.email)) {
      errors.email = t("errors.emailInvalid");
    }

    setRequestErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Validate password
   */
  const validatePassword = (): boolean => {
    const errors: PasswordResetErrors = {};

    if (!resetForm.password) {
      errors.password = t("errors.passwordRequired");
    } else if (resetForm.password.length < 8) {
      errors.password = t("errors.passwordTooShort");
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(resetForm.password)) {
      errors.password = t("errors.passwordWeak");
    }

    if (!resetForm.confirmPassword) {
      errors.confirmPassword = t("errors.confirmPasswordRequired");
    } else if (resetForm.password !== resetForm.confirmPassword) {
      errors.confirmPassword = t("errors.passwordMismatch");
    }

    setResetErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle reset request submission
   */
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || t("errors.requestFailed"));
        return;
      }

      setIsSuccess(true);
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle password reset submission
   */
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validatePassword()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: resetForm.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || t("errors.resetFailed"));
        return;
      }

      setIsSuccess(true);

      // Redirect to login after delay
      setTimeout(() => {
        router.push("/login?reset=true");
      }, 2000);
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  // Success state for request form
  if (isRequestMode && isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-green-600">{t("request.success.title")}</CardTitle>
          <CardDescription>{t("request.success.description")}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <a href="/login">{t("request.success.backToLogin")}</a>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Success state for reset form
  if (!isRequestMode && isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-green-600">{t("reset.success.title")}</CardTitle>
          <CardDescription>{t("reset.success.description")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      {isRequestMode ? (
        <>
          {/* Reset request form */}
          <CardHeader>
            <CardTitle>{t("request.title")}</CardTitle>
            <CardDescription>{t("request.description")}</CardDescription>
          </CardHeader>

          <form onSubmit={handleRequestSubmit}>
            <CardContent className="space-y-4">
              {/* General error */}
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Email field */}
              <div className="space-y-2">
                <Label htmlFor="email">{t("request.fields.email.label")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("request.fields.email.placeholder")}
                  value={requestForm.email}
                  onChange={(e) => {
                    setRequestForm((prev) => ({ ...prev, email: e.target.value }));
                    setRequestErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  error={requestErrors.email}
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("request.submitting") : t("request.submit")}
              </Button>

              <a
                href="/login"
                className="text-sm text-muted-foreground hover:text-primary text-center"
              >
                {t("backToLogin")}
              </a>
            </CardFooter>
          </form>
        </>
      ) : (
        <>
          {/* Password reset form */}
          <CardHeader>
            <CardTitle>{t("reset.title")}</CardTitle>
            <CardDescription>{t("reset.description")}</CardDescription>
          </CardHeader>

          <form onSubmit={handleResetSubmit}>
            <CardContent className="space-y-4">
              {/* General error */}
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Password field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("reset.fields.password.label")}</Label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-sm text-primary hover:underline"
                  >
                    {showPassword ? t("actions.hidePassword") : t("actions.showPassword")}
                  </button>
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("reset.fields.password.placeholder")}
                  value={resetForm.password}
                  onChange={(e) => {
                    setResetForm((prev) => ({ ...prev, password: e.target.value }));
                    setResetErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  error={resetErrors.password}
                  disabled={isLoading}
                  autoComplete="new-password"
                  required
                />
                <p className="text-xs text-muted-foreground">{t("reset.fields.password.hint")}</p>
              </div>

              {/* Confirm password field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="confirmPassword">{t("reset.fields.confirmPassword.label")}</Label>
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-sm text-primary hover:underline"
                  >
                    {showConfirmPassword ? t("actions.hidePassword") : t("actions.showPassword")}
                  </button>
                </div>
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t("reset.fields.confirmPassword.placeholder")}
                  value={resetForm.confirmPassword}
                  onChange={(e) => {
                    setResetForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
                    setResetErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }}
                  error={resetErrors.confirmPassword}
                  disabled={isLoading}
                  autoComplete="new-password"
                  required
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("reset.submitting") : t("reset.submit")}
              </Button>
            </CardFooter>
          </form>
        </>
      )}
    </Card>
  );
}
