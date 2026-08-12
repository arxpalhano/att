#!/usr/bin/env python3
"""
Gera o dim_produto_cliente: mapa produto -> cliente para o analytics.

## Por que isso existe

A view `vw_eventos_base_com_cliente` descobre o dono de um evento pelo PREFIXO do
campo `produto` (`regexp_extract(produto, '^([^-_ ]+)', 1)`), casando com
`dim_client_alias`. Mas o `produto` vem de um atributo no HTML de cada
customizador, preenchido à mão — e muitos não têm o prefixo do cliente:

    "Tidelli-Cadeira-Cb-Caraiva"  -> alias "tidelli" -> Tidelli          ✅
    "Cadeira Office Soul"         -> alias "cadeira" -> "cadeira"        ❌ (é da Escal)
    "Mesa Auxiliar Mary"          -> alias "mesa"    -> "mesa"           ❌ (é da Escal)

Esses eventos sumiam do dashboard do cliente certo — 6.137 eventos em 2026,
sendo ~5.100 só da Escal.

O prefixo genérico não dá pra resolver por alias: "Cadeira Office Soul" é da
Escal e "Cadeira Olive" é do Jader. Precisa ser por PRODUTO.

## De onde vem a verdade

Da tabela `att-publications` (DynamoDB). A URL do customizador publicado tem o
cliente e o slug do produto:

    https://explorar.archtechtour.com/{pasta-do-cliente}/ver-N/{slug-do-produto}/index.html

## Como a view usa

    COALESCE(d.cliente, p.cliente, LOWER(alias))
             ^alias     ^este dim   ^fallback

O alias vem primeiro de propósito: quem já resolve pelo prefixo continua igual,
e este dim só entra como resgate. É estritamente aditivo — nenhum cliente perde
evento quando o dim muda.

## Uso

    aws dynamodb scan --table-name att-publications --region us-east-1 \
      --profile att-admin --query 'Items[*].url.S' --output text \
      | tr '\t' '\n' > pubs.txt

    # opcional: produtos vistos nos eventos que ainda não têm dono, um por linha
    # (resgata nomes como "2025 Escal 35 E04 Aparador De Sofa Nascar")
    #   SELECT DISTINCT v.produto FROM vw_eventos_base_com_cliente v
    #   LEFT JOIN dim_client_alias d ON LOWER(v.alias)=LOWER(d.alias)
    #   WHERE d.alias IS NULL
    python3 scripts/gerar-dim-produto-cliente.py pubs.txt [produtos.txt] > dim.csv

    aws s3 cp dim.csv \
      s3://explorar.archtechtour.com/dim/dim_produto_cliente/dim_produto_cliente.csv \
      --profile att-admin --content-type text/csv

Rodar de novo sempre que entrarem publicações novas de produtos sem prefixo.
"""
from __future__ import annotations

import csv
import re
import sys

# Pasta no S3 (URL do customizador) -> nome do cliente EXATAMENTE como em
# dim_client_alias. As pastas divergem do alias por motivos históricos
# (estudio-bola vs estudiobola, minnimal vs minimal, rs vs rsdesign...).
PASTA_CLIENTE = {
    "escal": "Escal Móveis",
    "estudio-bola": "Estúdio Bola",
    "wentz": "Wentz",
    "minnimal": "Minimal Design",
    "rs": "RS Design",
    "tidelli": "Tidelli",
    "pedro-franco": "Pedro Franco",
    "dexco": "DEXCO",
    "wj": "WJ Luminárias",
    "cadeiras-rosa2": "Cadeiras Rosa",
    "jader": "Jader Almeida",
    "greenhouse": "Green House",
    "ricco": "Riccó",
    "docol": "Docol",
}

URL_RE = re.compile(
    r"https://explorar\.archtechtour\.com/([^/]+)/[^/]+/([^/]+)/"
)


def norm(s: str) -> str:
    """
    Normalização IDÊNTICA à aplicada no join da view. Se mudar aqui, mudar lá:
        regexp_replace(regexp_replace(LOWER(produto),'[^a-z0-9]+','-'),'^-+|-+$','')
    Sem fold de acento de propósito — o Athena também troca 'ó' por '-'.
    """
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))


# Um sufixo curto casa por acaso ("...-ella" com um slug "ella"). Só aceitamos
# resgate por sufixo quando o slug tem 2+ palavras e 8+ caracteres.
MIN_TOKENS_SUFIXO = 2
MIN_CHARS_SUFIXO = 8


def main(caminho_pubs: str, caminho_produtos: str | None) -> None:
    # slug do produto -> conjunto de clientes que o publicaram
    donos: dict[str, set[str]] = {}
    for linha in open(caminho_pubs, encoding="utf-8"):
        m = URL_RE.match(linha.strip())
        if not m:
            continue
        pasta, slug = m.groups()
        cliente = PASTA_CLIENTE.get(pasta)
        if cliente:
            donos.setdefault(norm(slug), set()).add(cliente)

    # Slug publicado por mais de um cliente é ambíguo (ex: "banco-less",
    # "poltrona-shell") — fica de fora, senão atribuiríamos ao cliente errado.
    ambiguos = sorted(k for k, v in donos.items() if len(v) > 1)
    mapa = {k: next(iter(v)) for k, v in donos.items() if len(v) == 1}

    # Resgate por sufixo: o nome do produto no evento costuma ser o slug
    # publicado com um prefixo colado na frente — "Cadeiras-Rosa-Banqueta-Madri"
    # carrega o slug "banqueta-madri". Só vale se UM único slug casar.
    resgatados = 0
    if caminho_produtos:
        candidatos = [
            k for k in mapa
            if len(k) >= MIN_CHARS_SUFIXO and k.count("-") + 1 >= MIN_TOKENS_SUFIXO
        ]
        for linha in open(caminho_produtos, encoding="utf-8"):
            chave = norm(linha.strip())
            if not chave or chave in mapa:
                continue
            casam = {mapa[k] for k in candidatos if chave.endswith("-" + k)}
            if len(casam) == 1:
                mapa[chave] = next(iter(casam))
                resgatados += 1

    w = csv.writer(sys.stdout)
    w.writerow(["produto_norm", "cliente"])
    for chave in sorted(mapa):
        w.writerow([chave, mapa[chave]])

    print(f"{len(mapa)} linhas geradas ({resgatados} por sufixo)", file=sys.stderr)
    if ambiguos:
        print(f"ambíguos descartados: {', '.join(ambiguos)}", file=sys.stderr)


if __name__ == "__main__":
    if not 2 <= len(sys.argv) <= 3:
        sys.exit(f"uso: {sys.argv[0]} <pubs.txt> [produtos.txt]")
    main(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else None)
