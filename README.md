# ArchTechTour — Portal de Operações

Portal interno e externo para gestão do pipeline de produção 3D.

## Como Rodar (Windows)

1. Instale o **Node.js**: https://nodejs.org (botão verde "LTS")
2. Extraia esta pasta para onde preferir
3. Dê duplo clique em **INICIAR.bat**
4. Acesse **http://localhost:3000** no navegador

## Módulos

- **Dashboard Interno** — Pipeline completo, métricas, atividade
- **Dashboard Cliente** — Blocos contratados/usados/disponíveis
- **Product Blocks** — 15 status com máquina de estados
- **Fila de Trabalho** — Meus itens, backup, sem dono, bloqueados
- **Arquivos/Assets** — 7 categorias, versionamento
- **Readiness Engine** — Validação de completude por tipo de serviço
- **Aprovações** — Material + Final, com histórico
- **Contratos** — Consumo de blocos por contrato
- **Publicação** — URL + embed code
- **Activity Log** — Timeline auditável
- **Clientes** — Overview
- **Usuários** — Gestão de perfis

## Seed Data (já incluído)

- 8 usuários (admin, ops, modelagem, programação, 2 clientes)
- 3 clientes (Verget, Boobam, Haus)
- 3 contratos (100, 30, 10 blocos)
- 19 product blocks em vários estágios
- 16 assets, 5 aprovações, 12 atividades, 2 publicações

## Stack

Next.js 14 · TypeScript · Tailwind CSS · Lucide Icons

## Licença

Proprietário — ArchTechTour © 2025
