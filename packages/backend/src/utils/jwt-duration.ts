const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};

export function getJwtDurationSeconds(value: string | undefined): number {
  const duration = value || "3600";
  const match = duration.match(/^(\d+)([smhd])?$/);

  if (!match) {
    return 3600;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  return amount * (unit ? UNIT_SECONDS[unit] : 1);
}
