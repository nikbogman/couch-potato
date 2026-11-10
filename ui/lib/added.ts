/** "today", "yesterday", "3 days ago", "last week", "in October", "in Oct 2025": when a title was added, as a list row says it. */
export function addedAgo(at: number, now = Date.now()): string {
  const day = (t: number) => Math.floor(new Date(t).setHours(0, 0, 0, 0) / 86_400_000);
  const days = day(now) - day(at);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  const d = new Date(at);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return sameYear ? `in ${d.toLocaleString("en-GB", { month: "long" })}` : `in ${d.toLocaleString("en-GB", { month: "short" })} ${d.getFullYear()}`;
}
