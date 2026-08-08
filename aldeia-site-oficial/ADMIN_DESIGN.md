# ALDEIA Admin — QMA Design Contract

## Scope

This design contract applies only to `admin.html` and authenticated administrative surfaces. It does not define or alter the public website.

## Visual language

- Base canvas: `#050505`; elevated steel: `#0A0A0A` and `#141414`.
- Text hierarchy: white at 90% for primary information, 50% for supporting copy, and 45% for metadata.
- Borders: one-pixel white alpha from 8% to 14%. Crimson is reserved for destructive actions.
- Layout rhythm: 8px system with 16px, 24px, and 32px as the primary spacing steps.
- Typography: titles use `clamp()` with tight tracking; operational data uses the existing monospace token.

## Interaction

- Every action target is at least 44px tall.
- Buttons use transform-only motion: `scale(1.02)` on hover and `scale(0.95)` on press.
- Tab entry motion uses only opacity and translateY. Reduced-motion preferences disable nonessential animation.
- Destructive operations require a typed agency name and a second confirmation modal.

## Responsive behavior

- Command cards: 3 columns on wide screens, 2 on medium screens, and 1 on mobile.
- Profile: golden-ratio two-column layout on desktop and one column on smaller screens.
- Administrative tables become labeled stacked cards below 768px and retain horizontal overflow protection.
- Mobile navigation becomes a fixed glass bottom rail; content reserves space below it.

## Reliability

- Each administrative tab owns an isolated error state with retry behavior.
- Metrics render real server values only; loading and empty states never fabricate business data.
- Controls persist through authenticated backend routes, not browser-only storage.

## Access hierarchy

- `Administrador` sees the full command surface, including System, Team, Security, and CMS controls.
- `Operador` receives a reduced navigation tree containing only Dashboard, Orçamentos, and Portfólio.
- Team management is an internal tab inside Configurações; it never adds noise to the global navigation.
- User creation uses a steel-glass modal with visible labels, inline status, strong-password guidance, and 44px actions.
- Role changes and access revocation use a second confirmation step and invalidate the affected user's active sessions.
