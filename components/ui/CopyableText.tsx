"use client";

import { toast } from "sonner";

interface CopyableTextProps {
  /** Text to copy to clipboard. When empty or "—", no copy button is shown. */
  text: string;
  className?: string;
}

const COPY_ICON = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

/**
 * Renders text with a copy button. Clicking the button copies the text to clipboard
 * and shows success/error toast feedback.
 */
export function CopyableText({ text, className = "" }: CopyableTextProps) {
  const hasCopyableContent = text && text !== "—";

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasCopyableContent) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  if (!hasCopyableContent) {
    return (
      <div className={`max-w-[320px] break-words whitespace-normal ${className}`.trim()}>
        —
      </div>
    );
  }

  return (
    <div
      className={`group flex max-w-[320px] items-start gap-1 break-words whitespace-normal ${className}`.trim()}
      title={text}
    >
      <span className="min-w-0 flex-1">{text}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded p-0.5 text-slate-500 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        aria-label="复制"
      >
        {COPY_ICON}
      </button>
    </div>
  );
}
