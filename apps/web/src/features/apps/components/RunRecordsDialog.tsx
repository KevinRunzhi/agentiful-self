"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";
import type { RunDetail, RunSummary } from "../types";

interface RunRecordsDialogProps {
  open: boolean;
  appName: string;
  runs: RunSummary[];
  selectedRun: RunDetail | null;
  isLoading: boolean;
  isDetailLoading: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSelectRun: (runId: string) => void;
  onRefresh: () => void;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
}

export function RunRecordsDialog({
  open,
  appName,
  runs,
  selectedRun,
  isLoading,
  isDetailLoading,
  error,
  onOpenChange,
  onSelectRun,
  onRefresh,
}: RunRecordsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Run Records - {appName}</DialogTitle>
          <DialogDescription>
            Polling every 3 seconds. Status changes should reflect in near real-time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Unified records for generation, agent, and workflow runs.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
            Refresh
          </Button>
        </div>

        {error ? (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="max-h-[420px] overflow-auto rounded border">
            {isLoading ? (
              <div className="p-3 text-sm text-muted-foreground">Loading runs...</div>
            ) : runs.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No runs yet.</div>
            ) : (
              <ul className="divide-y">
                {runs.map((runItem) => (
                  <li key={runItem.id}>
                    <button
                      type="button"
                      className="w-full space-y-1 p-3 text-left hover:bg-muted/40"
                      onClick={() => onSelectRun(runItem.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{runItem.type}</span>
                        <span className="text-xs uppercase text-muted-foreground">{runItem.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Trace: {runItem.traceId}</p>
                      <p className="text-xs text-muted-foreground">
                        Started: {formatDateTime(runItem.startedAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-h-[240px] rounded border p-3">
            {isDetailLoading ? (
              <p className="text-sm text-muted-foreground">Loading run detail...</p>
            ) : !selectedRun ? (
              <p className="text-sm text-muted-foreground">Select a run to inspect details.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <p>Status: {selectedRun.status}</p>
                  <p>Type: {selectedRun.type}</p>
                  <p>Duration: {selectedRun.durationMs} ms</p>
                  <p>Model: {selectedRun.model || "-"}</p>
                  <p>Input tokens: {selectedRun.inputTokens}</p>
                  <p>Output tokens: {selectedRun.outputTokens}</p>
                  <p>Total tokens: {selectedRun.totalTokens}</p>
                  <p>Trace: {selectedRun.traceId}</p>
                </div>

                <div className="space-y-1">
                  <p className="font-medium">Timing</p>
                  <p>Started: {formatDateTime(selectedRun.startedAt)}</p>
                  <p>Finished: {formatDateTime(selectedRun.finishedAt)}</p>
                  <p>Updated: {formatDateTime(selectedRun.updatedAt)}</p>
                </div>

                {selectedRun.error ? (
                  <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-destructive">
                    Failure reason: {selectedRun.error}
                  </div>
                ) : null}

                <div className="space-y-1">
                  <p className="font-medium">Run Steps</p>
                  {selectedRun.steps.length === 0 ? (
                    <p className="text-muted-foreground">No steps recorded.</p>
                  ) : (
                    <ul className="space-y-1">
                      {selectedRun.steps.map((step) => (
                        <li key={step.id} className="rounded border p-2">
                          <p>
                            #{step.stepIndex} {step.title || step.nodeType}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {step.status} - {step.durationMs} ms - {step.totalTokens} tokens
                          </p>
                          {step.error ? (
                            <p className="text-xs text-destructive">Error: {step.error}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

