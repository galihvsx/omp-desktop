import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type OptionSelectItem = {
  value: string;
  label: string;
};

export function OptionSelect({
  value,
  items,
  placeholder,
  disabled,
  title,
  icon,
  className,
  onValueChange,
}: {
  value: string;
  items: OptionSelectItem[];
  placeholder: string;
  disabled?: boolean;
  title?: string;
  icon?: ReactNode;
  className?: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next: unknown) => {
        if (typeof next === "string") {
          onValueChange(next);
        }
      }}
    >
      <SelectTrigger
        size="sm"
        title={title}
        className={cn("min-w-0 max-w-48", className)}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {icon}
          <SelectValue placeholder={placeholder} className="truncate" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} className="text-ui-xs">
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}