/**
 * ThemeSelector Component
 *
 * Theme selection dropdown
 */

"use client";

import * as React from "react";
import { MoonIcon, SunIcon, MonitorIcon } from "lucide-react";
import { Button } from "@agentifui/ui/Button";

/**
 * Theme type
 */
export type Theme = "light" | "dark" | "system";

/**
 * ThemeSelector props
 */
export interface ThemeSelectorProps {
  /**
   * Current theme
   */
  theme: Theme;
  /**
   * Theme change handler
   */
  onThemeChange: (theme: Theme) => void;
}

/**
 * ThemeSelector component
 */
export function ThemeSelector({ theme, onThemeChange }: ThemeSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const themes: Array<{ value: Theme; icon: React.ReactNode; label: string }> = [
    { value: "light", icon: <SunIcon className="w-4 h-4" />, label: "Light" },
    { value: "dark", icon: <MoonIcon className="w-4 h-4" />, label: "Dark" },
    { value: "system", icon: <MonitorIcon className="w-4 h-4" />, label: "System" },
  ];

  const fallbackTheme: { value: Theme; icon: React.ReactNode; label: string } = {
    value: "system",
    icon: <MonitorIcon className="w-4 h-4" />,
    label: "System",
  };
  const currentTheme = themes.find((t) => t.value === theme) ?? fallbackTheme;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        {currentTheme.icon}
        <span className="ml-2">{currentTheme.label}</span>
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 right-0 mt-2 w-40 bg-background border rounded-md shadow-lg">
            {themes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  onThemeChange(t.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 ${
                  t.value === theme ? "bg-muted" : ""
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
