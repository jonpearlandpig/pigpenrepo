interface VenueHealthRingProps {
  score: number;         // 0–100
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function VenueHealthRing({ score, size = 56, strokeWidth = 5, label }: VenueHealthRingProps) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  const color =
    score >= 85
      ? "#22c55e"   // green
      : score >= 60
      ? "#f59e0b"   // amber
      : score >= 30
      ? "#f97316"   // orange
      : "#ef4444";  // red

  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold leading-none" style={{ color }}>{score}%</span>
        {label && <span className="text-[9px] text-zinc-500 mt-0.5">{label}</span>}
      </div>
    </div>
  );
}
