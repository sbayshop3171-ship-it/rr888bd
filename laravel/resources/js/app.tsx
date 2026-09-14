import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import SiteLayout from './layouts/SiteLayout';

const appName = import.meta.env.VITE_APP_NAME || 'rr888bd';

const pages = import.meta.glob<{ default: ResolvedComponent }>('./pages/**/*.tsx');

void createInertiaApp({
    title: (title) => (title ? `${title} — ${appName}` : appName),

    resolve: async (name) => {
        const page = await resolvePageComponent(`./pages/${name}.tsx`, pages);

        // Admin screens declare their own chrome; everything else gets the
        // player shell. Setting it here keeps the shell mounted across visits,
        // so the drawer and the toast survive a page change.
        if (!name.startsWith('Admin/')) {
            page.default.layout ??= (children: ReactNode) => <SiteLayout>{children}</SiteLayout>;
        }

        return page.default;
    },
});
