import { Input } from "../../../components/ui/Input";
import type { AppsCategory } from "../types";

const CATEGORY_OPTIONS: Array<{ value: AppsCategory; label: string }> = [
  { value: "all", label: "All Categories" },
  { value: "chat", label: "Chat" },
  { value: "workflow", label: "Workflow" },
  { value: "agent", label: "Agent" },
];

export interface AppsSearchFiltersProps {
  query: string;
  onQueryChange: (next: string) => void;
  category: AppsCategory;
  onCategoryChange: (next: AppsCategory) => void;
}

export function AppsSearchFilters({
  query,
  onQueryChange,
  category,
  onCategoryChange,
}: AppsSearchFiltersProps) {
  return (
    <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
      <Input
        value={query}
        onChange={(event) =>
          onQueryChange(String((event.target as { value?: string }).value ?? ""))
        }
        placeholder="Search apps..."
        className="w-full md:w-72"
      />

      <select
        value={category}
        onChange={(event) =>
          onCategoryChange(
            String((event.target as { value?: string }).value ?? "all") as AppsCategory
          )
        }
        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm md:w-44"
        aria-label="App category"
      >
        {CATEGORY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
