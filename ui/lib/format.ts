/** "2h 16m", "2h" or "45m" from minutes: the one duration format used everywhere. */
export const formatRuntime = (m: number) => {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
};

/** "1h 12m left" from a position and duration in seconds. Rounds up so it never reads 0. */
export const timeLeft = (position: number, duration: number) => `${formatRuntime(Math.max(1, Math.ceil((duration - position) / 60)))} left`;
