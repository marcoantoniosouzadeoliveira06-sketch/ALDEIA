# [BACKEND.MD - TOPOLOGIA E INFRAESTRUTURA]

## 1. NÚCLEO NODE.JS E EXPRESS
- **Host Provider**: Render (Deployment Automatizado via `render.yaml`)
- **Porta**: Dinâmica `process.env.PORT` (Default: 10000 no Render, 3000 Local)
- **Engine**: Node.js (Ambiente Production)

## 2. BANCO DE DADOS E RESILIÊNCIA (TIER 1 & 2)
- **Principal (Nuvem)**: MongoDB Atlas via Mongoose.
  - Coleções: `SiteContentModel`, `ProjectModel`, `ClientModel`.
- **Fallback A (Disco Local)**: Gravação em arquivos JSON rápidos (`site_content.json`, `portfolio.json`). 
- **Fallback B (Logs/Analytics)**: SQLite (`telemetry.db`) para persistir requisições rápidas e telemetria O(1) sem travar threads.

## 3. PROCESSAMENTO DE ATIVOS
- **Cloudinary API**: Armazenamento e otimização de imagens de Portfólio.
- **Multer**: Handler de multipart/form-data. Middleware de limite em `25MB`.

## 4. POLÍTICAS DE SEGURANÇA E CORS
- Auth Token via Bearer JWT.
- Proteção de rotas do CMS (`/api/content`, `/api/portfolio`) contra acessos não autorizados ou espelhamento malicioso.
