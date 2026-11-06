import { createElement, type HTMLAttributes, type ReactNode } from "react";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: "danger" | "info";
};

export function Message({
  children,
  tone = "danger",
  className,
  ...props
}: MessageProps) {
  const classes = ["ui-message", tone === "info" ? "ui-message--info" : "", className]
    .filter(Boolean)
    .join(" ");
  return createElement("div", { role: "status", className: classes, ...props }, children);
}
