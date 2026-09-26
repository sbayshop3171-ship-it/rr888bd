import type { Metadata, Viewport } from 'next';
import InstallPrompt from '@/components/InstallPrompt';
import { BRAND } from '@/lib/brand';
import './globals.css';

const TITLE = `${BRAND.name} — Online Casino & Cricket Exchange`;
const DESCRIPTION =
  'Bangladesh’s online gaming platform — live casino, slots, cricket exchange, fishing and lottery.';
const SOCIAL_IMAGE = '/social-preview.jpg?v=rr888bd-social-20260914';
const APP_ICON_VERSION = 'apps-logo-20260914-favicon';

export const metadata: Metadata = {
  // Facebook, Messenger and WhatsApp need an absolute og:image URL; without
  // this Next would build it from localhost. The image itself is
  // app/opengraph-image.jpg (and twitter-image.jpg), picked up by file name.
  metadataBase: new URL(`https://${BRAND.domain}`),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: SOCIAL_IMAGE, width: 1254, height: 1254, alt: TITLE }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [SOCIAL_IMAGE] },
  applicationName: BRAND.name,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: `/icons/favicon-32.png?v=${APP_ICON_VERSION}`, sizes: '32x32', type: 'image/png' },
      { url: `/icons/icon-192.png?v=${APP_ICON_VERSION}`, sizes: '192x192', type: 'image/png' },
    ],
    apple: `/icons/apple-touch-icon.png?v=${APP_ICON_VERSION}`,
  },
  // lets iOS run it full-screen once it is on the home screen
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#04211f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const extensionErrorGuard = `
(function () {
  function isBrowserExtensionError(eventOrReason) {
    var message = '';
    var source = '';
    var stack = '';

    if (eventOrReason) {
      message = String(eventOrReason.message || '');
      source = String(eventOrReason.filename || eventOrReason.source || '');

      var reason = eventOrReason.reason || eventOrReason.error || eventOrReason;
      if (reason) {
        stack = String(reason.stack || reason.message || reason || '');
      }
    }

    return source.indexOf('chrome-extension://') === 0 ||
      source.indexOf('moz-extension://') === 0 ||
      stack.indexOf('chrome-extension://') !== -1 ||
      stack.indexOf('moz-extension://') !== -1 ||
      message.indexOf("Cannot read properties of undefined (reading 'M_ID')") !== -1;
  }

  window.addEventListener('error', function (event) {
    if (!isBrowserExtensionError(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    if (!isBrowserExtensionError(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
})();
`;

const installPromptCatcher = `
(function () {
  window.addEventListener('beforeinstallprompt', function (event) {
    // stop Chrome's own mini-infobar; the site shows its own sheet instead
    event.preventDefault();
    window.__skInstallEvent = event;
    window.dispatchEvent(new Event('sk:installable'));
  });
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="extension-error-guard"
          dangerouslySetInnerHTML={{ __html: extensionErrorGuard }}
        />
        <script
          id="install-prompt-catcher"
          dangerouslySetInnerHTML={{ __html: installPromptCatcher }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
