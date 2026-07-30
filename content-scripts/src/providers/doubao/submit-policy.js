export const doubaoSubmitPolicy = Object.freeze({
  confirmationDelayMs: 2500,
  dispatchDelayMs(initialDelay) {
    return Math.max(0, initialDelay || 0);
  }
});
