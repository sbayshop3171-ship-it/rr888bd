const signalApiBaseUrl = String.fromEnvironment(
	'SIGNAL_API_BASE_URL',
	defaultValue: 'https://rr888bd.site',
);

const signalPollInterval = Duration(seconds: 2);

/// How long before take-off the next round's number is shown. The operator
/// asked for "5–7 seconds before" (2026-09-11); until then the screen counts
/// down to it. Timed on the server's clock, so a phone set wrong does not
/// shift it.
const signalRevealLead = Duration(seconds: 7);

const signalAppVersion = '0.2.4+6';
