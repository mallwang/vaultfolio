export type { Hint, HintSeverity, HintTarget } from './lib/hint.js';
export type { HintProvider, HintProviderContribution } from './lib/hint-provider.js';
export type { HiddenHintState, HiddenEntry } from './lib/hidden-state.js';
export type { HintView, HintBadge } from './lib/hint-view.js';
export { hintSignature } from './lib/hint-signature.js';
export {
  isHidden,
  hide,
  restore,
  purgeStale,
  parseHiddenState,
  serializeHiddenState,
} from './lib/hidden-state.js';
export { viewOf, sortHints } from './lib/hint-view.js';
export { hintTestId } from './lib/hint-test-id.js';
