# Importação do "Banco de Produtos" (Notion) → blocos do portal

Executada em **2026-09-02** (723 produtos do Notion → 395 blocos novos, 327 atualizados).
Backups pré-importação em `s3://archtechtour-assets/backups/` (`att-blocks-pre-import-*`,
`att-contracts-*`, `att-publications-*`).

## Como rodar de novo

1. Baixar as páginas do view "Tabela" do Banco de Produtos (Notion MCP, modo `view`,
   `page_size` 100, seguindo `next_cursor`) e salvar como `notion-page-1.json` … `notion-page-N.json`
   ao lado do script. (O modo SQL tem cota no plano atual do workspace; o modo view não.)
2. `aws dynamodb scan` de `att-blocks`, `att-clients`, `att-contracts`, `att-publications`
   para `att-*.json` no mesmo diretório.
3. `python3 import_notion.py` → dry-run com relatório completo e `import-plan.json`.
4. Revisar o relatório. `python3 import_notion.py --apply` grava.

## Regras (também em PORTAL.md §5)

- Marca vem da relação **Projetos** do Notion → cliente do portal por nome normalizado.
  Projetos internos (`.Bugs&Repairs`, `.Produto`…) são pulados.
- Produto **já existe** se, na mesma marca, o slug do "Link atual" bate com uma publicação do
  bloco, ou o nome extraído do código bate com o título do bloco.
- Bloco existente recebe `bim`, `notionUrl/Code/Tech`, `importedAt` e o status mapeado —
  **exceto** quando o portal diz `published` e o Notion está numa etapa anterior: mantém
  `published` e guarda a etapa em `notionTech`. Nunca rebaixa customizador no ar.
- Bloco novo: `sku` = código do Notion, título extraído do código, contrato mais recente da
  marca, `n` sequencial. Se tem link e está publicado/em BIM/em validação final, cria a
  publicação a partir do link.
- Mapa Tech → status: ver `map_status()`.

## O que a Jessica revisa depois

- Blocos com título igual ao código (Notion sem nome legível): filtrar por `sku` numérico
  ou terminado em `E0`.
- Divergências "portal publicado × Notion atrás": campo *Importado do Notion (etapa lá: …)*
  no "Editar bloco".
- Clientes criados a partir do Notion: **Dengo** e **Inkasa** (contratos "Em definição").
- Modelador não veio (usuários convidados do Notion não são resolvíveis pela API) — campo
  editável no bloco.
