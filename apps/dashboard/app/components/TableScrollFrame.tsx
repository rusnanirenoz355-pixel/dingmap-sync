import type { ReactNode } from "react";

interface TableScrollFrameProps {
  children: ReactNode;
  maxHeightClass?: string;
}

export function TableScrollFrame({
  children,
  maxHeightClass = "max-h-[360px] md:max-h-[420px]",
}: TableScrollFrameProps) {
  return (
    <div
      className={`min-w-0 ${maxHeightClass} overflow-x-auto overflow-y-auto`}
      style={{ scrollbarGutter: "stable" }}
    >
      {children}
    </div>
  );
}
