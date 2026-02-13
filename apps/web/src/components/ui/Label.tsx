/**
 * Label Component
 *
 * Form label with required indicator
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@agentifui/ui/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & VariantProps<typeof labelVariants> & {
    required?: boolean;
  }
>(({ className, children, required, ...props }, ref) => {
  return (
    <label ref={ref} className={cn(labelVariants(), className)} {...props}>
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </label>
  );
});
Label.displayName = "Label";

export { Label };
