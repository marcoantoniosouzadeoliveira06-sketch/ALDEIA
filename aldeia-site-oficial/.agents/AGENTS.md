# Directives for Stitch Skills & ALDEIA Brand Rules

## Mandatory Stitch Skills Policy
Always proactively utilize the appropriate **Stitch Skills** (located in `.agents/skills/`) whenever working on frontend tasks, design systems, prompts, component migrations, or video generation — **even if the user does not explicitly request them by name**.

### Specific Triggers & Automation Rules:
1. **Design System & Tokens (`taste-design` / `design-md` / `extract-design-md` / `manage-design-system`)**:
   - Whenever creating, auditing, or updating styling/branding, proactively extract or generate `DESIGN.md` and semantic design tokens without prompting.
2. **Prompt Enhancement (`enhance-prompt`)**:
   - Automatically enhance vague UI/UX prompts into structured, high-quality Stitch prompts prior to design generation or editing.
3. **Screen Generation & Code-to-Design (`generate-design` / `code-to-design` / `extract-static-html` / `upload-to-stitch`)**:
   - For all frontend tasks involving new screens, HTML/CSS mockups, or uploading components to Stitch, apply the Stitch design workflow.
4. **React & Component Sync (`react-components` / `react-vite-dashboard` / `react-native` / `shadcn-ui`)**:
   - When building or refactoring React, React Native, Vite, or UI components, follow the Stitch component standards and design token bindings.
5. **Video Generation (`remotion`)**:
   - Whenever asked to generate videos or UI walkthroughs ("faça um vídeo", etc.), automatically utilize the `remotion` skill without needing explicit tool naming.

---

## 🚫 STRICT BRAND RULES FOR ALDEIA

### 1. Mandatory Official Logos Usage
- Whenever placing ALDEIA's brand name or logo in any design, screen, component, or asset, **ALWAYS** use the official ALDEIA logo files:
  - `assets/logo-tp.svg`
  - `logo.svg`
  - `assets/logo-primaria.webp`

### 2. Mandatory Color Palette — ONLY Prata, Cinza, Preto & Branco
- **ALLOWED COLORS ONLY**:
  - **Prata (Silver)**: `#e4e4e7`, `#a8a8a8`
  - **Cinza (Gray)**: `#a1a1aa`, `#52525b`
  - **Preto (Black)**: `#030303`, `#090909`
  - **Branco (White)**: `#ffffff`
- **STRICT VIOLET & PURPLE BAN**:
  - **NEVER** use violet, purple, roxo, or magenta (`#a855f7`, `#c084fc`, `#6b21a8`, etc.) under ANY circumstances. Violet is strictly forbidden in ALDEIA projects.
