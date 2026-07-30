/**
 * Turns aggregated mood/music statistics into a short reflective summary.
 *
 * The model is given pre-computed statistics rather than raw entries: it should
 * phrase findings, not derive them. Deriving trends in code keeps the numbers
 * correct and stops the model inventing patterns that are not in the data.
 */
export const buildInsightPrompt = ({
  totalEntries,
  periodDays,
  topMoods,
  moodByTimeOfDay,
  moodByDayOfWeek,
  topGenres,
  efficacy,
  trend,
}) => `You are writing a short, warm weekly reflection for someone using a music wellbeing app. You are not a therapist. Do not diagnose, do not use clinical language, and do not claim music treats anything.

THEIR DATA (last ${periodDays} days, ${totalEntries} check-ins):
- Most frequent moods: ${topMoods.map((m) => `${m.mood} (${m.count}×)`).join(", ") || "not enough data"}
- Overall direction: ${trend}
- By time of day: ${
  Object.entries(moodByTimeOfDay)
    .map(([slot, mood]) => `${slot}: mostly ${mood}`)
    .join(", ") || "not enough data"
}
- Hardest day of week: ${moodByDayOfWeek.hardest ?? "no clear pattern"}
- Easiest day of week: ${moodByDayOfWeek.easiest ?? "no clear pattern"}
- Genres they gravitate to: ${topGenres.join(", ") || "still learning"}
- Sessions where mood improved afterwards: ${
  efficacy.measuredSessions > 0
    ? `${efficacy.improvedSessions} of ${efficacy.measuredSessions}`
    : "not measured yet"
}

WRITE:
{
  "headline": "One sentence, max 12 words, naming the single clearest pattern",
  "summary": "2-3 sentences describing what the data shows, in second person ('you')",
  "observations": ["2-4 specific, concrete observations tied to the numbers above"],
  "suggestion": "One practical, gentle suggestion based on the pattern"
}

RULES:
- Reference only patterns present in the data above. Invent nothing.
- If the data is thin, say so plainly rather than overreaching.
- Never imply causation between listening and mood. Describe co-occurrence.
- Be encouraging without being saccharine. No toxic positivity.
- Return valid JSON only.`;
