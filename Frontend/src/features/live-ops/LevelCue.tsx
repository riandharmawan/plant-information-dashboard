export function LevelCue({ ratio, blank }: { ratio: number | null; blank: string }) {
  if (ratio == null) return blank
  const percent = Math.min(100, Math.max(0, ratio * 100))
  const tone = percent >= 85 ? 'high' : percent >= 50 ? 'mid' : 'low'
  return (
    <span className={`level-cue level-cue--${tone}`}>
      <span className="level-cue__track" aria-hidden="true">
        <span className="level-cue__fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="level-cue__value">{percent.toFixed(1)}%</span>
    </span>
  )
}
