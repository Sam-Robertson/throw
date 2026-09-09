import { cn } from "@/lib/utils";
import { isRichTextHtml, sanitizeRichText } from "@/lib/richText";

interface Props {
  value: string;
  className?: string;
  /** Collapse to a few lines. Clamped in CSS — see .rich-text-clamp. */
  clamp?: boolean;
}

/**
 * The single render path for rich text.
 *
 * Sanitizes again here even though the write path already did: landing page
 * bodies were hand-typed HTML long before the editor existed, so rows in the
 * database predate any sanitizing at all.
 *
 * Values that aren't HTML are legacy plain text and are rendered as text with
 * their line breaks preserved — see isRichTextHtml().
 */
export function RichText({ value, className, clamp = false }: Props) {
  const classes = cn("rich-text", clamp && "rich-text-clamp", className);

  if (!isRichTextHtml(value)) {
    return (
      <div className={classes} style={{ whiteSpace: "pre-line" }}>
        {value}
      </div>
    );
  }

  return (
    <div
      className={classes}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }}
    />
  );
}
