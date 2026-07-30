import { SEND_STAGES } from './send-error-codes.js';

function compactEvidence(evidence = {}) {
  return evidence && typeof evidence === 'object' ? evidence : {};
}

export function createSubmitSuccess({
  provider,
  requestId = null,
  attempt,
  evidence = {}
}) {
  return {
    ok: true,
    provider,
    stage: SEND_STAGES.SUBMIT,
    code: null,
    requestId,
    attempt,
    evidence: compactEvidence(evidence)
  };
}

export function createSubmitFailure({
  provider,
  requestId = null,
  code,
  attempt = 0,
  evidence = {}
}) {
  return {
    ok: false,
    provider,
    stage: SEND_STAGES.SUBMIT,
    code,
    requestId,
    attempt,
    evidence: compactEvidence(evidence)
  };
}
