function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function shiftSeason(season: string, months: number): string {
  const [yearText = '0', monthText = '1'] = season.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1 + months;
  const date = new Date(year, monthIndex, 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function currentSeason(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  if (month >= 3 && month <= 5) return `${now.getFullYear()}-03`;
  if (month >= 6 && month <= 8) return `${now.getFullYear()}-06`;
  if (month >= 9 && month <= 11) return `${now.getFullYear()}-09`;
  // 冬季从 12 月开始：12 月属于当年，1、2 月属于上一年
  const year = month === 12 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-12`;
}

export function addSeasons(season: string, delta: number): string {
  return shiftSeason(season, delta * 3);
}

export function seasonStart(season: string): string {
  return `${season}-01`;
}

export function seasonEnd(season: string): string {
  return `${addSeasons(season, 1)}-01`;
}

export function seasonLabel(season: string): string {
  const [yearText = '', monthText = ''] = season.split('-');
  const year = Number(yearText);
  switch (Number(monthText)) {
    case 3:
      return `${year} 年春季`;
    case 6:
      return `${year} 年夏季`;
    case 9:
      return `${year} 年秋季`;
    case 12:
      return `${year + 1} 年冬季`;
    default:
      return `${year} 年${monthText}月`;
  }
}
