/**
 * The one empty state every chart uses, at the same height the chart would
 * have occupied, so a card does not resize when its series is empty.
 */
export default function ChartEmpty({ message, height = 200 }: { message: string; height?: number }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center text-text-muted text-sm text-center px-4"
    >
      {message}
    </div>
  )
}
