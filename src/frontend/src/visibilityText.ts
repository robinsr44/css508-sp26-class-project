/** User-facing copy for hours the moon is above the horizon (from API `hours_above_horizon`). */
export function hoursAboveHorizonText(hours: number): string {
  const h = Math.round(hours);
  if (h <= 0) return "less than an hour";
  if (h === 1) return "about 1 hour";
  return `about ${h} hours`;
}
