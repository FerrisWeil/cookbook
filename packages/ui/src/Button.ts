import { createElement, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "tonal" | "quiet" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = "tonal",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = ["ui-button", `ui-button--${variant}`, className]
    .filter(Boolean)
    .join(" ");
  return createElement("button", { type, className: classes, ...props });
}
