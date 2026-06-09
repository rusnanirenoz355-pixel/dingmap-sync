import type { ReactNode } from "react";

export const TABLE_SCROLL_FRAME_CLASS =
  "min-w-0 max-h-[420px] overflow-x-auto overflow-y-auto";

export const COMPACT_TABLE_SCROLL_FRAME_CLASS =
  "min-w-0 max-h-[360px] overflow-x-auto overflow-y-auto";

export const STICKY_TABLE_HEAD_CLASS =
  "sticky top-0 z-10 bg-tableHead text-textSubtle";

interface TableScrollFrameProps {
  children: ReactNode;
  compact?: boolean;
}

export function TableScrollFrame({
  children,
  compact = false,
}: TableScrollFrameProps) {
  return (
    <div
      className={
        compact ? COMPACT_TABLE_SCROLL_FRAME_CLASS : TABLE_SCROLL_FRAME_CLASS
      }
    >
      {children}
    </div>
  );
}
