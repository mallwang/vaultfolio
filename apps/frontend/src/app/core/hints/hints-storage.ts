import { Injectable, inject } from '@angular/core';
import {
  type HiddenHintState,
  parseHiddenState,
  serializeHiddenState,
} from '@vaultfolio/frontend-hints';
import { CurrentUserStore } from '../../auth/current-user.store';

const STORAGE_PREFIX = 'vaultfolio.hints-hidden.';

/**
 * T014: Per-user localStorage persistence for hidden-hint state. All reads
 * and writes are best-effort (try/catch) so a storage failure degrades to
 * in-memory-only for the session rather than crashing the shell.
 */
@Injectable({ providedIn: 'root' })
export class HintsStorage {
  private readonly currentUser = inject(CurrentUserStore);

  private get key(): string {
    return `${STORAGE_PREFIX}${this.currentUser.current()?.id ?? 'anonymous'}`;
  }

  load(): HiddenHintState {
    try {
      return parseHiddenState(localStorage.getItem(this.key));
    } catch {
      return parseHiddenState(null);
    }
  }

  save(state: HiddenHintState): void {
    try {
      localStorage.setItem(this.key, serializeHiddenState(state));
    } catch {
      // best-effort: storage quota exceeded or private browsing
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      // best-effort
    }
  }
}
