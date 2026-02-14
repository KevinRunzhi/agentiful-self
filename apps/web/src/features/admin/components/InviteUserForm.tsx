/**
 * InviteUserForm Component
 *
 * Form for tenant admins to invite new users
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@agentifui/ui/Button";
import { Input } from "@agentifui/ui/Input";
import { Label } from "@agentifui/ui/Label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@agentifui/ui/Card";

/**
 * InviteUserForm props
 */
export interface InviteUserFormProps {
  /**
   * Submit handler
   */
  onInvite: (data: { email: string; role: string; message?: string }) => Promise<void>;
  /**
   * Is loading
   */
  isLoading?: boolean;
  /**
   * Available roles
   */
  roles?: string[];
}

/**
 * InviteUserForm component
 */
export function InviteUserForm({
  onInvite,
  isLoading = false,
  roles = ["member", "manager", "admin"],
}: InviteUserFormProps) {
  const t = useTranslations("users.invite");

  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("member");
  const [message, setMessage] = React.useState("");
  const [errors, setErrors] = React.useState<{ email?: string }>({});

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    const newErrors: { email?: string } = {};

    if (!email.trim()) {
      newErrors.email = t("errors.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t("errors.emailInvalid");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle submit
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onInvite({ email: email.trim(), role, message: message || undefined });
      // Reset on success
      setEmail("");
      setMessage("");
    } catch {
      // Error handled by parent
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" required>
              {t("fields.email.label")}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={t("fields.email.placeholder")}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors({});
              }}
              error={errors.email}
              disabled={isLoading}
              required
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role" required>
              {t("fields.role.label")}
            </Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {t.has(`roles.${r}`) ? t(`roles.${r}`) : r}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t("fields.role.hint")}</p>
          </div>

          {/* Personal message (optional) */}
          <div className="space-y-2">
            <Label htmlFor="message">
              {t("fields.message.label")}
            </Label>
            <textarea
              id="message"
              placeholder={t("fields.message.placeholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </CardContent>

        <CardFooter>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t("actions.sending") : t("actions.send")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
