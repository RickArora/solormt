import { ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type ButtonProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: "primary" | "secondary";
};

export function ButtonLink({ className = "", variant = "primary", children, ...props }: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-skybrand text-white hover:bg-[#168ee8]"
      : "border border-slate-300 bg-white text-ink hover:border-skybrand hover:text-skybrand";

  return (
    <Link
      className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition ${styles} ${className}`}
      {...props}
    >
      {variant === "primary" ? <ArrowRight aria-hidden="true" size={18} /> : <CalendarDays aria-hidden="true" size={18} />}
      {children}
    </Link>
  );
}

