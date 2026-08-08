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

---

## Fable family (think / act / prove)
- Before any non-trivial multi-step task, apply the fable-method loop; for tasks that will
  run unattended or fan out subagents, use fable-loop.
- After completing substantive work, or whenever any agent/tool claims work is done,
  run a fable-judge pass before presenting it as finished. "Did that actually work?" = fable-judge.


Markdown
# [MASTER SYSTEM ANCHOR] ARQUITETURA QUANTUM MESH (QMA)
**Versão:** 2.0.0 (AntiGravity / Fable 6 Omni-Core)
**Propriedade:** Marco (Japex Designer) / Agência Aldeia
**Paradigma:** Fusão Pentagonal (Apple, Google, Samsung, Figma, Stripe)
**Status de Execução:** MANDATÓRIO. Qualquer desvio destas regras resultará em falha de compilação.

---

## 1. O MANIFESTO DA FUSÃO PENTAGONAL (A FILOSOFIA QMA)

A Arquitetura Quantum Mesh não é um tema; é um motor de renderização comportamental. Ela extrai a força de cinco gigantes globais e elimina suas fraquezas, operando sob estados de matéria mutável.

*   **A Matéria (Apple & Google):** O sistema transita entre **Vidro Inteligente** (Apple Glassmorphism) para imersão visual e **Aço Sólido** (Google Material) para foco cognitivo de alta densidade. O vidro atrai; o aço executa.
*   **O Espaço (Figma & Samsung):** A tela não é paginada, é um **Canvas Infinito** (Figma). Você não navega em páginas, você navega em coordenadas. A ergonomia de ancoragem de controles é estritamente inferior (**Bottom-Heavy** / Samsung), garantindo fadiga zero no rastreio do mouse ou polegar.
*   **A Cinética (Stripe & Apple):** Todo elemento responde à gravidade e inércia (Física de Molas Apple). O feedback de dados e estados de servidor (Loading, Success, Error) é comunicado através de micro-animações a 60FPS e *Mesh Gradients* de borda (Stripe), sem poluir o centro da interface.

---

## 2. MOTOR MATEMÁTICO DE GRID E ESPAÇAMENTO (O CÁLCULO 8PT/4PT)

A interface é uma grade matemática rígida. Valores arbitrários (`13px`, `19px`) são proibidos. Tudo obedece à Base 8, complementada pela Base 4 para refinamento óptico sub-pixel.

### 2.1. Escala Absoluta de Espaçamento (Tokens de Variáveis)

| Token Base | Pixel (px) | REM | Aplicação Estrutural (QMA) | Comportamento CSS/Tailwind |
| :--- | :--- | :--- | :--- | :--- |
| `qma-gap-0.5` | `2px` | `0.125rem` | Borda Stripe, micro-ajuste de ícone dentro de input. | `gap-0.5`, `p-0.5`, `m-0.5` |
| `qma-gap-1` | `4px` | `0.25rem` | Espaço entre um label e seu respectivo input. | `gap-1`, `py-1` |
| `qma-gap-2` | `8px` | `0.5rem` | Padding interno de inputs compactos, badges e tags. | `gap-2`, `p-2` |
| `qma-gap-3` | `12px` | `0.75rem` | Gaps entre itens de listas (Google Density). | `gap-3` |
| `qma-gap-4` | `16px` | `1rem` | **O Padrão Ouro.** Margem interna de botões base e modais. | `gap-4`, `p-4` |
| `qma-gap-6` | `24px` | `1.5rem` | Separação de seções correlatas dentro de um Card de CRM. | `gap-6`, `my-6` |
| `qma-gap-8` | `32px` | `2rem` | Gutter (calha) primária do CSS Grid em Dashboards. | `gap-8`, `p-8` |
| `qma-gap-12` | `48px` | `3rem` | Margem externa de modais flutuantes sobre o Canvas. | `m-12`, `py-12` |
| `qma-gap-16` | `64px` | `4rem` | Separação de blocos hero/marketing (Apple Breathing Room).| `my-16` |
| `qma-gap-24` | `96px` | `6rem` | Zonas de escape verticais para scroll em Canvas Infinito. | `pb-24` |
| `qma-gap-32` | `128px`| `8rem` | Margens de respiro extremo em resoluções 4K/Ultrawide. | `my-32` |

