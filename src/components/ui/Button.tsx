import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "dark" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold/50",
          // Variants
          variant === "primary" &&
            "bg-gold text-white hover:bg-gold-dark shadow-sm",
          variant === "secondary" &&
            "border-2 border-charcoal text-charcoal hover:bg-charcoal hover:text-white",
          variant === "dark" &&
            "bg-charcoal text-white hover:bg-charcoal-light",
          variant === "outline" &&
            "border-2 border-gold text-gold hover:bg-gold hover:text-white",
          variant === "ghost" &&
            "text-charcoal hover:bg-charcoal/5",
          // Sizes
          size === "sm" && "px-4 py-2 text-sm",
          size === "md" && "px-6 py-3 text-base",
          size === "lg" && "px-8 py-4 text-lg",
          // Disabled
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
