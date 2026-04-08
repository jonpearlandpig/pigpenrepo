import { daysUntil, urgencyFromDays } from "@/lib/utils";

interface CountdownBadgeProps {
  showDate: string;
  large?: boolean;
}

export function CountdownBadge({ showDate, large }: CountdownBadgeProps) {
  const days = daysUntil(showDate);
  const urgency = urgencyFromDays(days);

  const config = {
    critical: { bg: "bg-red-950/60 border-red-800/60", text: "text-red-400", label: days <= 0 ? "TODAY" : `${days}d` },
    warning:  { bg: "bg-orange-950/60 border-orange-800/60", text: "text-orange-400", label: `${days}d` },
    ok:       { bg: "bg-zinc-800 border-zinc-700", text: "text-zinc-300", label: `${days}d` },
    past:     { bg: "bg-zinc-900 border-zinc-800", text: "text-zinc-600", label: "Past" },
  }[urgency];

  return (
    <div className={`inline-flex flex-col items-center justify-center border rounded ${config.bg} ${large ? "px-4 py-2 min-w-[72px]" : "px-2 py-1 min-w-[48px]"}`}>
      <span className={`font-bold leading-none ${config.text} ${large ? "text-2xl" : "text-base"}`}>
        {config.label}
      </span>
      {days !== null && urgency !== "past" && (
        <span className={`leading-none mt-0.5 ${config.text} ${large ? "text-[11px]" : "text-[9px]"}`}>
          {days <= 0 ? "SHOW DAY" : "TO SHOW"}
        </span>
      )}
    </div>
  );
}
