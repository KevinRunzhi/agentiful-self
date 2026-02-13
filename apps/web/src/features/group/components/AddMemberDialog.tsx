/**
 * AddMemberDialog Component
 *
 * Dialog for adding members to a group
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@agentifui/ui/Button";
import { Input } from "@agentifui/ui/Input";
import { Label } from "@agentifui/ui/Label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@agentifui/ui/Dialog";

/**
 * User option for autocomplete
 */
export interface UserOption {
  id: string;
  name: string;
  email: string;
}

/**
 * AddMemberDialog props
 */
export interface AddMemberDialogProps {
  /**
   * Is dialog open
   */
  open: boolean;
  /**
   * Close handler
   */
  onClose: () => void;
  /**
   * Add members handler
   */
  onAdd: (userIds: string[], role: string) => Promise<void>;
  /**
   * Search users handler
   */
  onSearchUsers?: (query: string) => Promise<UserOption[]>;
  /**
   * Is loading
   */
  isLoading?: boolean;
}

/**
 * AddMemberDialog component
 */
export function AddMemberDialog({
  open,
  onClose,
  onAdd,
  onSearchUsers,
  isLoading = false,
}: AddMemberDialogProps) {
  const t = useTranslations("groups.addMembers");

  const [selectedUsers, setSelectedUsers] = React.useState<UserOption[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<UserOption[]>([]);
  const [role, setRole] = React.useState<string>("member");
  const [isSearching, setIsSearching] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  /**
   * Search users debounced
   */
  React.useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await onSearchUsers?.(searchQuery);
        setSearchResults(results || []);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, onSearchUsers]);

  /**
   * Handle select user
   */
  const handleSelectUser = (user: UserOption) => {
    if (selectedUsers.some((u) => u.id === user.id)) {
      return; // Already selected
    }

    setSelectedUsers((prev) => [...prev, user]);
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  };

  /**
   * Handle remove user
   */
  const handleRemoveUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  /**
   * Handle add members
   */
  const handleAdd = async () => {
    if (selectedUsers.length === 0) {
      return;
    }

    await onAdd(selectedUsers.map((u) => u.id), role);

    // Reset and close
    setSelectedUsers([]);
    setSearchQuery("");
    setRole("member");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="space-y-2">
            <Label htmlFor="search">{t("fields.search.label")}</Label>
            <div className="relative">
              <Input
                ref={searchInputRef}
                id="search"
                type="text"
                placeholder={t("fields.search.placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isLoading}
                autoComplete="off"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="animate-spin">⟳</span>
                </div>
              )}
            </div>

            {/* Search results dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className="w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                  >
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </button>
                ))}
              </div>
            )}

            {showResults && searchResults.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg p-3">
                <p className="text-sm text-muted-foreground">{t("noResults")}</p>
              </div>
            )}
          </div>

          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <Label>{t("fields.selected.label")}</Label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border"
                  >
                    <span className="text-sm">{user.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveUser(user.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      disabled={isLoading}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Role selection */}
          <div className="space-y-2">
            <Label htmlFor="role">{t("fields.role.label")}</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="member">{t("roles.member")}</option>
              <option value="manager">{t("roles.manager")}</option>
              <option value="admin">{t("roles.admin")}</option>
            </select>
            <p className="text-xs text-muted-foreground">{t("fields.role.hint")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={selectedUsers.length === 0 || isLoading}
          >
            {isLoading ? t("actions.adding") : t("actions.add", { count: selectedUsers.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
