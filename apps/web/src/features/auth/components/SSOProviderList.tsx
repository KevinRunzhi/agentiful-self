/**
 * SSOProviderList Component
 *
 * List of available SSO providers for login
 */

"use client";

import * as React from "react";
import { SSOButton, SSO_PROVIDERS } from "./SSOButton";

/**
 * SSO detection result
 */
export interface SSODetection {
  provider: string | null;
  tenantId: string | null;
}

/**
 * SSOProviderList props
 */
export interface SSOProviderListProps {
  /**
   * User's email (for SSO detection)
   */
  email?: string;
  /**
   * Detected SSO for email domain
   */
  detectedSSO?: SSODetection | null;
  /**
   * Available providers
   */
  providers?: string[];
  /**
   * Is loading
   */
  isLoading?: boolean;
  /**
   * Redirect URL after login
   */
  redirectTo?: string;
}

/**
 * SSOProviderList component
 */
export function SSOProviderList({
  email: _email,
  detectedSSO,
  providers = Object.keys(SSO_PROVIDERS),
  isLoading = false,
  redirectTo,
}: SSOProviderListProps) {
  // If SSO is detected for the email domain, prioritize it
  const primaryProvider = detectedSSO?.provider && providers.includes(detectedSSO.provider)
    ? detectedSSO.provider
    : null;

  const otherProviders = providers.filter((p) => p !== primaryProvider);

  return (
    <div className="space-y-3">
      {primaryProvider ? (
        <>
          <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Based on your email domain, you can sign in with{" "}
              <strong>{SSO_PROVIDERS[primaryProvider]?.displayName}</strong>
            </p>
          </div>
          <SSOButton
            provider={primaryProvider}
            isLoading={isLoading}
            redirectTo={redirectTo}
          />
          {otherProviders.length > 0 && (
            <>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  More sign in options
                </summary>
                <div className="mt-3 space-y-3 pl-4 border-l-2 border-muted">
                  {otherProviders.map((provider) => (
                    <SSOButton
                      key={provider}
                      provider={provider}
                      isLoading={isLoading}
                      redirectTo={redirectTo}
                    />
                  ))}
                </div>
              </details>
            </>
          )}
        </>
      ) : (
        <>
          {otherProviders.map((provider) => (
            <SSOButton
              key={provider}
              provider={provider}
              isLoading={isLoading}
              redirectTo={redirectTo}
            />
          ))}
        </>
      )}
    </div>
  );
}
