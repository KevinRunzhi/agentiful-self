/**
 * Settings Page
 *
 * User settings with profile, theme, and security options
 */

import { Suspense } from "react";
import { UserProfileEditor } from "../../../features/user/components/UserProfileEditor";
import { ThemeSelector } from "../../../features/user/components/ThemeSelector";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/Card";
import { ShieldIcon, UserIcon } from "lucide-react";

/**
 * Settings Page
 */
export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* Profile Section */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="w-5 h-5" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div>Loading profile...</div>}>
              <UserProfileEditor />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      {/* Appearance Section */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">
                Customize your viewing experience
              </p>
            </div>
            <ThemeSelector
              theme="system"
              onThemeChange={(theme) => console.log("Theme change:", theme)}
            />
          </CardContent>
        </Card>
      </section>

      {/* Security Section */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldIcon className="w-5 h-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href="/settings/security/mfa">Enable</a>
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Change Password</p>
                <p className="text-sm text-muted-foreground">
                  Update your password regularly for security
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href="/settings/password">Change</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
