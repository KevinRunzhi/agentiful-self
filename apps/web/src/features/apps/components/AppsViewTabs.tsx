import { Button } from "../../../components/ui/Button";
import type { WorkbenchView } from "../types";

const VIEW_LABELS: Record<WorkbenchView, string> = {
  all: "All",
  recent: "Recent",
  favorites: "Favorites",
};

export interface AppsViewTabsProps {
  value: WorkbenchView;
  onChange: (next: WorkbenchView) => void;
}

export function AppsViewTabs({ value, onChange }: AppsViewTabsProps) {
  return (
    <div className="inline-flex rounded-md border p-1" role="tablist" aria-label="Apps view">
      {(Object.keys(VIEW_LABELS) as WorkbenchView[]).map((tab) => (
        <Button
          key={tab}
          type="button"
          role="tab"
          size="sm"
          variant={value === tab ? "default" : "ghost"}
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
        >
          {VIEW_LABELS[tab]}
        </Button>
      ))}
    </div>
  );
}
