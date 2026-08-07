# [DESIGN.MD - TOKENS UI & BRANDING ALDEIA]

## 1. FUNDAÇÕES VISUAIS
- **Tema Central**: Dark Monochrome Glassmorphism
- **Espaçamento**: Grid Estrito de 8px (8, 16, 24, 32, 48, 64)
- **Tipografia**: Escala fluida. Fontes geométricas/modernas sem serifa.

## 2. TOKENS DE CORES (STRICT)
| Token | Cor Hex | Uso |
| --- | --- | --- |
| `primary-dark` | `#030303` | Background principal do app, fundos escuros. |
| `primary-gray` | `#a1a1aa` | Textos secundários, bordas opacas, placeholders. |
| `primary-silver` | `#e4e4e7` | Títulos de alto contraste, botões de ação (Call to Action). |
| `pure-white` | `#ffffff` | Realces de luz, gradientes, ícones puros. |
| **PROIBIDO** | `#a855f7`, `#c084fc` | Cores Violetas/Roxas banidas sob Regras de Marca. |

## 3. MICRO-INTERAÇÕES & GLASSMORPHISM
- **Bordas**: `1px solid rgba(255, 255, 255, 0.05)`
- **Superfície Glass**: `background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(12px);`
- **Animações**: Transições de `300ms ease-in-out` em botões e hover states. Respostas físicas (springs).

## 4. UI COMPONENTS PADRÃO
- **Botões (Primary)**: Fundo `linear-gradient(135deg, #e4e4e7, #030303)`, Texto `#ffffff`, Padding `12px 24px`.
- **Inputs (Forms)**: Fundo `rgba(0,0,0,0.4)`, Borda `#a1a1aa`, Texto `#ffffff`.
