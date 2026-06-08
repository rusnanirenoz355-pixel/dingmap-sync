interface TruncatedTextProps {
  value?: string | null;
  maxLength?: number;
  className?: string;
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
  maxLength = 80,
  onExpand,
  value,
}: TruncatedTextProps) {
  const { summary, isTruncated } = summarizeText(value, maxLength);
  const baseClassName = `line-clamp-2 min-h-10 max-w-full text-left text-sm leading-5 ${className}`;

  if (!isTruncated || !onExpand) {
    return <span className={baseClassName}>{summary}</span>;
  }

  return (
    <button
      className={`${baseClassName} rounded-sm underline-offset-2 hover:underline`}
      onClick={onExpand}
      title={String(value ?? "")}
      type="button"
    >
      {summary}
    </button>
  );
}
