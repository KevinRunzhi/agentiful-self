import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import type { AccessibleApp } from "../types";

export interface AppWorkbenchCardProps {
  app: AccessibleApp;
  degraded: boolean;
  favoritePending?: boolean;
  recentPending?: boolean;
  onToggleFavorite: (appId: string, isFavorite: boolean | undefined) => void;
  onNewConversation: (appId: string) => void;
}

function formatLastUsedAt(value: string | null | undefined): string {
  if (!value) {
    return "Not used yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not used yet";
  }

  return `Last used: ${parsed.toLocaleString()}`;
}

export function AppWorkbenchCard({
  app,
  degraded,
  favoritePending = false,
  recentPending = false,
  onToggleFavorite,
  onNewConversation,
}: AppWorkbenchCardProps) {
  return (
    <Card data-testid={`app-card-${app.id}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold" data-testid="app-name">
              {app.name}
            </h2>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {app.description || "No description"}
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={favoritePending}
            onClick={() => onToggleFavorite(app.id, app.isFavorite)}
          >
            {app.isFavorite ? "Unfavorite" : "Favorite"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {app.mode ? <span className="rounded border px-2 py-1">{app.mode}</span> : null}
          {app.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded border px-2 py-1">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{formatLastUsedAt(app.lastUsedAt)}</span>

          <Button
            type="button"
            data-testid={`direct-access-${app.id}`}
            size="sm"
            variant="outline"
            disabled={degraded || recentPending}
            onClick={() => onNewConversation(app.id)}
          >
            New Conversation
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
