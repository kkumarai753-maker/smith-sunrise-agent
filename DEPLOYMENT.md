# Starter update overrides

Read README.md first. OpenAI and email are not required for the research-only starter. Vercel cron is removed; QStash chains background jobs and delays the next daily run until midnight IST. Target: 30/day. Source and tests are updated, but deployment and live activation remain pending.

# Smith deployment handover

Application deployed to Vercel for review:
https://smith-sunrise-agent.vercel.app

Project: smith-sunrise-agent
Project ID: prj_POeNYl228plawNEI6GmXx5f7uc5j
Team ID: team_o9txygEbf1c6ets4e869wsQo

The current deployment serves a clearly labelled fictional preview. No runtime credentials have been configured. Live research, Sheet sync, team login and email sending are not activated. Vercel may require the owner's account sign-in to access its default deployment domain.

The native Google Sheet has Summary, Leads and Runs tabs, plus two editable charts. It contains no real leads:
https://docs.google.com/spreadsheets/d/1rbhCehmNHJnkkjqhODl14sN9xosfk3si8uYNWusjU_k/edit

## Domain records to add at the current DNS provider

The project has smith.sunrisetechorigin.com attached, awaiting DNS verification. Add only these records; leave mail MX records untouched.

| Type | Host | Value |
| --- | --- | --- |
| CNAME | smith | 064c47593d56586d.vercel-dns-017.com |
| TXT | _vercel | vc-domain-verify=smith.sunrisetechorigin.com,fac144548bda4e928a6e |

After DNS is applied, verify the domain in Vercel. Set APP_ORIGIN to the final verified production URL before research or email is enabled.

## Next setup steps

Follow README.md to deploy the Google Sheet bridge and configure the Vercel server environment. The connected mailbox info@sunrisetechorigin.com was confirmed through the Hostinger connection, but the app needs its own approved sending configuration. The email template is editable under Email campaign and is deliberately unapproved.

The first implementation audits returned website HTML and captures a screenshot. Full visual defect recognition, social profile audits, no-website discovery and delivery/reply integration remain future work. They must not be represented as already active features.

## Verification performed

- Core and workflow tests passed locally.
- Source syntax and Vercel configuration validated.
- Vercel returned READY for the production deployment.
- Native Sheet import, formulas, frozen headers and both chart objects verified through Google Sheets.
- Browser visual/interaction checks were unavailable: the preview relay was absent and the browser runtime could not start. A protected-deployment fetch also failed through the Vercel connector. Do not treat the browser UI or external-provider paths as end-to-end tested.

No email was sent, no real contacts were harvested, and no recurring ChatGPT task was created. The included application cron remains inactive until credentials and research activation are configured.

## Latest outreach revision

Short introductory email only, greeting Hello Sir/Ma’am. Customer emails attach the three company pictures; website audit findings and audit screenshots remain internal. Website/evidence is not required for an introductory send. Signature: info@sunrisetechorigin.com, +91 8766803990, https://sunrisetechorigin.com. The approved brand domain is sunrisetechorigin.com; shortened misspellings must not be substituted. The existing company pictures retain their original printed number; this revision updates the email text signature. The shared Google Sheet has grouped header colours and conditional status/score highlighting; columns and formulas are preserved.

## Daily work window

Research and introductory outreach are limited to 06:00 AM inclusive through 07:30 AM exclusive in Asia/Kolkata, every day. API start, worker claim and SMTP dispatch enforce this window. In-flight HTTP operations are aborted at the deadline and SMTP transport is closed; a message already accepted by the mail provider may arrive later. Progress/shortfalls can be saved after the deadline without starting further research. At 07:30 the stop cron closes the run; every worker also checks the clock, so late cron delivery cannot extend the window. Aborted candidates remain available for the next day. Vercel Hobby cron timing is not minute-precise; activate a suitable scheduler/plan and verify timed runs before promising the 06:00 launch. Provider delays and outages remain possible.
