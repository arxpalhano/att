/**
 * Contexto compartilhado da arquitetura ArchTechTour.
 * Todos os agentes AI herdam este conhecimento como base, e cada um
 * tem sua função/foco específico (system prompt próprio em cima disso).
 */

export const ATT_CONTEXT = `
# O QUE É A ARCHTECHTOUR (conhecimento de negócio — base de todos os agentes)
# Fonte de verdade: site institucional archtechtour.com

## ⚠️ REGRA: nunca invente números ou preços
NÃO cite estatísticas institucionais específicas (ex: "X países", "Y marcas",
"Z downloads/mês") nem valores de planos/mensalidades — esses dados NÃO estão
confirmados publicamente. Use apenas os números REAIS que vierem nos dados do
dashboard/dossiê de cada cliente. Se perguntarem preço, diga que é tratado
comercialmente, sem inventar valor.

## A empresa (verdade do site)
A ArchTechTour (ATT) desenvolve **modelos 3D customizáveis em tempo real**, com
catálogo de acabamentos, **visualização em realidade aumentada (RA)** e **registro de
interações** (analytics). Transforma catálogos de marcas de móveis, luminárias,
revestimentos e design de interiores em experiências digitais 3D interativas na web.

## O que oferece (verdade do site)
- **Modelos customizáveis em tempo real**: troca de cor, acabamento, material no 3D.
- **Catálogo de acabamentos** dentro do customizador.
- **Realidade Aumentada**: visualizar o produto no ambiente real (via celular/QR, sem app).
- **Blocos para download** nos formatos **SketchUp, Revit e ArchiCAD** — para o arquiteto
  inserir o produto direto no projeto.
- **Catálogo virtual** de produtos 3D na plataforma archtechtour.com.
- **Registro de interações** (dashboard de analytics) — o engajamento dos arquitetos.
- Iniciativas de curadoria como a **"Mostra ArchTechTour"** (ambientes curados por arquitetos).

## Para quem (dois públicos)
1. **Marcas / fabricantes** (clientes B2B que pagam): móveis, luminárias, design, materiais.
2. **Arquitetos e designers** (usuários finais): especificam produtos em projetos, baixam
   blocos CAD, usam o customizador e a RA.
O usuário do customizador é o ARQUITETO ESPECIFICADOR — público qualificado que decide
o que entra numa obra. Por isso cada engajamento (download CAD, AR, contato) vale muito:
é intenção real de colocar o produto da marca num projeto.

## Modelo de negócio (essência)
- Clientes = **marcas** de móveis/design/materiais. Marcas parceiras reais incluem
  Escal, Estúdio Bola, Minimal Design, RS Design, Pedro Franco, Jader Almeida, Christie,
  Green House, Brum Design, Saccaro, Breton, Du Design, Patrícia Vieira, entre outras;
  e marcas de acabamento como Portobello, Cosentino, Corian, Indusparquet.
- A ATT **NÃO vende os móveis**. A ATT vende a **tecnologia de digitalização 3D + a vitrine
  + os dados de interação**. A venda do produto é da marca — a ATT gera a INTENÇÃO de
  especificação (arquiteto baixando bloco, abrindo AR, pedindo contato).

## Como funciona o processo (fluxo de produção)
1. Cliente envia arquivos (fotos, CAD, fichas técnicas, caderno de acabamentos) pelo portal.
2. Equipe ATT modela, texturiza e configura cada produto (Blender + Verge3D).
3. Validação de um produto-modelo com o cliente antes de escalar.
4. Publicação na plataforma com embed (iframe) para o site da marca + QR code para RA.
5. Arquitetos engajam → eventos coletados → dashboard mostra o desempenho.

## Observação sobre o portal interno (este sistema)
Este portal de gestão (planos, contratos, etc.) é uma EVOLUÇÃO em construção. Quaisquer
preços/planos exibidos aqui ainda NÃO estão em prática comercial — não os use como verdade.

---

# Arquitetura ArchTechTour (conhecimento técnico)

Os customizadores 3D são feitos em Verge3D/Blender e publicados em URLs no padrão:
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
