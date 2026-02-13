/**
 * GroupForm Component
 *
 * Form for creating and editing groups
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@agentifui/ui/Button";
import { Input } from "@agentifui/ui/Input";
import { Label } from "@agentifui/ui/Label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@agentifui/ui/Card";

/**
 * Group form data
 */
export interface GroupFormData {
  name: string;
  description?: string;
}

/**
 * GroupForm props
 */
export interface GroupFormProps {
  /**
   * Initial values for editing
   */
  initialValues?: GroupFormData;
  /**
   * Submit handler
   */
  onSubmit: (data: GroupFormData) => Promise<void>;
  /**
   * Cancel handler
   */
  onCancel?: () => void;
  /**
   * Is loading
   */
  isLoading?: boolean;
  /**
   * Submit button text
   */
  submitText?: string;
  /**
   * Form mode
   */
  mode?: "create" | "edit";
}

/**
 * GroupForm component
 */
export function GroupForm({
  initialValues,
  onSubmit,
  onCancel,
  isLoading = false,
  submitText,
  mode = "create",
}: GroupFormProps) {
  const t = useTranslations("groups.form");

  const [formData, setFormData] = React.useState<GroupFormData>(
    initialValues || { name: "", description: "" }
  );
  const [errors, setErrors] = React.useState<Partial<Record<keyof GroupFormData, string>>>({});

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof GroupFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = t("errors.nameRequired");
    } else if (formData.name.trim().length < 2) {
      newErrors.name = t("errors.nameTooShort");
    } else if (formData.name.trim().length > 255) {
      newErrors.name = t("errors.nameTooLong");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle input change
   */
  const handleChange = (field: keyof GroupFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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

    await onSubmit({
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "create" ? t("title.create") : t("title.edit")}
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="name" required>
              {t("fields.name.label")}
            </Label>
            <Input
              id="name"
              type="text"
              placeholder={t("fields.name.placeholder")}
              value={formData.name}
              onChange={handleChange("name")}
              error={errors.name}
              disabled={isLoading}
              maxLength={255}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t("fields.name.hint")}
            </p>
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="description">
              {t("fields.description.label")}
            </Label>
            <textarea
              id="description"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={t("fields.description.placeholder")}
              value={formData.description || ""}
              onChange={handleChange("description")}
              disabled={isLoading}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {t("fields.description.hint")}
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              {t("actions.cancel")}
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? t("actions.saving") : (submitText || t("actions.save"))}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
