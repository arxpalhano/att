/**
 * Contexto compartilhado da arquitetura ArchTechTour.
 * Todos os agentes AI herdam este conhecimento como base, e cada um
 * tem sua função/foco específico (system prompt próprio em cima disso).
 */

export const ATT_CONTEXT = `
# Arquitetura ArchTechTour (conhecimento compartilhado entre os agentes)

A ArchTechTour cria customizadores 3D interativos (Verge3D/Blender) para indústria
de móveis e design. Os produtos são publicados em URLs no padrão:
https://explorar.archtechtour.com/{cliente-slug}/ver-N/{produto-slug}/index.html

## Estrutura de um customizador
Cada customizador é uma pasta no bucket S3 \`explorar.archtechtour.com\` contendo:
- \`index.html\` — página principal, contém estrutura, viewport, botões de download
  (placeholder hardcoded, não confiar) e SCRIPT INLINE de tracking
- \`ui.js\` — configuração específica do produto: opções de customização (texturas/cores)
  e a constante \`MODEL_LINK\` com URLs REAIS dos downloads:
  \`\`\`js
  const MODEL_LINK = {
    'sketchup': 'https://explorar.archtechtour.com/mostra/.../...zip',
    'archicad': 'https://explorar.archtechtour.com/mostra/.../...zip',
    'revit': 'https://explorar.archtechtour.com/mostra/.../...zip',
  }
  \`\`\`
- \`v3d.js\`, \`model.js\` — Verge3D runtime + modelo GLTF/GLB exportado do Blender

## Pipeline de analytics (NOSSA, sem Google)
**IMPORTANTE: NÃO usamos Google Analytics, GA4, Tag Manager, BI, nada de terceiros.**
Toda telemetria é por automação própria que fizemos:

1. Customizador chama \`enviarEventoCustomizador(evento, categoria, rotulo)\` (inline em index.html)
2. POST para API Gateway: \`https://odwlqrkix5.execute-api.us-east-1.amazonaws.com/register-event\`
3. Lambda \`RegistrarEventoCustomizador\` grava JSON em S3 (\`explorar.archtechtour.com/customizador-events/...\`)
4. Lambda \`parquet-monthly-etl\` (cron dia 5) converte JSON → Parquet particionado por \`dt\`
5. Athena (DB \`customizador_events\`, tabela \`eventos_parquet\`) consulta os dados
6. Lambda \`analytics-compute\` (cron dia 10) chama \`/api/analytics/{alias}/refresh\` por cliente
7. Portal exibe dashboard via \`/api/analytics/{alias}\` (alias = código do cliente no \`dim_client_alias\`)

## Padrões a procurar em um customizador (auditoria)
- ✅ **Tracking presente**: index.html contém \`enviarEventoCustomizador\`, \`register-event\` ou \`odwlqrkix5.execute-api\`
- ❌ **NÃO procurar**: GA4, gtag, dataLayer, Google Tag Manager — não usamos
- ✅ **Downloads corretos**: \`MODEL_LINK\` em ui.js com URLs que contenham slug do cliente/produto
- ✅ **Escala bloqueada**: meta viewport com \`user-scalable=no\` e \`maximum-scale=1.0\`
- ✅ **AR funcionando**: \`enter_AR_button_ios\` + arquivo \`model.usdz\` + \`xrButton\` para Android

## Stack do portal (não confundir com customizadores)
- Next.js 14 App Router em Amplify Hosting SSR (sa-east-1)
- DynamoDB us-east-1: tabelas \`att-{blocks,tickets,activities,clients,contracts,publications,users}\`
- Athena us-east-1 para o dashboard analytics
- SSO Microsoft (NextAuth + Azure AD) para admins
- 18 clientes ativos: Escal, Estúdio Bola, Wentz, Minimal, RS Design, Tidelli,
  Hunter Douglas, Docol, Pedro Franco, DEXCO, WJ Luminárias, Christie,
  Cadeiras Rosa, Jader Almeida, Arctefacto, Green House, Persol, Riccó
`;
