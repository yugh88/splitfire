import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,filter,transform] duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(180deg,#F8B84A_0%,#F5A524_55%,#EF961B_100%)] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_18px_-12px_rgba(255,106,43,0.65)] hover:brightness-[1.04] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_10px_30px_-10px_rgba(255,106,43,0.7)]",
        outline:
          "border-border bg-white/[0.02] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-white/15 hover:bg-white/[0.06] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-16px_rgba(245,165,36,0.5)] aria-expanded:bg-white/[0.06]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-accent aria-expanded:bg-accent",
        ghost:
          "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground aria-expanded:bg-white/[0.05] aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-xl px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-xl px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-xl in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-xl in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
