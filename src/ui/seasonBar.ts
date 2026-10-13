import { addSeasons, currentSeason, seasonLabel } from '../seasons';
import { h } from './dom';

interface SeasonBar {
  element: HTMLElement;
  revealActive(season: string): void;
}

const PAGE_SIZE = 24;
const MAX_PAGES = 12;

export function createSeasonBar(
  activeSeason: string,
  onSelect: (season: string) => void,
): SeasonBar {
  const list = h('div', { className: 'season-list' });
  const chips = new Map<string, HTMLElement>();
  const baseSeason = currentSeason();
  let nextIndex = 0;
  let activeChip: HTMLElement | null = null;

  function appendPage(): void {
    for (let page = 0; page < PAGE_SIZE; page += 1) {
      const season = addSeasons(baseSeason, -nextIndex);
      nextIndex += 1;
      const chip = h('button', {
        className: 'season-chip',
        text: seasonLabel(season),
        attrs: { type: 'button' },
      });
      chip.addEventListener('click', () => onSelect(season));
      chips.set(season, chip);
      list.append(chip);
    }
  }

  function ensureRendered(season: string): void {
    if (season > baseSeason) return;
    let pages = 0;
    while (!chips.has(season) && pages < MAX_PAGES) {
      appendPage();
      pages += 1;
    }
  }

  function setActive(season: string): void {
    ensureRendered(season);
    const chip = chips.get(season);
    if (chip === undefined || chip === activeChip) return;
    activeChip?.classList.remove('is-active');
    chip.classList.add('is-active');
    activeChip = chip;
  }

  function revealActive(season: string): void {
    setActive(season);
    chips.get(season)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  const more = h('button', { className: 'season-more', text: '更早 ↓', attrs: { type: 'button' } });
  more.addEventListener('click', () => appendPage());

  appendPage();
  const track = h('div', { className: 'season-track' }, [list, more]);
  setActive(activeSeason);

  return { element: h('div', { className: 'season-bar' }, [track]), revealActive };
}
