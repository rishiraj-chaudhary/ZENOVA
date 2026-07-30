/**
 * Mood valence over time, drawn as inline SVG.
 *
 * No charting library: this is one line and some dots, and the app's bundle is
 * already large. Rendered as SVG so it scales cleanly and stays accessible via
 * the text summary beneath it.
 */
const WIDTH = 720;
const HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 28, left: 32 };
const VALENCE_MIN = -2;
const VALENCE_MAX = 2;

const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

const valenceToY = (valence) =>
  PADDING.top +
  PLOT_HEIGHT * (1 - (valence - VALENCE_MIN) / (VALENCE_MAX - VALENCE_MIN));

const indexToX = (index, count) =>
  PADDING.left + (count <= 1 ? PLOT_WIDTH / 2 : (PLOT_WIDTH * index) / (count - 1));

const pointColor = (valence) => {
  if (valence >= 1) return "#34d399";
  if (valence >= 0) return "#60a5fa";
  if (valence >= -1) return "#fbbf24";
  return "#f87171";
};

const formatDay = (isoDate) =>
  new Date(isoDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const MoodChart = ({ series = [] }) => {
  if (series.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        No check-ins yet in this period.
      </p>
    );
  }

  const points = series.map((entry, index) => ({
    ...entry,
    x: indexToX(index, series.length),
    y: valenceToY(entry.averageValence),
  }));

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");

  return (
    <figure className="w-full">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-[320px]"
          role="img"
          aria-label={`Mood trend across ${series.length} days`}
        >
          {[2, 1, 0, -1, -2].map((valence) => (
            <g key={valence}>
              <line
                x1={PADDING.left}
                y1={valenceToY(valence)}
                x2={WIDTH - PADDING.right}
                y2={valenceToY(valence)}
                stroke={valence === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}
                strokeDasharray={valence === 0 ? "none" : "3 4"}
              />
              <text
                x={PADDING.left - 8}
                y={valenceToY(valence) + 4}
                textAnchor="end"
                className="fill-gray-500 text-[10px]"
              >
                {valence > 0 ? `+${valence}` : valence}
              </text>
            </g>
          ))}

          <path d={linePath} fill="none" stroke="url(#moodGradient)" strokeWidth="2.5" />

          <defs>
            <linearGradient id="moodGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>

          {points.map((point) => (
            <circle
              key={point.date}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={pointColor(point.averageValence)}
            >
              <title>{`${formatDay(point.date)}: ${point.dominantMood} (${point.count} check-in${point.count === 1 ? "" : "s"})`}</title>
            </circle>
          ))}

          {points.length > 1 && (
            <>
              <text
                x={points[0].x}
                y={HEIGHT - 8}
                textAnchor="start"
                className="fill-gray-500 text-[10px]"
              >
                {formatDay(points[0].date)}
              </text>
              <text
                x={points.at(-1).x}
                y={HEIGHT - 8}
                textAnchor="end"
                className="fill-gray-500 text-[10px]"
              >
                {formatDay(points.at(-1).date)}
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Screen readers and anyone who cannot parse the chart get the same facts. */}
      <figcaption className="sr-only">
        {points
          .map((point) => `${formatDay(point.date)}: mostly ${point.dominantMood}`)
          .join(". ")}
      </figcaption>
    </figure>
  );
};

export default MoodChart;
