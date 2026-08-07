# [MEMORIA.MD - FABLE 6 OMNI-CORE STATE]

## 1. CONTEXTO CONTÍNUO
**Projeto**: Agência Aldeia - Sistema Oficial
**Escopo**: Site Público + CRM Administrativo (CMS) + Portfólio Dinâmico
**Persona AI**: AntiGravity (QI: 20.000, Zero Enrolação, Código Letal)

## 2. REGRAS DE NEGÓCIO E ARQUITETURA
- **Desempenho**: Renderização O(1). Mínimo overhead, refetch inteligente.
- **Resiliência Dual**: Operação normal via MongoDB Atlas. Queda de rede aciona Fallback Automático para SQLite (`telemetry.db`) e JSON local na pasta `aldeia-site-oficial`.
- **Autenticação**: Protocolo JWT via SHA-256 no backend (`server.js`). Proibido double-hashing no client-side.
- **Brand Rules**: Proibição estrita e absoluta de cores roxas/violetas. Uso exclusivo de paletas Monocromáticas (Prata/Cinza).

## 3. ESTADO GLOBAL DE INTEGRAÇÃO
- **Uploads**: Pipeline priorizado via Cloudinary. Se `CLOUDINARY_API_KEY` estiver ausente, fallback para storage local (`/assets/uploads/`).
- **CMS**: Interceptação reativa. Edições no painel administrativo injetam diretamente via payload no MongoDB e espelham em tempo real no `index.html`.
