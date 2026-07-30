/**
 * Compare serializable submit snapshots. This module deliberately has no DOM,
 * timer, selector, or provider dependencies.
 */
export function compareSubmitSnapshots(before = {}, after = {}) {
  const signals = [];

  if (before.composerHasExpectedText === true &&
      after.composerHasExpectedText === false) {
    signals.push('composer-cleared');
  }

  if ((after.visibleStopCount || 0) > (before.visibleStopCount || 0)) {
    signals.push('stop-button-appeared');
  }

  const beforeAnswerCount = before.answerCount || 0;
  const afterAnswerCount = after.answerCount || 0;
  const beforeAnswerLength = before.latestAnswerLength || 0;
  const afterAnswerLength = after.latestAnswerLength || 0;
  const sameAnswer = !!before.latestAnswerKey &&
    before.latestAnswerKey === after.latestAnswerKey;
  const newAnswer = !!after.latestAnswerKey &&
    after.latestAnswerKey !== before.latestAnswerKey;

  const answerChanged =
    afterAnswerCount > beforeAnswerCount ||
    (sameAnswer && afterAnswerLength > beforeAnswerLength) ||
    (newAnswer && afterAnswerLength > 0);

  if (answerChanged) {
    signals.push('answer-changed');
  }

  return {
    confirmed: signals.length > 0,
    signals,
    evidence: {
      composerChanged: signals.includes('composer-cleared'),
      stopButtonIncreased: signals.includes('stop-button-appeared'),
      answerChanged: signals.includes('answer-changed'),
      composerTextLength: after.composerTextLength || 0,
      visibleStopCount: after.visibleStopCount || 0,
      answerCount: after.answerCount || 0,
      latestAnswerLength: after.latestAnswerLength || 0
    }
  };
}
