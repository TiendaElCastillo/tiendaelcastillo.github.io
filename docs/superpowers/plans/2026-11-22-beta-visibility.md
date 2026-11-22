# Refuerzo de visibilidad y aviso de fase beta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar claramente la fase beta y recomendar pedidos pequeños en el acceso, tienda, enlaces compartidos y guías públicas, facilitando que los visitantes compartan la web.

**Architecture:** Mantener la web estática y ligera. Añadir HTML/CSS sin dependencias y reutilizar la función `shareStore()` y el canal de WhatsApp existentes. Actualizar el texto de los metadatos y de las guías actuales; no introducir servicios externos ni cambiar flujos de compra.

**Tech Stack:** HTML, CSS, JavaScript existente, Node.js `node:test`, GitHub Pages, Canva.

**Spec:** `docs/superpowers/specs/2026-11-22-beta-visibility-design.md`

## Global Constraints
- El aviso debe aparecer antes del registro y dentro de la tienda autenticada.
- La frase al cliente debe recomendar pedidos pequeños y evitar compras grandes.
- No revelar precios o paquetes antes del inicio de sesión.
- No mencionar proveedores externos ni prometer entrega inmediata.
- No publicar en redes ni activar anuncios.
- No cambiar pagos, precios, catálogo, autenticación, pedidos, billetera ni Supabase.
- No añadir dependencias ni imágenes pesadas.

## Review Focus
- La advertencia debe verse en móvil sin empujar el formulario de acceso fuera de una zona razonable.
- El botón de compartir debe funcionar en navegadores Android con `navigator.share` y mantener el respaldo de copiar enlace.
- El aviso de la tienda debe quedar fuera de las vistas internas y no desaparecer al cambiar entre catálogo, pedidos y perfil.
- Los metadatos Open Graph, Twitter y descripción normal deben coincidir en el mensaje de beta.
- Las guías públicas deben seguir sin mostrar catálogo ni precios.

---

### Task 1: Pruebas de seguridad y difusión

**Files:**
- Create: `tests/beta-visibility.test.cjs`
- Verify: `tests/beta-visibility.test.cjs`

- [x] **Step 1: Write the failing tests** — assert beta notice before login, persistent notice in the store, beta-safe share text, metadata coverage, public guide warnings, and public share/channel actions.
- [x] **Step 2: Run against main** — six checks fail because the current page lacks the requested visible notice, share CTA, and beta metadata.

### Task 2: Acceso, tienda y difusión orgánica

**Files:**
- Modify: `index.html`
- Test: `tests/beta-visibility.test.cjs`

- [x] **Step 1: Add a compact beta warning** inside `#auth`, before login/register, with the exact recommendation from the spec.
- [x] **Step 2: Add visible share and channel actions** inside the public access view; reuse `shareStore()` and the existing official WhatsApp channel URL.
- [x] **Step 3: Add one compact persistent beta strip** as a sibling of the authenticated views, before `#homeView`.
- [x] **Step 4: Update the share payload** in `shareStore()` to say beta, start small, and avoid large purchases.
- [x] **Step 5: Update description, Open Graph and Twitter descriptions** without changing the page title, canonical URL, analytics scripts or schema markup.
- [ ] **Step 6: Run** `node --test tests/beta-visibility.test.cjs` and `node tests/check-inline-scripts.cjs`.

### Task 3: Guías públicas y revisión final

**Files:**
- Modify: `recargas-juegos-cuba.html`
- Modify: `recargar-free-fire-cuba.html`
- Modify: `recargar-mobile-legends-cuba.html`
- Test: `tests/beta-visibility.test.cjs`

- [x] **Step 1: Update the beta caution copy** in the existing safety section and notice on each public guide.
- [ ] **Step 2: Run** `node --test tests/beta-visibility.test.cjs`, `node --test tests/customer-orders-view.test.cjs`, and `node tests/check-inline-scripts.cjs`.
- [x] **Step 3: Review the diff** to confirm only public copy, lightweight display markup/styles, share text, metadata and tests changed.
- [x] **Step 4: Open a pull request** for review; do not merge or publish without the user's approval.

## Completion checklist
- [x] Beta warning appears on the login/register screen.
- [x] Beta warning remains visible in the authenticated storefront.
- [x] Public visitors can share the store and open the WhatsApp channel.
- [x] Share text and search/social metadata disclose beta status.
- [x] All public guides explicitly recommend small orders and warn against large purchases.
- [ ] Tests and inline-script syntax checks pass.
- [x] No private operational systems or financial settings changed.


## Current execution status (22 Nov 2026)

- Implemented changes: access warning, persistent authenticated-store warning, share and WhatsApp actions, share payload, SEO/social descriptions, and all three public guide warnings.
- Static verification: 11/11 targeted checks passed; three inline scripts parsed successfully.
- Pending: run `node --test tests/beta-visibility.test.cjs`, `node --test tests/customer-orders-view.test.cjs`, and `node tests/check-inline-scripts.cjs` in an environment with the repository available. GitHub DNS resolution failed in this environment, so a local clone and full Node test run could not be completed.
- PR #16 is open as a draft. Do not merge or deploy until automated tests and visual review are complete.
- Canva's revised social graphic is still an unsaved draft; visual preview could not be verified, so it was not committed or published.
