/**
 * Formats an ISO datetime string into a local date string with Japanese day of the week.
 * Example: "2026-05-20T14:00:00Z" -> "2026/05/20 (水)"
 */
export const formatLocalDateWithDay = (isoString: string | null): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const weekday = weekdays[date.getDay()];

    return `${year}/${month}/${day} (${weekday})`;
  } catch (error) {
    return '';
  }
};

/**
 * Formats an ISO datetime string into local time.
 * Example: "2026-05-20T14:30:00Z" -> "23:30"
 */
export const formatLocalTime = (isoString: string | null): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes}`;
  } catch (error) {
    return '';
  }
};

/**
 * Formats a duration in seconds into a human-readable Japanese string (hours and minutes).
 * Example: 27000 -> "7時間30分" (or "0時間45分", or "0分" if less than 60 seconds)
 */
export const formatDurationJapanese = (seconds: number): string => {
  const totalMinutes = Math.floor(seconds / 60);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hrs > 0) {
    return `${hrs}時間${mins}分`;
  }
  return `${mins}分`;
};
