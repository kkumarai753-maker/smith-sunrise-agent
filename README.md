# Free starter update — 30 October 2026

Daily target: 30 new businesses with both public phone and email. Research is available all day. The daily target resets at midnight Asia/Kolkata. Vercel cron entries are removed; a delayed QStash message starts the next day after target/budget completion. A first manual Start research begins the chain. Queue delivery and retries are required; exact midnight delivery is not guaranteed. Target is not guaranteed.

OpenAI has been removed from research. Category and city keyword checks are conservative; ambiguous businesses are skipped. Named contact stays blank when not verified. Scoring: category match 3, city text match 2, up to 3 HTML improvement signals, email 1, phone 1. Existing priority bands remain unchanged. This measures service fit, not purchasing capacity.

Research-only is the default; SMTP and screenshots are not required. The worker reserves each discovery request in the durable Sheet state before execution, including failed requests. Limits: 30 requests/day and 900/calendar month in IST. A request can return multiple candidates. Other use of the same provider account is outside this counter.

Brave currently advertises $5 monthly Search credits at $5/1,000 requests. Activation needs a card; keep automatic top-ups disabled and verify provider-side usage controls. Its general terms restrict storing search results. Discovery is deliberately gated with SEARCH_STORAGE_RIGHTS_CONFIRMED=false until appropriate rights are established. Do not set it true merely to bypass the gate. Website contacts are extracted directly from inspected pages, not search snippets.

Source updated and locally tested. This package has not been deployed or activated. Live launch still needs the updated Apps Script bridge, Google authorization, secure search credentials with suitable storage rights, hosting and queue/scheduler verification. Existing Google Sheet formatting and remarks are untouched by this local update.

See DEPLOYMENT.md for the earlier infrastructure guide; its OpenAI and outreach requirements apply to the previous version and are superseded above.

Workspace access: root and /index.html are served through an authenticated handler. ADMIN_USERNAME and ADMIN_PASSWORD are required. Dashboard HTML is private in views/, outside public/.
