import {
  createElement,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from "react";

export type CardProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  title: string;
  onNavigate?: (href: string) => void;
};

export function Card({ href, title, onNavigate, className, onClick, ...props }: CardProps) {
  const classes = ["ui-card", className].filter(Boolean).join(" ");

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || !onNavigate) {
      return;
    }
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    onNavigate(href);
  }

  return createElement(
    "a",
    { href, className: classes, onClick: handleClick, ...props },
    createElement("span", { className: "ui-card-title" }, title),
    createElement("span", { className: "ui-card-meta" }),
  );
}

export function SkeletonCard() {
  return createElement(
    "div",
    { className: "ui-card ui-card--skeleton", "aria-hidden": true },
    createElement("span", { className: "ui-card-title" }, "\u00a0"),
    createElement("span", { className: "ui-card-meta" }, "\u00a0"),
  );
}
