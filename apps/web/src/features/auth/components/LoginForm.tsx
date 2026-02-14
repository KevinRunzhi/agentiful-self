/**
 * LoginForm Component
 *
 * Login form with email/password, account lockout info, and tenant context
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@agentifui/ui/Button";
import { Input } from "@agentifui/ui/Input";
import { Label } from "@agentifui/ui/Label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@agentifui/ui/Card";
import { useAuthStore } from "../stores/authStore";

/**
 * Login form state
 */
interface LoginFormData {
  email: string;
  password: string;
  tenantSlug?: string;
}

/**
 * Login form errors
 */
interface LoginFormErrors {
  email?: string;
  password?: string;
  general?: string;
}

/**
 * Lockout status
 */
interface LockoutStatus {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutTimeRemaining: number;
  maxAttempts: number;
}

/**
 * LoginForm props
 */
export interface LoginFormProps {
  /**
   * Initial tenant slug (from URL or subdomain)
   */
  initialTenantSlug?: string;
  /**
   * Redirect path after successful login
   */
  redirectTo?: string;
}

/**
 * LoginForm component
 */
export function LoginForm({ initialTenantSlug, redirectTo = "/dashboard" }: LoginFormProps) {
  const router = useRouter();
  const t = useTranslations("auth.login");
  const { signIn } = useAuthStore();

  // Form state
  const [formData, setFormData] = React.useState<LoginFormData>({
    email: "",
    password: "",
    tenantSlug: initialTenantSlug,
  });
  const [errors, setErrors] = React.useState<LoginFormErrors>({});
  const [isLoading, setIsLoading] = React.useState(false);

  // Lockout state
  const [lockoutStatus, setLockoutStatus] = React.useState<LockoutStatus | null>(null);

  // Password visibility
  const [showPassword, setShowPassword] = React.useState(false);
  const lockoutCheckTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (lockoutCheckTimerRef.current) {
        clearTimeout(lockoutCheckTimerRef.current);
      }
    },
    []
  );

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    const newErrors: LoginFormErrors = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = t("errors.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t("errors.emailInvalid");
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = t("errors.passwordRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Check lockout status for email
   */
  const checkLockoutStatus = async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLockoutStatus(null);
      return;
    }

    try {
      const response = await fetch("/api/auth/check-lockout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const data = await response.json();
        setLockoutStatus(data);
      }
    } catch {
      // Ignore errors checking lockout status
    }
  };

  /**
   * Handle email change (debounced lockout check)
   */
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, email: value }));
    setErrors((prev) => ({ ...prev, email: undefined, general: undefined }));

    // Debounced lockout check
    if (lockoutCheckTimerRef.current) {
      clearTimeout(lockoutCheckTimerRef.current);
    }

    lockoutCheckTimerRef.current = setTimeout(() => {
      void checkLockoutStatus(value);
    }, 500);
  };

  /**
   * Handle password change
   */
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, password: e.target.value }));
    setErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Check if account is locked
    if (lockoutStatus?.isLocked) {
      setErrors({ general: t("errors.accountLocked") });
      return;
    }

    setIsLoading(true);

    try {
      await signIn(formData.email, formData.password, formData.tenantSlug);
      router.push(redirectTo);
    } catch (error) {
      // Check lockout status again after failed attempt
      await checkLockoutStatus(formData.email);

      setErrors({
        general: error instanceof Error ? error.message : t("errors.loginFailed"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Format lockout time remaining
   */
  const formatLockoutTime = (seconds: number): string => {
    const minutes = Math.ceil(seconds / 60);
    return t("errors.lockoutTimeRemaining", { minutes });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>

      <form noValidate onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* General error */}
          {errors.general && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {errors.general}
            </div>
          )}

          {/* Lockout warning */}
          {lockoutStatus?.isLocked && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {t("errors.accountLocked")} {formatLockoutTime(lockoutStatus.lockoutTimeRemaining)}
            </div>
          )}

          {/* Remaining attempts warning */}
          {lockoutStatus && !lockoutStatus.isLocked && lockoutStatus.remainingAttempts <= 2 && (
            <div className="p-3 rounded-md bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-sm">
              {t("errors.remainingAttempts", { count: lockoutStatus.remainingAttempts })}
            </div>
          )}

          {/* Email field */}
          <div className="space-y-2">
            <Label htmlFor="email">{t("fields.email.label")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("fields.email.placeholder")}
              value={formData.email}
              onChange={handleEmailChange}
              error={errors.email}
              disabled={isLoading}
              autoComplete="email"
              required
            />
            {errors.email ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.email}
              </p>
            ) : null}
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("fields.password.label")}</Label>
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
              placeholder={t("fields.password.placeholder")}
              value={formData.password}
              onChange={handlePasswordChange}
              error={errors.password}
              disabled={isLoading}
              autoComplete="current-password"
              required
            />
            {errors.password ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.password}
              </p>
            ) : null}
          </div>

          {/* Forgot password link */}
          <div className="text-right">
            <a
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              {t("actions.forgotPassword")}
            </a>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || lockoutStatus?.isLocked}
          >
            {isLoading ? t("actions.signingIn") : t("actions.signIn")}
          </Button>

          {/* Sign up link */}
          <p className="text-sm text-muted-foreground text-center">
            {t("noAccount")}{" "}
            <a href="/signup" className="text-primary hover:underline">
              {t("actions.signUp")}
            </a>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
