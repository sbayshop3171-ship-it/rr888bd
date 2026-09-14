/** Which door the panel was entered by.

    The panel lives at /admin. Agents are given /agent (or ag.rr888bd.site),
    which `proxy.ts` rewrites onto the same routes — a rewrite, so the
    address bar keeps saying /agent instead of teaching every agent the
    operator's own URL. For that to hold past the first click, the links
    inside the panel have to point back at the door they came through: the
    proxy names it in a request header, `panelBase()` in panel-base-next.ts
    reads it, and `panelHref` below bends each link to match.

    This half is deliberately free of `next/headers` — the nav is a client
    component and needs `panelHref` without dragging a server module into
    the browser bundle, the same split as admin-roles / admin-auth. */

export const PANEL_BASE_HEADER = 'x-panel-base';

export type PanelBase = '/admin' | '/agent';

/** An /admin path, rewritten for the door in use: '/admin/deposits' under
    '/agent' is '/agent/deposits'. Anything not under /admin is left alone. */
export function panelHref(base: PanelBase, href: string): string {
  if (base === '/admin' || !href.startsWith('/admin')) return href;
  return href === '/admin' ? '/agent' : `/agent${href.slice('/admin'.length)}`;
}
