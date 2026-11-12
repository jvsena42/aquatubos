import { useAppStore } from '../state/store';

/** Puts the app store back in its initial state, already hydrated unless told otherwise. */
export function resetStore(hydrated = true): void {
  useAppStore.setState({ ...useAppStore.getInitialState(), hydrated }, true);
}
