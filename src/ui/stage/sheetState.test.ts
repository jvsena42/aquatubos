import {
  FLICK_VELOCITY,
  initialSheetState,
  nextDetent,
  releaseVelocity,
  sheetReducer,
  snapDetent,
  type SheetState,
} from './sheetState';

const at = (detent: SheetState['detent'], section: SheetState['section'] = 'calc'): SheetState => ({
  detent,
  section,
});

describe('sheetReducer', () => {
  it('starts closed', () => {
    expect(initialSheetState.detent).toBe('peek');
  });

  it('cycles peek → half → full → peek with the handle', () => {
    expect(nextDetent('peek')).toBe('half');
    let state = at('peek');
    const seen = [];
    for (let i = 0; i < 4; i++) {
      state = sheetReducer(state, { type: 'cycle', hasSelection: true });
      seen.push(state.detent);
    }
    expect(seen).toEqual(['half', 'full', 'peek', 'half']);
  });

  it('opens on the calculation with a selection and on the checks without one', () => {
    expect(sheetReducer(at('peek', 'checks'), { type: 'cycle', hasSelection: true })).toEqual(
      at('half', 'calc'),
    );
    expect(sheetReducer(at('peek', 'calc'), { type: 'cycle', hasSelection: false })).toEqual(
      at('half', 'checks'),
    );
    expect(
      sheetReducer(at('peek', 'calc'), { type: 'snap', detent: 'full', hasSelection: false }),
    ).toEqual(at('full', 'checks'));
  });

  it('keeps the section when the sheet is already open', () => {
    expect(sheetReducer(at('half', 'checks'), { type: 'cycle', hasSelection: true })).toEqual(
      at('full', 'checks'),
    );
    expect(
      sheetReducer(at('full', 'checks'), { type: 'snap', detent: 'half', hasSelection: true }),
    ).toEqual(at('half', 'checks'));
  });

  it('collapses to peek', () => {
    expect(sheetReducer(at('full', 'checks'), { type: 'collapse' })).toEqual(at('peek', 'checks'));
    const closed = at('peek');
    expect(sheetReducer(closed, { type: 'collapse' })).toBe(closed);
  });

  it('switches the section', () => {
    expect(sheetReducer(at('half', 'calc'), { type: 'section', section: 'checks' })).toEqual(
      at('half', 'checks'),
    );
  });

  it('rises to half with the calculation when an element is selected', () => {
    expect(sheetReducer(at('peek', 'checks'), { type: 'selected' })).toEqual(at('half', 'calc'));
  });

  it('does not shrink an open sheet on a selection', () => {
    expect(sheetReducer(at('full', 'checks'), { type: 'selected' })).toEqual(at('full', 'calc'));
    expect(sheetReducer(at('half', 'calc'), { type: 'selected' })).toEqual(at('half', 'calc'));
  });

  it('shows the checks at half after a failed verification', () => {
    expect(sheetReducer(at('peek', 'calc'), { type: 'verified', passed: false })).toEqual(
      at('half', 'checks'),
    );
    expect(sheetReducer(at('full', 'calc'), { type: 'verified', passed: false })).toEqual(
      at('full', 'checks'),
    );
  });

  it('gets out of the way of the map after a passed verification', () => {
    expect(sheetReducer(at('peek', 'calc'), { type: 'verified', passed: true })).toEqual(
      at('peek', 'calc'),
    );
    expect(sheetReducer(at('half', 'calc'), { type: 'verified', passed: true })).toEqual(
      at('peek', 'calc'),
    );
  });
});

describe('snapDetent', () => {
  const heights = { peek: 64, half: 400, full: 760 };

  it('goes to the nearest detent on a slow release', () => {
    expect(snapDetent(100, 0, heights)).toBe('peek');
    expect(snapDetent(240, 0, heights)).toBe('half');
    expect(snapDetent(500, 0.1, heights)).toBe('half');
    expect(snapDetent(600, -0.1, heights)).toBe('full');
    expect(snapDetent(760, 0, heights)).toBe('full');
  });

  it('goes to the next detent in the direction of a flick', () => {
    expect(snapDetent(100, FLICK_VELOCITY, heights)).toBe('half');
    expect(snapDetent(420, 1.2, heights)).toBe('full');
    expect(snapDetent(700, -1.2, heights)).toBe('half');
    expect(snapDetent(380, -FLICK_VELOCITY, heights)).toBe('peek');
  });

  it('stays at the ends when a flick has nowhere further to go', () => {
    expect(snapDetent(760, 2, heights)).toBe('full');
    expect(snapDetent(64, -2, heights)).toBe('peek');
  });

  it('copes with a half detent as tall as the full one', () => {
    const short = { peek: 64, half: 300, full: 300 };
    expect(snapDetent(200, 1, short)).toBe('half');
    expect(snapDetent(300, 0, short)).toBe('half');
  });
});

describe('releaseVelocity', () => {
  it('is positive while the finger goes up and negative going down', () => {
    expect(
      releaseVelocity([
        { time: 0, y: 500 },
        { time: 50, y: 450 },
      ]),
    ).toBe(1);
    expect(
      releaseVelocity([
        { time: 0, y: 500 },
        { time: 50, y: 520 },
      ]),
    ).toBe(-0.4);
  });

  it('only counts the last 100 ms, so a pause before lifting is not a flick', () => {
    expect(
      releaseVelocity([
        { time: 0, y: 600 },
        { time: 40, y: 300 },
        { time: 400, y: 300 },
        { time: 450, y: 300 },
      ]),
    ).toBe(0);
  });

  it('is zero without movement samples', () => {
    expect(releaseVelocity([])).toBe(0);
    expect(releaseVelocity([{ time: 10, y: 100 }])).toBe(0);
  });
});
