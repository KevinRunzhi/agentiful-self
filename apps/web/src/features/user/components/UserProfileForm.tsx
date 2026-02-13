/**
 * UserProfileForm Component
 *
 * Form for editing user profile
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@agentifui/ui/Button";
import { Input } from "@agentifui/ui/Input";
import { Label } from "@agentifui/ui/Label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@agentifui/ui/Card";

/**
 * User profile data
 */
export interface UserProfileData {
  name: string;
  email: string;
  avatar?: string;
  locale?: string;
  theme?: string;
}

/**
 * UserProfileForm props
 */
export interface UserProfileFormProps {
  /**
   * Initial values
   */
  initialValues: UserProfileData;
  /**
   * Submit handler
   */
  onSubmit: (data: Partial<UserProfileData>) => Promise<void>;
  /**
   * Is loading
   */
  isLoading?: boolean;
}

/**
 * UserProfileForm component
 */
export function UserProfileForm({
  initialValues,
  onSubmit,
  isLoading = false,
}: UserProfileFormProps) {
  const t = useTranslations("users.profile");

  const [formData, setFormData] = React.useState<Partial<UserProfileData>>({
    name: initialValues.name,
    avatar: initialValues.avatar,
    locale: initialValues.locale,
    theme: initialValues.theme,
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof UserProfileData, string>>>({});

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof UserProfileData, string>> = {};

    if (!formData.name?.trim()) {
      newErrors.name = t("errors.nameRequired");
    } else if (formData.name.trim().length < 2) {
      newErrors.name = t("errors.nameTooShort");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle input change
   */
  const handleChange = (field: keyof UserProfileData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  /**
   * Handle submit
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit({
      name: formData.name?.trim(),
      avatar: formData.avatar,
      locale: formData.locale,
      theme: formData.theme,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Avatar upload (simplified) */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-medium text-primary">
                {formData.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <Button type="button" variant="outline" size="sm">
                Change Avatar
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG or GIF. Max 1MB.
              </p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" required>
              {t("fields.name.label")}
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name || ""}
              onChange={handleChange("name")}
              error={errors.name}
              disabled={isLoading}
            />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">
              {t("fields.email.label")}
            </Label>
            <Input
              id="email"
              type="email"
              value={initialValues.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Contact support to change your email
            </p>
          </div>

          {/* Locale */}
          <div className="space-y-2">
            <Label htmlFor="locale">
              {t("fields.locale.label")}
            </Label>
            <select
              id="locale"
              value={formData.locale || "en"}
              onChange={handleChange("locale")}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ja">日本語</option>
            </select>
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <Label htmlFor="theme">
              {t("fields.theme.label")}
            </Label>
            <select
              id="theme"
              value={formData.theme || "system"}
              onChange={handleChange("theme")}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? t("actions.saving") : t("actions.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
