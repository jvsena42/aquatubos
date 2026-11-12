import { useAppStore } from '../../state/store';

/** Placeholder for the title screen. */
export function HomeScreen() {
  const goToMap = useAppStore((s) => s.goToMap);
  return (
    <div data-placeholder="HomeScreen">
      <button type="button" className="btn btn--primary" onClick={goToMap}>
        Jogar
      </button>
    </div>
  );
}
