import { doubaoSubmitAdapter } from './doubao/adapter.js';

const SUBMIT_ADAPTERS = new Map([
  [doubaoSubmitAdapter.provider, doubaoSubmitAdapter]
]);

export function getSubmitAdapter(provider) {
  return SUBMIT_ADAPTERS.get(provider) || null;
}
