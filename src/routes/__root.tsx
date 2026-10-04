import { QueryClient, QueryClientProvider, useSuspenseQuery } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useLocation,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { SiteHeader } from "../components/site/SiteHeader";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { siteSettingsQuery } from "../lib/site.functions";
import { DEFAULT_SETTINGS, type SiteSettings } from "../lib/site-settings";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: import("@tanstack/react-router").ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Recibo Memorato" },
      { name: "description", content: "Physical proofs of memories worth keeping." },
      { name: "author", content: "Recibo Memorato by the bitsize sibs" },
      { property: "og:title", content: "Recibo Memorato" },
      { property: "og:description", content: "Because memories need proofs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,600&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  loader: ({ context }) => context.queryClient.ensureQueryData(siteSettingsQuery),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Brand colors chosen in the admin Customize page override the default tokens. */
function themeOverride(s: SiteSettings): string | null {
  const untouched =
    s.colorAccent === DEFAULT_SETTINGS.colorAccent &&
    s.colorPaper === DEFAULT_SETTINGS.colorPaper &&
    s.colorInk === DEFAULT_SETTINGS.colorInk;
  if (untouched) return null;
  return [
    `:root{`,
    `--primary:${s.colorAccent};`,
    `--ring:${s.colorAccent};`,
    `--destructive:${s.colorAccent};`,
    `--background:${s.colorPaper};`,
    `--foreground:${s.colorInk};`,
    `--card:color-mix(in oklab, ${s.colorPaper} 88%, white);`,
    `--popover:var(--card);`,
    `--card-foreground:${s.colorInk};`,
    `--popover-foreground:${s.colorInk};`,
    `--primary-foreground:color-mix(in oklab, ${s.colorPaper} 92%, white);`,
    `--secondary:color-mix(in oklab, ${s.colorPaper} 82%, ${s.colorInk});`,
    `--secondary-foreground:${s.colorInk};`,
    `--muted:color-mix(in oklab, ${s.colorPaper} 88%, ${s.colorInk});`,
    `--muted-foreground:color-mix(in oklab, ${s.colorInk} 72%, ${s.colorPaper});`,
    `--accent:color-mix(in oklab, ${s.colorAccent} 16%, ${s.colorPaper});`,
    `--accent-foreground:${s.colorInk};`,
    `--border:color-mix(in oklab, ${s.colorInk} 24%, ${s.colorPaper});`,
    `--input:var(--border);`,
    `}`,
  ].join("");
}

// Pages that keep their own layout and don't get the public top menu.
const NO_MENU_PREFIXES = ["/admin", "/auth", "/reset-password"];

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { pathname } = useLocation();
  const publicPage = !NO_MENU_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  return (
    <QueryClientProvider client={queryClient}>
      <SiteTheme />
      {publicPage ? <SiteHeader /> : null}
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      {publicPage && pathname !== "/" ? (
        <div className="has-site-chrome">
          <Outlet />
        </div>
      ) : (
        <Outlet />
      )}
    </QueryClientProvider>
  );
}

function SiteTheme() {
  const { data: settings } = useSuspenseQuery(siteSettingsQuery);
  const css = themeOverride(settings);
  return css ? <style>{css}</style> : null;
}
