/**
 * UserProfileEditor Component
 *
 * Form for editing user profile with avatar, name, preferences
 */

"use client";

import * as React from "react";
import { UserProfileForm } from "../../../features/user/components/UserProfileForm";
import { useAuth } from "../../../features/auth/hooks/useAuth";

/**
 * UserProfileEditor component
 */
export function UserProfileEditor() {
  const { user } = useAuth();

  const [isLoading, setIsLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  /**
   * Handle profile update
   */
  const handleSubmit = async (data: { name?: string; locale?: string; theme?: string }) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || "Update failed");
      }

      setMessage({ type: "success", text: "Profile updated successfully" });

      // Refresh session to get updated user data
      window.location.reload();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Update failed",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-md ${
            message.type === "success"
              ? "bg-green-500/10 text-green-700 border border-green-500/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {message.text}
        </div>
      )}

      <UserProfileForm
        initialValues={{
          name: user.name || "",
          email: user.email || "",
          locale: "en",
          theme: "system",
        }}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
