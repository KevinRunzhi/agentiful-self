/**
 * TenantSelector Component
 *
 * Dropdown for switching between tenant contexts
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@agentifui/ui/Button";
import { Card, CardContent } from "@agentifui/ui/Card";
import { useAuthStore } from "../stores/authStore";

/**
 * Tenant membership
 */
interface TenantMembership {
  id: string;
  name: string;
  slug: string;
  status: string;
  role: string;
  isCurrent: boolean;
}

/**
 * TenantSelector props
 */
export interface TenantSelectorProps {
  /**
   * Current tenant ID
   */
  currentTenantId?: string | null;
  /**
   * Available tenants
   */
  tenants?: TenantMembership[];
  /**
   * Callback when tenant is switched
   */
  onTenantSwitch?: (tenantId: string) => void;
}

/**
 * TenantSelector component
 */
export function TenantSelector({
  currentTenantId,
  tenants: propTenants,
  onTenantSwitch,
}: TenantSelectorProps) {
  const t = useTranslations("auth.tenant");
  const { session, switchTenant } = useAuthStore();

  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Use prop tenants or derive from session
  const tenants = React.useMemo(() => {
    if (propTenants) return propTenants;

    const sessionTenants =
      (session as { user?: { tenants?: TenantMembership[] } } | null)?.user?.tenants ?? [];
    return sessionTenants;
  }, [propTenants, session]);

  const currentTenant = React.useMemo(() => {
    if (currentTenantId) {
      return tenants.find((t) => t.id === currentTenantId);
    }
    return tenants.find((t) => t.isCurrent) || tenants[0] || null;
  }, [currentTenantId, tenants]);

  /**
   * Handle tenant switch
   */
  const handleSwitchTenant = async (tenantId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await switchTenant(tenantId);
      onTenantSwitch?.(tenantId);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.switchFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentTenant) {
    return null;
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isLoading}
        className="w-full justify-between"
      >
        <span className="truncate">
          {currentTenant.name}
          <span className="ml-2 text-xs text-muted-foreground">
            ({currentTenant.role})
          </span>
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </Button>

      {/* Error message */}
      {error && (
        <div className="mt-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
          {error}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <Card className="absolute z-20 w-full mt-1 max-h-64 overflow-y-auto">
            <CardContent className="p-0">
              <div className="py-1">
                {tenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => handleSwitchTenant(tenant.id)}
                    disabled={tenant.id === currentTenant.id || isLoading}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                      tenant.id === currentTenant.id
                        ? "bg-accent/50 font-medium"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{tenant.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {tenant.role}
                      </span>
                    </div>
                    {tenant.status !== "active" && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t(`status.${tenant.status}`)}
                      </div>
                    )}
                    {tenant.id === currentTenant.id && (
                      <div className="text-xs text-primary mt-0.5">
                        {t("current")}
                      </div>
                    )}
                  </button>
                ))}

                {tenants.length === 0 && (
                  <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                    {t("noTenants")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * Compact tenant badge for header
 */
export function TenantBadge({ tenant }: { tenant: TenantMembership | null }) {
  if (!tenant) return null;

  return (
    <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-muted">
      <div className="w-2 h-2 rounded-full bg-green-500" />
      <span className="text-sm font-medium truncate max-w-[150px]">
        {tenant.name}
      </span>
    </div>
  );
}
