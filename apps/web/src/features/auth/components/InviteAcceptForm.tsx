/**
 * InviteAcceptForm Component
 *
 * Form for accepting invitations and creating accounts
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
 * Invite accept form data
 */
interface InviteAcceptFormData {
  name: string;
  password: string;
  confirmPassword: string;
}

/**
 * Invite accept form errors
 */
interface InviteAcceptFormErrors {
  name?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

/**
 * Invitation details
 */
interface InvitationDetails {
  tenantName: string;
  tenantSlug: string;
  inviterName: string;
  email: string;
  role: string;
}

/**
 * InviteAcceptForm props
 */
export interface InviteAcceptFormProps {
  /**
   * Invitation token (from URL)
   */
  token: string;
}

/**
 * InviteAcceptForm component
 */
export function InviteAcceptForm({ token }: InviteAcceptFormProps) {
  const router = useRouter();
  const t = useTranslations("auth.invite");

  // Form state
  const [formData, setFormData] = React.useState<InviteAcceptFormData>({
    name: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = React.useState<InviteAcceptFormErrors>({});
  const [isLoading, setIsLoading] = React.useState(false);

  // Invitation state
  const [invitation, setInvitation] = React.useState<InvitationDetails | null>(null);
  const [isValidating, setIsValidating] = React.useState(true);
  const [isValid, setIsValid] = React.useState(false);

  // Password visibility
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  /**
   * Validate invitation token on mount
   */
  React.useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await fetch(`/api/auth/invitations/${token}/validate`);

        if (!response.ok) {
          setIsValid(false);
          return;
        }

        const data = await response.json();
        setInvitation(data);
        setIsValid(true);
      } catch {
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    const newErrors: InviteAcceptFormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = t("errors.nameRequired");
    } else if (formData.name.trim().length < 2) {
      newErrors.name = t("errors.nameTooShort");
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = t("errors.passwordRequired");
    } else if (formData.password.length < 8) {
      newErrors.password = t("errors.passwordTooShort");
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = t("errors.passwordWeak");
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t("errors.confirmPasswordRequired");
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t("errors.passwordMismatch");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle input change
   */
  const handleChange = (field: keyof InviteAcceptFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: formData.name.trim(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({
          general: data.error?.message || t("errors.acceptFailed"),
        });
        return;
      }

      // Redirect to login on success
      router.push("/login?accepted=true");
    } catch {
      setErrors({
        general: t("errors.networkError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while validating token
  if (isValidating) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Invalid token state
  if (!isValid) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">{t("invalid.title")}</CardTitle>
          <CardDescription>{t("invalid.description")}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <a href="/login">{t("invalid.backToLogin")}</a>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("description", { tenant: invitation?.tenantName })}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* General error */}
          {errors.general && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {errors.general}
            </div>
          )}

          {/* Invitation info */}
          {invitation && (
            <div className="p-3 rounded-md bg-muted text-sm space-y-1">
              <p className="font-medium">{t("info.invitedBy")}</p>
              <p className="text-muted-foreground">{invitation.inviterName}</p>
              <p className="font-medium mt-2">{t("info.email")}</p>
              <p className="text-muted-foreground">{invitation.email}</p>
              <p className="font-medium mt-2">{t("info.role")}</p>
              <p className="text-muted-foreground">{invitation.role}</p>
            </div>
          )}

          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="name">{t("fields.name.label")}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t("fields.name.placeholder")}
              value={formData.name}
              onChange={handleChange("name")}
              error={errors.name}
              disabled={isLoading}
              autoComplete="name"
              required
            />
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
              onChange={handleChange("password")}
              error={errors.password}
              disabled={isLoading}
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-muted-foreground">{t("fields.password.hint")}</p>
          </div>

          {/* Confirm password field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="confirmPassword">{t("fields.confirmPassword.label")}</Label>
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
              placeholder={t("fields.confirmPassword.placeholder")}
              value={formData.confirmPassword}
              onChange={handleChange("confirmPassword")}
              error={errors.confirmPassword}
              disabled={isLoading}
              autoComplete="new-password"
              required
            />
          </div>
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? t("actions.accepting") : t("actions.accept")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
