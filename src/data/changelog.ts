/**
 * Novidades do portal — notas de atualização mostradas na tela "Novidades" e no banner
 * "tem atualização nova" do topo (desde 2026-10-29, pedido do Matheus).
 *
 * ⚠️ REGRA: todo deploy com mudança que alguém vai perceber ganha uma entrada AQUI,
 * no TOPO da lista, no mesmo commit. Escrever para a equipe (não para programador):
 * o que mudou, onde clicar e por quê. Sem nome de arquivo/código.
 *
 * `id` precisa ser único e crescente (data + letra): é o que o banner compara com o
 * último que a pessoa viu. `audience`:
 *   - "equipe": só usuários internos (e terceirizados BIM, quando o item for sobre eles);
 *   - "todos": também aparece para usuários de cliente.
 * Um item pode ter audience própria; sem ela, vale a da entrada.
 */
export type ChangeAudience = "equipe" | "todos" | "terceirizados";
export type ChangeKind = "novo" | "melhorado" | "corrigido";

export interface ChangeItem {
  kind: ChangeKind;
  title: string;
  desc: string;
  audience?: ChangeAudience;
}

export interface ChangeEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  audience: ChangeAudience;
  items: ChangeItem[];
}

export const CHANGELOG: ChangeEntry[] = [
  {
    id: "2026-11-06b",
    date: "2026-11-06",
    title: "Guia em PDF de como colocar o customizador no site",
    audience: "todos",
    items: [
      { kind: "novo", title: "Botão \"Guia em PDF\" em Publicações", desc: "No quadro \"Como colocar o customizador no seu site\", o botão baixa o passo a passo completo em PDF, com imagens, para repassar a quem cuida do site." },
      { kind: "corrigido", audience: "equipe", title: "Downloads e importações de links no histórico", desc: "\"Baixar links (.txt)\" e \"Importar links\" não estavam sendo gravados na tela Atividade. Agora são, junto com o download do guia." },
    ],
  },
  {
    id: "2026-11-06a",
    date: "2026-11-06",
    title: "\"Site do cliente\" virou \"site da marca\" e saiu da visão do cliente",
    audience: "equipe",
    items: [
      { kind: "melhorado", title: "O cliente não vê mais a situação no site dele", desc: "Em Publicações, o usuário de cliente vê só o selo \"Publicado\", as instruções de embed e os links. O quadro \"no ar / ainda não publicados\", o filtro e os selos de situação ficaram só para a equipe, porque é controle nosso de cobrança (e marca sem site cadastrado aparecia toda como \"não publicado\")." },
      { kind: "melhorado", title: "Nome novo: \"site da marca\"", desc: "No Dashboard e em Publicações, \"No site do cliente\" passou a se chamar \"No site da marca\", e o filtro \"Aguardando a marca publicar\"." },
    ],
  },
  {
    id: "2026-11-05a",
    date: "2026-11-05",
    title: "Importar links do bra (S3 de São Paulo)",
    audience: "equipe",
    items: [
      { kind: "corrigido", title: "\"Importar links (.txt)\" aceita os links do bra", desc: "Antes, só os links do explorar.archtechtour.com entravam; os do bra-sao (customizadores antigos ainda embedados nos sites das marcas) eram recusados. Agora entram, e a prévia mostra \"Nova publicação (bra)\"." },
      { kind: "melhorado", title: "Link do bra não apaga o do explorar", desc: "Se o produto já tem link do explorar, o link do bra entra como mais uma publicação do mesmo bloco, em vez de trocar o link. Os dois aparecem em Publicações." },
      { kind: "corrigido", title: "Link do Espelho Heron (Escal)", desc: "Estava com o endereço digitado errado e não abria. Corrigido." },
    ],
  },
  {
    id: "2026-11-04a",
    date: "2026-11-04",
    title: "BIM: o que já foi pago e o que falta pagar",
    audience: "equipe",
    items: [
      { kind: "novo", title: "Aba Pagamentos em BIM · Terceirizados", desc: "Ao lado de Demandas, a aba Pagamentos separa \"A pagar\" (demandas aprovadas ainda não pagas) e \"Pagos\", agrupados por mês e com o total de cada mês. Dá para filtrar por terceirizado e marca." },
      { kind: "novo", title: "Marcar como paga", desc: "Pague uma demanda, várias de uma vez (caixinhas) ou o mês inteiro (\"pagar o mês\"). Informe a data, o valor (já vem preenchido) e uma observação, como \"PIX\". Errou? \"desfazer\" devolve para A pagar." },
      { kind: "novo", title: "Selo no card da demanda", desc: "Cada demanda aprovada mostra \"A pagar\" ou \"Paga em dd/mm\"." },
      { kind: "novo", audience: "terceirizados", title: "Seus pagamentos", desc: "Em Minhas demandas, o quadro Pagamentos mostra o que já foi pago (com a data) e o que está aprovado e falta receber. Cada demanda também tem o selo \"A pagar\" ou \"Paga em dd/mm\"." },
      { kind: "melhorado", title: "Primeira vez: marque o que já foi pago", desc: "As demandas antigas não tinham registro de pagamento, então todas as aprovadas começam em A pagar. Marque as que já foram pagas (dá para selecionar várias) para o extrato ficar certo." },
    ],
  },
  {
    id: "2026-10-29c",
    date: "2026-10-29",
    title: "Link da página do produto no site do cliente",
    audience: "equipe",
    items: [
      { kind: "novo", title: "\"Ver no site do cliente\" em cada publicação", desc: "Em Publicações, quem está no ar no site da marca ganha o link da página exata do produto, para conferir. O portal acha a página lendo o mapa do site da marca e procurando o customizador dentro dela." },
      { kind: "novo", title: "\"Procurar no site\" quando a página não aparece", desc: "Se o site da marca não tem mapa do site ou é montado de um jeito que não dá para ler (caso do Estúdio Bola), o link abre uma busca no Google só dentro do site dela." },
    ],
  },
  {
    id: "2026-10-29b",
    date: "2026-10-29",
    title: "Novidades no portal, pipeline em duas faixas e \"no site do cliente\"",
    audience: "equipe",
    items: [
      { kind: "novo", audience: "todos", title: "Tela de Novidades", desc: "Este menu conta o que mudou em cada atualização do portal. Quando sai algo novo, aparece uma faixa azul no topo com o link para cá; ela some depois que você lê." },
      { kind: "novo", title: "Pipeline em duas faixas", desc: "No Dashboard, a \"Esteira do customizador\" mostra cada bloco uma vez só (a soma dá o total). O BIM saiu do meio da fila e virou a \"Trilha BIM\", embaixo, separada por responsável: Na fila, Danilo, Raquel, Equipe interna. Um bloco que está em programação e em BIM ao mesmo tempo aparece nas duas faixas." },
      { kind: "novo", title: "Card \"Pronto · aguardando BIM\"", desc: "Blocos com o customizador pronto que só esperam o BIM terminar para publicar." },
      { kind: "novo", title: "Publicado dividido em dois: \"só no site ATT\" e \"no site do cliente\"", desc: "O portal descobre sozinho, pelo analytics, em qual site cada customizador foi aberto. Se abriu no site da marca, conta como \"no site do cliente\". Clique no card para ver a lista." },
      { kind: "novo", title: "Cobrança de quem não publicou", desc: "Em Publicações, filtre \"Aguardando o cliente publicar\" e a marca, e use \"Baixar links (.txt)\" para mandar ao cliente. Cada publicação também tem \"Marcar como no site\", para quando o analytics ainda não viu." },
      { kind: "novo", title: "Sites da marca no cadastro do cliente", desc: "Em Clientes → editar, o campo \"Sites da marca\" diz onde procurar. Marca sem site cadastrado não é verificada; a tela de Publicações avisa quais faltam e sugere domínios encontrados." },
    ],
  },
  {
    id: "2026-10-28a",
    date: "2026-10-28",
    title: "Pipeline com números errados corrigido",
    audience: "equipe",
    items: [
      { kind: "corrigido", title: "Portal abria com dados de exemplo", desc: "Na tarde de 28/10 o pipeline mostrou números de exemplo, porque o histórico de atividades ficou grande demais para carregar. Agora o portal carrega os dados mesmo se o histórico falhar, e os números aparecem como \"—\" até o banco responder, em vez de mostrar exemplo." },
      { kind: "corrigido", title: "Financeiro sincronizando sem parar", desc: "A rotina diária do Financeiro repetia a cada 9 minutos e enchia o histórico. Agora roda uma vez por dia." },
    ],
  },
  {
    id: "2026-10-27a",
    date: "2026-10-27",
    title: "ArchTechTour como cliente nos tickets",
    audience: "equipe",
    items: [
      { kind: "novo", title: "Tickets para demandas internas", desc: "Dá para abrir ticket com o cliente \"ArchTechTour\" para trabalhos da própria equipe (ex.: vídeo no site da ATT, analisar material de um possível cliente). Essa marca não aparece em Clientes, Contratos, Financeiro nem nos agentes." },
    ],
  },
  {
    id: "2026-10-23a",
    date: "2026-10-23",
    title: "Filtro por marca no pipeline",
    audience: "equipe",
    items: [
      { kind: "novo", title: "Pipeline por marca", desc: "No Dashboard, o seletor \"Todas as marcas\" no pipeline mostra os números de uma marca só. \"Ver blocos\" já abre a lista filtrada por ela." },
    ],
  },
  {
    id: "2026-10-20a",
    date: "2026-10-20",
    title: "Produção e BIM em paralelo; Revisão Interna vai para a revisora",
    audience: "equipe",
    items: [
      { kind: "corrigido", title: "Revisão Interna não pula mais para o BIM", desc: "Quando a programação marca Revisão Interna, o ticket vai para a revisora (Jéssica), e não para o BIM. Quando ela devolve, volta para quem mandou. O cartão mostra \"enviado por\"." },
      { kind: "novo", title: "Trilhas de produção e BIM", desc: "Cada ticket é da trilha Produção ou BIM, e uma não atropela a outra. Ao criar um ticket, escolha a trilha." },
      { kind: "novo", title: "Aviso de versão nova", desc: "Se o portal for atualizado com a aba aberta, aparece uma faixa amarela pedindo para recarregar, para ninguém trabalhar na versão antiga." },
    ],
  },
  {
    id: "2026-10-19a",
    date: "2026-10-19",
    title: "Financeiro em produção",
    audience: "equipe",
    items: [
      { kind: "novo", title: "Financeiro ligado à conta real do Asaas", desc: "Cobranças, assinaturas, notas e saldo vêm da conta de produção. O portal só lê; nada é alterado no Asaas por aqui." },
      { kind: "novo", title: "Financeiro para o cliente", desc: "Em Usuários, a caixa \"Financeiro\" nas telas liberadas deixa o cliente ver a 2ª via de boletos e as notas dele." },
      { kind: "novo", audience: "todos", title: "Tela Financeiro", desc: "Quem tiver a tela liberada vê a 2ª via das cobranças e as notas fiscais da marca." },
    ],
  },
  {
    id: "2026-10-13a",
    date: "2026-10-13",
    title: "Módulo Financeiro",
    audience: "equipe",
    items: [
      { kind: "novo", title: "Tela Financeiro", desc: "Indicadores, inadimplência e vínculo entre o cliente do Asaas e a marca do portal." },
    ],
  },
];

/** Entradas que essa pessoa vê, só com os itens dela. Cliente vê "todos"; terceirizado, "todos" + "terceirizados". */
export function changelogFor(role: string): ChangeEntry[] {
  const ok = (a: ChangeAudience) =>
    role === "client" ? a === "todos"
    : role === "freelancer_bim" ? a === "todos" || a === "terceirizados"
    : true;
  return CHANGELOG
    .map((e) => ({ ...e, items: e.items.filter((it) => ok(it.audience ?? e.audience)) }))
    .filter((e) => e.items.length > 0);
}
