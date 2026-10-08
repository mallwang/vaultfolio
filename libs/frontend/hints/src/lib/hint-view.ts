import type { Hint } from './hint.js';
import type { HiddenHintState } from './hidden-state.js';
import { isHidden } from './hidden-state.js';

export interface HintBadge {
  count: number;
  label: string;
  dot: boolean;
}

export interface HintView {
  active: readonly Hint[];
  hidden: readonly Hint[];
  badge: HintBadge;
}

export function viewOf(hints: readonly Hint[], state: HiddenHintState): HintView {
  const active: Hint[] = [];
  const hidden: Hint[] = [];
  for (const hint of hints) {
    if (isHidden(state, hint)) {
      hidden.push(hint);
    } else {
      active.push(hint);
    }
  }
  const count = active.length;
  return {
    active,
    hidden,
    badge: {
      count,
      label: count > 9 ? '9+' : String(count),
      dot: count === 0 && hidden.length > 0,
    },
  };
}

export function sortHints(hints: readonly Hint[]): Hint[] {
  return [...hints].sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'warning' ? -1 : 1;
  });
}
