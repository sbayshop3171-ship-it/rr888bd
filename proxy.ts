import { NextResponse, type NextRequest } from 'next/server';

/**
 * Two doors to the same panel.
 *
 * Agents are given ag.rr888bd.site, or rr888bd.site/agent, rather than
 * rr888bd.site/admin: the address an agent hands round is not the operator's,
 * and neither door should teach them the operator's own URL. Both are a
 * rewrite rather than a redirect, so the address bar keeps saying what was
 * typed — a redirect put /admin in front of every agent on their first
 * click, which was the whole thing this was meant to avoid.
 *
 * It is one app either way: the panel, its API and its session cookie are
 * the ones already there. The header below tells the layout which door was
 * used, so the links inside point back through it (lib/panel-base.ts).
 */
const AGENT_HOSTS = ['ag.'];

const PANEL_BASE_HEADER = 'x-panel-base';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* /agent, and everything under it, is the panel. The path itself is
     mapped by a rewrite in next.config.mjs — a `NextResponse.rewrite` here
     answers with an absolute `x-middleware-rewrite`, and behind Cloudflare
     that URL comes out as https://localhost:3251/… , an origin nothing is
     listening on, which Next then tries to proxy to and 500s. All this has
     to do is name the door for the layout. */
  if (pathname === '/agent' || pathname.startsWith('/agent/')) {
    return panel(request);
  }

  /* The subdomain's root only. Everything else on that host — /agent/…,
     /api/admin, /_next — is already the right path, and rewriting those
     would turn every asset request into /admin/_next/… and serve nothing. */
  const host = request.headers.get('host')?.toLowerCase() ?? '';
  if (pathname === '/' && AGENT_HOSTS.some((prefix) => host.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.rewrite(url, { request: { headers: withBase(request) } });
  }

  return NextResponse.next();
}

/** Let the request through, carrying the door it came in by. */
function panel(request: NextRequest) {
  return NextResponse.next({ request: { headers: withBase(request) } });
}

function withBase(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PANEL_BASE_HEADER, '/agent');
  return headers;
}

export const config = {
  matcher: ['/', '/agent', '/agent/:path*'],
};
