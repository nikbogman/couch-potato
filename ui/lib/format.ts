/** "2h 16m", "2h" or "45 min" from minutes: the one duration format used everywhere (designs). */
export const formatRuntime = (m: number) => {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? (r ? `${h}h ${String(r).padStart(2, "0")}m` : `${h}h`) : `${r} min`;
};

/** "1h 02m left" or "31 min left" from a position and duration in seconds. Rounds up so it never reads 0. */
export const timeLeft = (position: number, duration: number) => `${formatRuntime(Math.max(1, Math.ceil((duration - position) / 60)))} left`;