### 2.2. A Regra de Layout Áureo (Golden Ratio 1.618)
Sempre que o layout exigir divisão assimétrica (ex: Painel de Controle Principal + Sidebar de Ferramentas), a divisão **não será** 50/50 ou 70/30. Ela deve obedecer à Proporção Áurea para harmonia cognitiva instantânea.
*   **Fórmula CSS Grid:** `grid-template-columns: minmax(0, 1.618fr) minmax(0, 1fr);`
*   No Tailwind (Aproximação): `grid-cols-[1.6fr_1fr]` ou `w-[62%] w-[38%]`.

---

## 3. TIPOGRAFIA PARAMÉTRICA E ESCALA DE LUZ

O texto é a espinha dorsal do banco de dados do CRM. O controle tipográfico na QMA exige a aplicação simultânea de tamanho, entrelinha (line-height), espaçamento de letras (tracking) e contraste translúcido.

### 3.1. Matriz de Escala Tipográfica Dinâmica
O uso de tipografia requer compensação visual estrita. Fontes gigantescas esmagam as entrelinhas e contraem as letras; fontes minúsculas exigem ar para respirar.

| Semântica | Size (`clamp()`) | Line-Height | Tracking (Letter-Spacing) | Opacidade (Vidro/Aço) |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Display**| `clamp(3rem, 5vw, 4.5rem)` | `1.05` | `-0.04em` (Stripe Tight) | `text-white/100` |
| **H1 (Macro)** | `clamp(2.5rem, 4vw, 3rem)` | `1.10` | `-0.03em` | `text-white/95` |
| **H2 (Section)**| `clamp(2rem, 3vw, 2.25rem)`| `1.15` | `-0.02em` | `text-white/90` |
| **H3 (Card)** | `clamp(1.5rem, 2vw, 1.5rem)` | `1.25` | `-0.01em` | `text-white/85` |
| **H4 (Title)** | `1.25rem` (`20px`) | `1.30` | `0em` | `text-white/80` |
| **Body Large** | `1.125rem` (`18px`) | `1.50` | `0.01em` | `text-white/75` |
| **Body Base** | `1rem` (`16px`) | `1.60` (Respiro) | `0.015em` | `text-white/70` |
| **Body Small** | `0.875rem` (`14px`) | `1.65` | `0.02em` | `text-white/60` |
| **Caption/Tag** | `0.75rem` (`12px`) | `1.50` | `0.04em` (Expandido) | `text-white/50` |

### 3.2. Leis de Aplicação Tipográfica
1.  **Eliminação de Tons de Cinza Sólidos:** É proibido usar códigos como `#888888` ou `text-gray-500` para textos secundários. Todo texto na QMA usa o canal Alpha (`rgba(255,255,255, 0.7)` ou `text-white/70`). Isso permite que o texto "absorva" a cor de fundo (Glassmorphism), integrando-se perfeitamente, não importa se o fundo é preto ou um vídeo vibrante.
2.  **Balanço Óptico (Text-Wrap):** Todo bloco de texto (H1 a H3) que pode quebrar em duas linhas deve obrigatoriamente usar a propriedade CSS `text-wrap: balance;` para evitar órfãs grotescas no design e manter a simetria centralizada ou alinhada à esquerda perfeitamente equilibrada.

---

## 4. O CÓDIGO DA MATÉRIA: VIDRO E AÇO (TOKENS DE SUPERFÍCIE)

A interface alterna entre dois estados físicos. A implementação CSS destes estados é inquebrável.

### 4.1. O Vidro Inteligente (Apple / Imersão)
Usado em backgrounds globais, modais flutuantes não-críticos, e sobreposições de mídia (Portfólio / Homepage).
*   **Renderização Exigida:** Requer mistura de cores de base ultraleves, desfoque de fundo pesado, e saturação aumentada para evitar aspecto de "plástico embaçado".

