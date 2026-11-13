/** "teraz", "12 s temu", "5 min temu", "3 h temu" — do pokazania wieku odczytu. */
export function timeAgo(iso: string | null): string {
  if (!iso) return 'brak odczytów';
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 5) return 'teraz';
  if (sec < 60) return `${sec} s temu`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min temu`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h temu`;
  return `${Math.floor(sec / 86400)} d temu`;
}
