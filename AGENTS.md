<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Site customization
- Customizable site texts, brand name, and colors live in the `site_settings` table (single row), edited at /admin/customize. Read via `siteSettingsQuery` (never throws — falls back to `DEFAULT_SETTINGS` in src/lib/site-settings.ts). Brand colors override CSS tokens through the `<style>` injected in `src/routes/__root.tsx` (skipped while colors equal defaults). *stars* in stored text render as italic.
- Homepage sections and photos are stored in the same settings row as structured content, normalized against defaults for backwards compatibility; owner-uploaded images stay in private storage and are delivered by the public image route so a public bucket is unnecessary.