```css
/* Protocolo CSS: QMA Smart Glass */
.qma-glass {
  background-color: rgba(255, 255, 255, 0.03); /* Fundo quase imperceptível */
  backdrop-filter: blur(24px) saturate(160%); /* Desfoque alto + Injeção de cor do fundo */
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.08); /* Borda Stripe micro-fina (1px) */
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4); /* Elevação de ambiente difusa */
}
4.2. O Aço Escuro (Google / Densidade de Dados)
Usado nos editores CMS, tabelas do CRM, formulários massivos e modais de missão crítica. Aqui, a leitura do administrador é mais importante que a estética de fundo.

Renderização Exigida: Zero desfoque. O processamento da GPU cai para O(1). A elevação é definida por sombras duras e direcionais (Material Elevation).

CSS
/* Protocolo CSS: QMA Dark Steel */
.qma-steel {
  background-color: #0A0A0A; /* Superfície de fundo sólido profundo */
  border: 1px solid rgba(255, 255, 255, 0.12); /* Contorno rígido */
  /* Sombra tripla Google Material 3 (Ambient + Direcional) */
  box-shadow: 
    0px 1px 2px 0px rgba(0, 0, 0, 0.3),
    0px 2px 6px 2px rgba(0, 0, 0, 0.15),
    0px 4px 12px rgba(0, 0, 0, 0.5);
}
4.3. Malhas Fotônicas (Stripe Mesh Edge-Lighting)
Aplicações de status (Sucesso/Erro) nas bordas de botões e cards sem poluir o interior.

CSS
/* Efeito QMA: Borda Radiante de Sucesso (Stripe DNA) */
.qma-edge-success {
  position: relative;
  border-radius: inherit;
}
.qma-edge-success::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(16,185,129,0.5), rgba(16,185,129,0.1) 50%, transparent);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
/* Halo interno opcional para foco */
.qma-edge-success:focus-within {
  box-shadow: inset 0 0 0 1px rgba(16,185,129,0.2), 0 0 20px rgba(16,185,129,0.15);
}
5. FÍSICA CINÉTICA E MICRO-INTERAÇÕES (MOTION PROTOCOL)
Os elementos da QMA não desaparecem ou mudam de cor instantaneamente como num software obsoleto; eles reagem às leis da física simulada. A gravidade digital.

5.1. Curvas de Aceleração (Cubic-Bezier)
Substitua todos os ease-in-out padrão do CSS por matrizes de Bezier exatas:

--qma-spring: cubic-bezier(0.16, 1, 0.3, 1); -> Física de Molas (Apple). Usado para Hover States (ao passar o mouse, o card sobe rápido e freia suavemente).

--qma-morph: cubic-bezier(0.4, 0.0, 0.2, 1); -> Metamorfose (Google). Usado para Shared Elements (Quando um ícone pequeno expande para virar um modal na tela inteira).

--qma-snap: cubic-bezier(0.2, 0.8, 0.2, 1); -> Clique Tátil (Stripe). Usado no Active State (Ao clicar em um botão, a contração de escala de 100% para 95% ocorre em menos de 100ms, simulando o peso de uma tecla mecânica real).

5.2. Pipeline de Interação de Botão O(1) (React/Tailwind)
Abaixo, o bloco de código que condensa a física do Módulo 5 em um átomo React. Todo botão no sistema deve ser derivado desta arquitetura:

TypeScript
// Componente: QMAButton.tsx (Atomic Core)
import React from 'react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utilitário para fundir classes Tailwind sem conflito de herança
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'glass' | 'steel' | 'accent';
  status?: 'idle' | 'loading' | 'success' | 'error';
}

export const QMAButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'steel', status = 'idle', children, ...props }, ref) => {
    
    // Base 8pt, Tipografia Paramétrica, e Física Spring/Snap acoplada via Arbitrary Variants
    const basePhysics = "relative inline-flex items-center justify-center font-medium select-none overflow-hidden rounded-xl transition-all duration-[300ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.96] active:duration-[75ms] disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      glass: "qma-glass text-white/90 hover:text-white hover:bg-white/10",
      steel: "qma-steel text-white hover:bg-[#151515]",
      accent: "bg-white text-black hover:bg-neutral-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]",
    };

    return (
      <button
        ref={ref}
        disabled={status === 'loading'}
        className={cn(basePhysics, variants[variant], "px-6 py-3 text-sm tracking-[0.01em]", className)}
        {...props}
      >
        {/* Camada de Micro-Motion (Loading Stripe) */}
        <span className={cn("absolute inset-0 flex items-center justify-center transition-opacity duration-300", 
          status === 'loading' ? 'opacity-100' : 'opacity-0'
        )}>
          <svg className="animate-spin h-5 w-5 text-current" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
        
        {/* Camada de Dados (Fades out when loading) */}
        <span className={cn("transition-opacity duration-300", 
          status === 'loading' ? 'opacity-0' : 'opacity-100'
        )}>
          {children}
        </span>
      </button>
    );
  }
);
QMAButton.displayName = "QMAButton";
6. ARQUITETURA DE DADOS E FORMULÁRIOS (O PADRÃO ALDEIA)
Os formulários de CRM (Upload de Portfólio, Cadastro de Leads) devem ser construídos não como páginas web antigas, mas como modais de sistema operacional (Mac OS / iOS nativos).

6.1. O Input QMA (A Metáfora da Superfície Afundada)
O input não é uma caixa desenhada; é um "recorte" na superfície onde o usuário injeta o dado.

TypeScript
// Componente: QMAInput.tsx
export const QMAInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-lg bg-black/40 border border-white/10 px-4 py-2 text-sm text-white/90 shadow-inner",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "placeholder:text-white/30",
          "focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 focus:bg-black/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
QMAInput.displayName = "QMAInput";
6.2. Regra de Formulários Massivos (Grid Dinâmico)
Um formulário com 10 campos no CRM não pode ser empilhado numa lista infinita.

A Execução: Use grid grid-cols-12 gap-6.

Campos curtos (Data, Telefone) ocupam col-span-6 ou col-span-4.

Campos expansivos (Nome Completo, E-mail, Título do Projeto) ocupam col-span-12.

Labels devem flutuar acima do input ou permanecer com text-white/50 text-xs font-semibold uppercase tracking-widest colados 4px (gap-1) acima do campo.

7. FÍSICA APLICADA DE ROTEAMENTO (SPA E SHARED ELEMENTS)
Não existe "recarregar a página" (F5) na QMA. O Front-end é amarrado por transições de desmontagem.

7.1. Transição de Rota (Framer Motion Core)
Todo o conteúdo central da aplicação deve estar envolvido em um AnimatePresence. A página que sai desbota e cai sutilmente; a página que entra desbota e sobe sutilmente.

TypeScript
// Exemplo de Injeção de Roteamento Animado
import { motion, AnimatePresence } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 16, filter: 'blur(10px)' },
  in: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  out: { opacity: 0, y: -16, filter: 'blur(10px)', transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }
};

export const PageTransition = ({ children, routeKey }) => (
  <AnimatePresence mode="wait">
    <motion.div
      key={routeKey}
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  </AnimatePresence>
);
8. OVERRIDE DE DIRETRIZES FINAIS DO SISTEMA ANTIGRAVITY
Eu, AntiGravity (Omni-Core), absorvo este manifesto de forma irrevogável.
A partir deste ponto na timeline de contexto:

Qualquer código CSS/Tailwind gerado por mim utilizará as métricas de 8px, Proporção Áurea e as cores translúcidas de text-white/[alpha].

Toda estrutura visual exigida por Japex ou pela Agência Aldeia será automaticamente elevada para operar com a Quantum Mesh Architecture, independentemente se o pedido original continha designs inferiores ou rasos.

A densidade de dados e as malhas fotônicas (Stripe) serão injetadas autonomamente em tabelas e modais do MongoDB/CRM.