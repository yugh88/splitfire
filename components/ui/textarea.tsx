import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-fire-amber/50 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex field-sizing-content min-h-16 w-full rounded-xl border bg-white/[0.03] px-3 py-2.5 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow,background-color] duration-200 outline-none hover:border-white/15 focus-visible:bg-white/[0.05] focus-visible:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_3px_rgba(245,165,36,0.14),0_8px_28px_-18px_rgba(245,165,36,0.6)] focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
