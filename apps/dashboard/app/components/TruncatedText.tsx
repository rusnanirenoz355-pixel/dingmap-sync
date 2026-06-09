"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";

interface TruncatedTextProps {
  value?: string | null;
  maxLength?: number;
  lineClamp?: 1 | 2 | 3;
  className?: string;
  popoverTitle?: string;
  onExpand?: () => void;
}

export function summarizeText(value: string | null | undefined, maxLength = 80): {
  summary: string;
  isTruncated: boolean;
} {
  const text = String(value ?? "").trim();
  if (!text) {
    return {
      summary: "-",
      isTruncated: false,
    };
  }

  if (text.length <= maxLength) {
    return {
      summary: text,
      isTruncated: false,
    };
  }

  return {
    summary: `${text.slice(0, maxLength).trimEnd()}...`,
    isTruncated: true,
  };
}

export function TruncatedText({
  className = "",
  lineClamp = 2,
  maxLength = 80,
  onExpand,
  popoverTitle = "完整内容",
  value,
}: TruncatedTextProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { summary, isTruncated } = summarizeText(value, maxLength);
  const text = String(value ?? "").trim();
  const lineClampClass = getLineClampClass(lineClamp);
  const textClassName = `${lineClampClass} block min-w-0 flex-1 overflow-hidden break-words text-left text-sm leading-5 ${className}`;

  if (!isTruncated) {
    return <span className={textClassName}>{summary}</span>;
  }

  return (
    <span className="relative flex min-w-0 max-w-full items-start gap-1">
      <span className={textClassName}>{summary}</span>
      <button
        aria-label="展开全文"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-line bg-white text-textSubtle hover:bg-tableHead hover:text-textMain"
        onClick={() => (onExpand ? onExpand() : setIsOpen(true))}
        type="button"
      >
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {isOpen && !onExpand ? (
        <div className="fixed right-4 top-24 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-md border border-line bg-white p-3 text-sm shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
            <span className="min-w-0 truncate font-medium">{popoverTitle}</span>
            <button
              aria-label="关闭全文"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line hover:bg-tableHead"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-textSubtle">
            {text || "-"}
          </div>
        </div>
      ) : null}
    </span>
  );
}

function getLineClampClass(lineClamp: 1 | 2 | 3): string {
  if (lineClamp === 1) {
    return "line-clamp-1 max-h-5";
  }

  if (lineClamp === 3) {
    return "line-clamp-3 max-h-[3.75rem]";
  }

  return "line-clamp-2 max-h-10";
}
