---
name: "ALDEIA CRM Design System"
colors:
  bg: "#030303"
  sidebar: "#090909"
  card: "#0A0A0A"
  accent: "#e4e4e7"
---

# Design System: ALDEIA CRM
**Project ID:** 

## 1. Visual Theme & Atmosphere
O CRM da ALDEIA segue uma estética brutalista de altíssimo luxo (QMA Architecture). É predominantemente escuro (Preto puro `#030303` a `#090909`), utilizando o contraste extremo com o Prata (`#e4e4e7`) e brancos com diferentes opacidades para gerar hierarquia sem recorrer a cores vibrantes. 
A atmosfera é fria, matemática, precisa e altamente responsiva. A falta de bordas pesadas e o uso de opacidades translúcidas (`rgba(255,255,255,0.12)`) cria um ambiente de software imersivo.

## 2. Color Palette & Roles
### Primary Foundation
- **QMA Preto (Fundo):** `#030303` - O abismo base do site.
- **QMA Preto (Sidebar):** `#090909` - Leve elevação para o menu lateral.
- **QMA Dark Steel (Cards):** `#0A0A0A` - Superfície de containers.

### Accent & Interactive
- **QMA Prata (Accent):** `#e4e4e7` - Usado para botões primários, ícones ativos e destaques importantes.

### Typography & Text Hierarchy
- **Texto Principal:** `rgba(255, 255, 255, 0.90)` - Títulos e dados primários.
- **Texto Secundário (Muted):** `rgba(255, 255, 255, 0.50)` - Legendas, placeholders e dados secundários.

### Functional States
- Sem uso de cores semânticas vibrantes (verde/vermelho). O contraste dita o estado.

## 3. Typography Rules
### Hierarchy & Weights
- **Font Family:** 'Inter', sans-serif. Geométrica, suíça, limpa.
- O sistema aposta no peso tipográfico (font-weight: 300, 400, 500, 600, 700) para criar hierarquia, reduzindo o uso de tamanho exacerbado.

### Spacing Principles
- Baseado no QMA Gap Scale:
  - `--qma-gap-2: 8px;`
  - `--qma-gap-4: 16px;`
  - `--qma-gap-6: 24px;`
  - `--qma-gap-8: 32px;`

## 4. Component Stylings
### Buttons
Raio de borda mínimo, fundos translúcidos ou bordas ultra finas (1px). O hover state aumenta a opacidade ou inverte a cor para prata sólido.

### Cards & Containers
Fundos em `#0A0A0A` com bordas sutis `rgba(255,255,255,0.12)`. Ausência de sombras pesadas (Drop Shadows) em favor de hierarquia por cor.

### Navigation
Sidebar vertical densa (QMA Preto), com ícones minimalistas (svgs) e texto opaco que acende ao hover.

### Inputs & Forms
Fundo escuro, bordas sutis, preenchimento minimalista.

## 5. Layout Principles
### Grid & Structure
Baseado em CSS Flex/Grid com gaps precisos do QMA. Sidebar fixa à esquerda, conteúdo fluindo à direita.

### Whitespace Strategy
Uso generoso de padding interno nos containers para dar respiro aos dados analíticos.

### Alignment & Visual Balance
Alinhamento prioritariamente à esquerda (Left-aligned).

### Responsive Behavior & Touch
Adaptação agressiva para mobile (Sidebar colapsa para bottom-nav ou drawer).

## 6. Design System Notes for Stitch Generation
### Language to Use
"Design sombrio, premium, fundo preto abissal, acentos prata e cinza. Geométrico e luxuoso."

### Color References
Background: #030303. Cards: #0A0A0A. Accent: #e4e4e7.

### Component Prompts
"Crie um card de métrica no estilo ALDEIA, fundo #0A0A0A, borda translúcida 12%, texto principal 90% branco."

### Incremental Iteration
Manter sempre a regra de não usar cores vivas. Confiar na tipografia 'Inter' para organizar a informação.
