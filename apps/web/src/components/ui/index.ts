/**
 * Base UI Components Setup
 *
 * shadcn/ui components re-export
 *
 * This file serves as the entry point for all UI components
 */

// Button component
export { Button } from "./Button";
export type { ButtonProps } from "./Button";

// Input component
export { Input } from "./Input";
export type { InputProps } from "./Input";

// Label component
export { Label } from "./Label";
export type { LabelProps } from "./Label";

// Card component
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./Card";
export type { CardProps } from "./Card";

// Dialog component
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
export type { DialogProps } from "./Dialog";

// Dropdown Menu component
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./DropdownMenu";
export type { DropdownMenuProps } from "./DropdownMenu";

// Tabs component
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
export type { TabsProps } from "./Tabs";

// Toast component
export { useToast, Toast, ToastProvider, ToastViewport } from "./Toast";
export type { ToastProps } from "./Toast";
