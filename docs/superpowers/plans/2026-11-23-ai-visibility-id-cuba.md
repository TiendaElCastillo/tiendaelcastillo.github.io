# AI Visibility — Cuba ID Top-Ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing public hub a clear, verifiable answer for searches and assistant questions about game top-ups by player ID from Cuba.

**Architecture:** Improve the existing hub page instead of creating another overlapping URL. Link it to the existing organization entity and its five game-guide pages with accurate structured data. Preserve the customer-only catalog and all purchase flows.

**Tech Stack:** Static HTML, JSON-LD Schema.org, XML sitemap, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-23-ai-visibility-id-cuba-design.md`

## Global Constraints
- Public audience: Spanish-speaking players in Cuba.
- Current games/regions only: Free Fire LATAM; Blood Strike Global; Mobile Legends Global; PUBG Mobile Global; Arena Breakout Mobile Global.
- No game passwords, account credentials, private payment details, package names or prices in public content.
- Mobile Legends requires User ID + Zone ID.
- State that payment is reviewed before recarga authorization and status is checked from customer account.
- Do not promise instant delivery or automatic processing.
- No edits to authentication, product catalog, prices, packages, checkout, payment, wallet, orders, supplier, or Supabase.
- Do not publish to external communities without moderator permission.

## Review Focus
- Schema JSON-LD must parse, and FAQ markup must match visible text.
- No public price/package leakage.
- The five guide URLs and game regions must match the live sitemap and existing pages.
- The new Organization @id must be identical wherever referenced.
- Do not introduce a second, competing central hub.

---

### Task 1: Strengthen the current Cuba ID-top-up hub

**Files:**
- Modify: `recargas-juegos-cuba.html`
- Modify: `sobre-tienda-el-castillo.html`
- Modify: `sitemap.xml`
- Create: `tests/ai-visibility-id-cuba.test.cjs`

**Interfaces:**
- Organization identity: `https://tiendaelcastillo.github.io/#organization`
- Hub page: `https://tiendaelcastillo.github.io/recargas-juegos-cuba.html`
- Game page URLs: the five current canonical game guide URLs.

- [ ] Write a failing Node test asserting the direct answer, accurate game/region inventory, visible FAQs, organization ID linking, valid JSON-LD, sitemap dates, and no public prices/packages.
- [ ] Run `node --test tests/ai-visibility-id-cuba.test.cjs`; it must fail because the new answer block / entity link is not present yet.
- [ ] Add an answer-first section to the top of the hub; it must state that Tienda El Castillo handles ID-based requests for players in Cuba without requiring passwords, and explain reviewed payment plus account-based order tracking.
- [ ] Add visible FAQs that answer which games/regions are supported, what ID data each game needs, how order status is tracked, and what happens when an order cannot be completed.
- [ ] Extend JSON-LD with WebPage publisher, an ItemList of the five guides, and a FAQPage exactly aligned with visible answers.
- [ ] Give the existing Organization node a stable `@id` on the about page; reference it from the hub.
- [ ] Update sitemap `lastmod` for the two changed public pages.
- [ ] Run the focused test and all existing Node tests; verify every JSON-LD block parses and no hidden commerce data is exposed.
- [ ] Commit the SEO-only change and open a PR. Do not merge without checking the diff and tests.

### Task 2: Prepare honest off-site outreach

**Files:**
- Create: `docs/SEO_DIFUSION_CUBA_2026-11-23.md`

- [ ] Prepare one moderator-permission note and one useful resource-share message for the two relevant Cuban gaming communities already recorded in project context.
- [ ] Include the single central hub URL and clarify that the share is from a commercial store.
- [ ] Explicitly record that no group message or post has been sent; moderators must approve first.

## Completion checks
- The existing hub remains the sole main page for the generic query.
- All public statements match verified production behavior and visible FAQ data.
- No commerce flow or Supabase schema/records change.
- Report exact PR/commit/test outcome and any unverified visual details.
