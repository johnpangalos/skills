import type { ComponentProps } from "react";

export type ButtonVariant = "default" | "outline" | "ghost";
export type ButtonSize = "default" | "sm";

const classes = `
  inline-flex items-center justify-center rounded-md font-sans font-semibold outline-none
  focus-visible:ring-2 focus-visible:ring-fuchsia-600 focus-visible:ring-offset-2
  data-[variant=default]:bg-fuchsia-700 data-[variant=default]:text-white
  data-[variant=default]:hover:bg-fuchsia-800 data-[variant=default]:active:bg-fuchsia-900
  data-[variant=outline]:border data-[variant=outline]:border-gray-400
  data-[variant=outline]:bg-white data-[variant=outline]:text-gray-900
  data-[variant=outline]:hover:bg-gray-50 data-[variant=outline]:active:bg-gray-100
  data-[variant=ghost]:text-fuchsia-700
  data-[variant=ghost]:hover:bg-fuchsia-50 data-[variant=ghost]:active:bg-fuchsia-100
  data-[size=default]:px-4 data-[size=default]:py-2 data-[size=default]:text-sm
  data-[size=sm]:px-3 data-[size=sm]:py-1 data-[size=sm]:text-xs
  disabled:pointer-events-none
  data-[variant]:disabled:text-gray-400
  data-[variant=default]:disabled:bg-gray-100
  data-[variant=outline]:disabled:bg-gray-100 data-[variant=outline]:disabled:border-gray-200
`.trim().split(/\s+/).join(" ");

export type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant = "default", size = "default", className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      data-variant={variant}
      data-size={size}
      className={className ? `${classes} ${className}` : classes}
    />
  );
}
