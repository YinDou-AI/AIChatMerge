import { describe, expect, it } from 'vitest';

import { compareSubmitSnapshots } from '../content-scripts/src/submission/submit-snapshot.js';

const baseline = {
  composerHasExpectedText: true,
  composerTextLength: 12,
  visibleStopCount: 1,
  answerCount: 1,
  latestAnswerKey: 'answer-1',
  latestAnswerLength: 10
};

describe('compareSubmitSnapshots', () => {
  it('does not confirm unchanged state, including a stale stop control', () => {
    expect(compareSubmitSnapshots(baseline, { ...baseline })).toEqual(
      expect.objectContaining({ confirmed: false, signals: [] })
    );
  });

  it.each([
    [{ ...baseline, composerHasExpectedText: false, composerTextLength: 0 }, 'composer-cleared'],
    [{ ...baseline, visibleStopCount: 2 }, 'stop-button-appeared'],
    [{ ...baseline, latestAnswerLength: 20 }, 'answer-changed'],
    [{
      ...baseline,
      answerCount: 2,
      latestAnswerKey: 'answer-2',
      latestAnswerLength: 3
    }, 'answer-changed']
  ])('confirms a new transition with %s', (after, signal) => {
    const result = compareSubmitSnapshots(baseline, after);
    expect(result.confirmed).toBe(true);
    expect(result.signals).toContain(signal);
  });
});
