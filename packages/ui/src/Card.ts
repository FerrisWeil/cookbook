import {
  createElement,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

export type CardProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  title: string;
  meta?: ReactNode;
  imageSrc?: string;
  imageAlt?: string;
  onNavigate?: (href: string) => void;
};

export function Card({
  href,
  title,
  meta,
  imageSrc,
  imageAlt,
  onNavigate,
  className,
  onClick,
  ...props
}: CardProps) {
  const classes = [
    "ui-card",
    imageSrc ? "ui-card--with-media" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

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
    imageSrc
      ? createElement(
          "span",
          { className: "ui-card-media" },
          createElement("img", {
            src: imageSrc,
            alt: imageAlt ?? "",
            loading: "lazy",
            decoding: "async",
          }),
        )
      : null,
    createElement(
      "span",
      { className: "ui-card-body" },
      createElement("span", { className: "ui-card-title", title }, title),
      createElement("span", { className: "ui-card-meta" }, meta ?? null),
    ),
  );
}

export function SkeletonCard() {
  return createElement(
    "div",
    { className: "ui-card ui-card--skeleton", "aria-hidden": true },
    createElement(
      "span",
      { className: "ui-card-body" },
      createElement("span", { className: "ui-card-title" }, "\u00a0"),
      createElement(
        "span",
        { className: "ui-card-meta" },
        createElement(
          "span",
          { className: "ui-facts ui-facts--skeleton" },
          createElement("span", { className: "ui-facts-slot" }),
          createElement("span", { className: "ui-facts-slot" }),
          createElement("span", { className: "ui-facts-slot" }),
          createElement("span", { className: "ui-facts-slot" }),
        ),
      ),
    ),
  );
}
