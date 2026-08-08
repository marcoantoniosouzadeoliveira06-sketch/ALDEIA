# Aldeia Design System & Taste Directives (DESIGN.md)

## 1. Visual Atmosphere & Philosophy
- **Brand Identity**: ALDEIA — Agência de Design & Performance Digital de Alto Padrão.
- **Design Philosophy**: Firsight Ultra-Dark Cinematic Glassmorphism. Visual escuro e sofisticado projetado para marcas exigentes que buscam presença digital diferenciada.
- **Density**: `5/10` (Equilibrado, fluido e focado no conteúdo).
- **Variance**: `7/10` (Grid assimétrico, offsets suaves, alto contraste em componentes translúcidos).
- **Motion**: `7/10` (Transições com curva física de mola, preloader lens-focus, custom dual cursor, gooey navigation, gradual blur).

---

## 2. Strict Brand Assets & Logos Rule
- ⚠️ **USO OBRIGATÓRIO DE LOGOS OFICIAIS**: Sempre que for incluir o nome, marca ou identidade da ALDEIA em qualquer tela, componente ou arte, é **OBRIGATÓRIO** utilizar exclusivamente os arquivos de logo oficiais presentes na pasta do projeto:
  - `assets/logo-tp.svg` (Logo transparente vetorizado)
  - `logo.svg` (Vetor oficial)
  - `assets/logo-primaria.webp` (Imagem institucional)

---

## 3. Strict Color Palette & Calibration

### As ÚNICAS Cores Permitidas da ALDEIA
- `Branco Puro (--accent / --text)`: `#ffffff` — Destaque Primário e Texto Principal
- `Prata Metálico (--silver / --accent2)`: `#e4e4e7` / `#a8a8a8` — Detalhes e Linhas Metálicas
- `Cinza Neutro (--text-muted)`: `#a1a1aa` — Texto de Apoio e Subtítulos
- `Cinza Escuro (--text-dim)`: `#52525b` — Metadados e Bordas
- `Preto OLED (--bg)`: `#030303` — Fundo Principal
- `Preto Charcoal (--bg2)`: `#090909` — Fundo Secundário
- `Vidro Escuro (--bg-card)`: `rgba(15, 15, 15, 0.65)` — Superfícies Glassmorphic (`backdrop-filter: blur(16px)`)
- `Borda Metálica (--border)`: `rgba(255, 255, 255, 0.08)` / Hover: `rgba(255, 255, 255, 0.35)`

### Restrições Absolutas de Cor
- 🚫 **STRICTLY BANNED — ROXO E VIOLETA**: É ESTRITAMENTE PROIBIDO usar roxo, violeta ou magenta (`#a855f7`, `#c084fc`, `#6b21a8` ou qualquer tom purpúreo) sob NENHUMA hipótese. Violeta NÃO é cor da ALDEIA.
- 🚫 **BANNED**: Cores primárias puras ou neon descalibrado (vermelho puro `#FF0000`, azul padrão `#0000FF`).
- 🚫 **BANNED**: Fundos claros/brancos no tema principal. O design é estritamente Dark-First (Preto, Prata, Cinza e Branco).

---

## 4. Typographic Architecture

### Famílias de Fontes
- **Display / Headlines (`--font-h`)**: `'Clash Display', sans-serif`
  - Títulos geométricos, marcantes e modernos.
  - Pesos: `500`, `600`, `700`, `900`.
- **Body / Interface (`--font-b`)**: `'Inter', sans-serif`
  - Tipografia neutra e altamente legível para textos longos e UI.
  - Pesos: `300`, `400`, `500`, `600`.
- **Monospace / Metadata (`--font-m`)**: `'Fragment Mono', monospace`
  - Badges técnicos, contadores de seção, tags e códigos.

### Escala Tipográfica
- `H1 / Hero Title`: `clamp(2.5rem, 6vw, 5.5rem)`, `--font-h`, peso `700`, line-height `1.05`, tracking `-0.03em`.
- `H2 / Section Title`: `clamp(2rem, 4vw, 3.5rem)`, `--font-h`, peso `600`, tracking `-0.02em`.
- `H3 / Card Header`: `1.5rem` - `1.75rem`, `--font-h`, peso `600`.
- `Body Text`: `1rem` - `1.125rem`, `--font-b`, line-height `1.6`, cor `var(--text-muted)`.
- `Badges / Tags`: `0.75rem` - `0.875rem`, `--font-m`, uppercase, letter-spacing `0.1em`.

---

## 5. Components & Signature UI Patterns

### Header & Navigation
- **Floating Main Navigation**: Header fixo com fundo `GradualBlur` (`data-strength="3"`).
- **Gooey Nav (`.gooey-nav-container`)**: Menu em formato pill interativo com efeito fluido SVG gooey e texto descriptografando ao passar o cursor (`.decrypt-hover`).
- **Seletor de Idioma & Tema**: Dropdowns em vidro translúcido com borda prata suave e transição fluida.

### Cursor Interativo Customizado
- **Sistema Dual Cursor**:
  - Ponto Central (`#custom-cursor`): Círculo branco `8px` com `mix-blend-mode: difference`.
  - Seguidor Magnético (`#cursor-follower`): Anel externo `36px` com borda `rgba(255, 255, 255, 0.2)` que expande suavemente em elementos clicáveis.

### Preloader & Efeitos de Revelação
- **Preloader Lens-Focus**: Painéis divididos ao meio (`.left-panel`, `.right-panel`) com costura central brilhante prata em gradiente vertical.
- **Granulação de Fundo**: Canvas grain fixo com opacidade `0.08` e blend mode overlay.

### Cards & Grids
- **Superfície Glassmorphism**: `background: rgba(15, 15, 15, 0.65)`, `backdrop-filter: blur(16px)`, `border: 1px solid rgba(255, 255, 255, 0.08)`.
- **Micro-animações de Hover**: Elevação `translateY(-4px)`, borda prata brilhante `rgba(255, 255, 255, 0.35)` e transição fluida em `var(--ease)`.

### Botões & CTAs
- **Botão Primário**: Formato pill (`border-radius: 9999px` ou `12px`), fundo de alto contraste branco ou prata metálico, efeito active scale `0.98`.
- **Links & Text Buttons**: Efeito de texto decrypt ou texto metálico brilhante.

---

## 6. Layout & Responsividade Grid
- **Largura Máxima**: Container `1400px` centralizado com espaçamento lateral responsivo (`clamp(1.5rem, 5vw, 4rem)`).
- **Grids Assimétricos**: Grids de 2 ou 3 colunas com `auto-fit` (`minmax(300px, 1fr)`).
- **Adaptação Mobile (< 768px)**:
  - O cursor customizado é desativado em dispositivos touch.
  - As colunas verticais colapsam em 1 coluna única.
  - O menu navegação passa para versão mobile compacta.

---

## 7. Motion & Spring Physics
- **Curva Suave Primária (`--ease`)**: `cubic-bezier(0.16, 1, 0.3, 1)` — Desaceleração física ultra-suave.
- **Curva Rápida Secundária (`--ease2`)**: `cubic-bezier(0.77, 0, 0.175, 1)` — Transição de entrada/saída ágil.
- **Aceleração por Hardware**: Animações estritamente focadas em `transform`, `opacity` e `filter`.
