/**
 * SSOButton Component
 *
 * Button for SSO/OAuth login (Google, Microsoft, etc.)
 */

"use client";

import * as React from "react";

/**
 * SSO provider configuration
 */
export interface SSOProvider {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
}

/**
 * Available SSO providers
 */
export const SSO_PROVIDERS: Record<string, Omit<SSOProvider, "id">> = {
  google: {
    name: "google",
    displayName: "Google",
    icon: "G",
    color: "bg-white hover:bg-gray-50 text-gray-900 border-gray-300",
  },
  microsoft: {
    name: "microsoft",
    displayName: "Microsoft",
    icon: "M",
    color: "bg-[#00a4ef] hover:bg-[#0094df] text-white",
  },
  github: {
    name: "github",
    displayName: "GitHub",
    icon: "⌘",
    color: "bg-gray-900 hover:bg-gray-800 text-white",
  },
  gitlab: {
    name: "gitlab",
    displayName: "GitLab",
    icon: "Git",
    color: "bg-[#FC6D26] hover:bg-[#e55f1f] text-white",
  },
  oidc: {
    name: "oidc",
    displayName: "SSO",
    icon: "🔐",
    color: "bg-primary hover:bg-primary/90 text-primary-foreground",
  },
};

/**
 * SSOButton props
 */
export interface SSOButtonProps {
  /**
   * Provider ID
   */
  provider: string;
  /**
   * Click handler
   */
  onClick?: () => void;
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
 * SSOButton component
 */
export function SSOButton({ provider, onClick, isLoading = false, redirectTo }: SSOButtonProps) {
  const providerConfig = SSO_PROVIDERS[provider];

  if (!providerConfig) {
    console.warn(`Unknown SSO provider: ${provider}`);
    return null;
  }

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: redirect to OAuth URL
      const params = new URLSearchParams({
        provider,
        redirectURL: redirectTo || window.location.origin + "/dashboard",
      });
      window.location.href = `/api/auth/oauth?${params.toString()}`;
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={`w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border ${providerConfig.color}`}
    >
      {isLoading ? (
        <span className="animate-spin">⟳</span>
      ) : (
        <>
          <span className="w-5 h-5 flex items-center justify-center bg-current rounded">
            <span className="text-[10px]">{providerConfig.icon}</span>
          </span>
          <span>Continue with {providerConfig.displayName}</span>
        </>
      )}
    </button>
  );
}

/**
 * Divider for SSO buttons
 */
export function SSOButtonDivider() {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">
          Or continue with
        </span>
      </div>
    </div>
  );
}
