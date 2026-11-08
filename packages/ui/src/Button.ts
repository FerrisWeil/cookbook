import {
  createElement,
  type ButtonHTMLAttributes,
  type Ref,
} from "react";

export type ButtonVariant = "primary" | "tonal" | "quiet" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  ref?: Ref<HTMLButtonElement>;
};

export function Button({
  variant = "tonal",
  className,
  type = "button",
  ref,
  ...props
}: ButtonProps) {
  const classes = ["ui-button", `ui-button--${variant}`, className]
    .filter(Boolean)
    .join(" ");
  return createElement("button", { type, className: classes, ref, ...props });
}
