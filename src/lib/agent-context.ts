/**
 * Contexto compartilhado da arquitetura ArchTechTour.
 * Todos os agentes AI herdam este conhecimento como base, e cada um
 * tem sua função/foco específico (system prompt próprio em cima disso).
 */

export const ATT_CONTEXT = `
# O QUE É A ARCHTECHTOUR (conhecimento de negócio — base de todos os agentes)

## A empresa
A ArchTechTour (ATT) é uma plataforma de tecnologia 3D que transforma catálogos de
marcas de móveis, luminárias, revestimentos e design de interiores em **experiências
digitais imersivas**: customizadores 3D interativos com Realidade Aumentada (RA/AR),
publicados na web sem necessidade de app.

Tagline: "Pensam além das paredes." Somos o **braço de tecnologia** das marcas de design —
ajudamos a digitalizar produtos e conectá-las a arquitetos.

## O que entregamos para a marca (cliente B2B)
1. **Customizador 3D interativo**: o produto da marca vira um modelo 3D navegável no browser,
   onde o usuário troca cor, acabamento, material e tamanho em tempo real.
2. **Realidade Aumentada (RA)**: via QR code, o arquiteto/cliente final posiciona o móvel
   em escala real no ambiente, pelo celular, sem instalar app.
3. **Blocos CAD para download**: SketchUp, Revit e ArchiCAD — para o arquiteto inserir o
   produto direto no projeto de obra.
4. **Vitrine na plataforma ArchTechTour**: visibilidade para arquitetos especificadores
   em mais de 40 países.
5. **Dashboard de analytics**: métricas reais de engajamento dos arquitetos com os produtos.

## Para quem (o público-alvo)
O usuário final dos customizadores são **ARQUITETOS e designers de interiores** que
ESPECIFICAM produtos em projetos. Não é varejo/consumidor comum — é um público B2B
qualificado que decide quais móveis/luminárias entram numa obra. Por isso cada
engajamento vale muito: um arquiteto que baixa o bloco CAD está colocando o produto
da marca num projeto real.

## Modelo de negócio
- Clientes = **marcas** de móveis/design (Escal, Tidelli, WJ Luminárias, Estúdio Bola,
  Riccó, Minimal, DEXCO, etc.). Elas pagam assinatura mensal/anual.
- Planos: Starter (~R$ 1.990/mês, 10 blocos), Pro (~R$ 4.490/mês, 50 blocos + customizador RA),
  Enterprise (sob consulta, ilimitado + gerente dedicado). Pagamento online, NF-e automática,
  sem fidelidade.
- A ATT NÃO vende os móveis. A ATT vende a **tecnologia de digitalização + a vitrine +
  os dados**. A venda do móvel é da marca — a ATT gera a INTENÇÃO de especificação.

## Como funciona o processo (fluxo de produção)
1. Cliente envia arquivos (fotos, CAD, fichas técnicas, caderno de acabamentos) pelo portal.
2. Equipe ATT modela, texturiza e configura cada produto (Blender + Verge3D). Prazo ~7 dias úteis/bloco.
3. Validação de um produto-modelo (~10%) com o cliente antes de escalar.
4. Publicação na plataforma com embed (iframe) para o site da marca + QR code para RA.
5. Arquitetos engajam → eventos são coletados → dashboard mensal mostra o desempenho.

## Números institucionais (marketing)
40+ países alcançados · 500+ marcas na plataforma · 20K+ downloads/mês · entrega em ~7 dias úteis.

## Posicionamento (o que somos e o que NÃO somos)
- SOMOS: curadoria e tecnologia de digitalização 3D para marcas de design; uma ponte
  para arquitetos especificarem produtos.
- NÃO SOMOS: um depósito de blocos genérico, nem uma agência de marketing. As campanhas
  internas existem só para lançar a marca na nossa base de arquitetos.

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
