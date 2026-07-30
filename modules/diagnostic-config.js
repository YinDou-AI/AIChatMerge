// Content-script diagnostics master switch.
// The repository source remains enabled for development. package-release.js
// flips this exact line in staging and rebuilds the content bundle.
export const ENABLE_CONTENT_SCRIPT_DIAGNOSTICS = true;
export const ENABLE_PROVIDER_TRANSPORT_DIAGNOSTICS = ENABLE_CONTENT_SCRIPT_DIAGNOSTICS;
export const PROVIDER_TRANSPORT_PROTOCOL_VERSION = 1;
export const PROVIDER_TRANSPORT_BUILD_ID = '1.0.1-transport-1';
