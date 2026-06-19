"""Lambda: auditoria-compute

Disparo: EventBridge cron(0 3 ? * SUN *)  → todo domingo 03h UTC
   OU    Invoke direto pela API /api/auditoria/refresh do portal

O que faz:
  1. Lista todos os customizadores publicados em s3://explorar.archtechtour.com
     (filtro: pastas que contêm index.html direto)
  2. Roda os 12 checks em paralelo (ThreadPoolExecutor, 32 workers)
  3. Agrega resultado num único JSON e salva em S3:
       s3://explorar.archtechtour.com/_auditoria/latest.json   (agregado)
       s3://explorar.archtechtour.com/_auditoria/historico/{YYYY-MM-DD}.json
       s3://explorar.archtechtour.com/_auditoria/detalhes/{cliente}__{produto}.json

Event opcional pra refresh pontual de UM produto:
    {"prefix": "rs/ver-9/arquibancada-aris/"}
  → faz só esse, atualiza detalhes/ e merge em latest.json.

Env vars:
  AUDITORIA_BUCKET       (default: explorar.archtechtour.com)
  AUDITORIA_PREFIX       (default: _auditoria)
  MAX_WORKERS            (default: 32)

Permissões IAM necessárias:
  - s3:ListBucket, s3:GetObject em explorar.archtechtour.com
  - s3:PutObject em explorar.archtechtour.com/_auditoria/*
"""

from __future__ import annotations

import json
import os
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import boto3

from validar_produto import validar_produto


BUCKET = os.environ.get("AUDITORIA_BUCKET", "explorar.archtechtour.com")
CACHE_PREFIX = os.environ.get("AUDITORIA_PREFIX", "_auditoria")
MAX_WORKERS = int(os.environ.get("MAX_WORKERS", "32"))

# Pastas que não são produtos (assets, exports, cache, etc.)
IGNORE_FIRST_SEGMENTS = {
    "assets",
    "athena-output",
    "athena-tmp",
    "Athena_BI_Parquet",
    "ERP",
    "Internal",
    "Product.Validation",
    "Revisoes",
    "Unsaved",
    "ar-demo",
    "eventos",
    "export",
    "mostra",
    "parquet",
    "testing",
    "dim",
    CACHE_PREFIX,
}


def list_produto_prefixes(s3, bucket: str) -> list[str]:
    """Lista prefixos de produto: pastas que contêm um index.html direto.

    Padrão: <cliente>/[ver-N/]<produto>/index.html
    """
    paginator = s3.get_paginator("list_objects_v2")
    prefixes: set[str] = set()
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith("/index.html"):
                continue
            parts = key.split("/")
            # Precisa ser <cliente>/[.../]<produto>/index.html (mínimo 3 segmentos)
            if len(parts) < 3:
                continue
            if parts[0] in IGNORE_FIRST_SEGMENTS:
                continue
            prefix = "/".join(parts[:-1]) + "/"
            prefixes.add(prefix)
    return sorted(prefixes)


def auditar_um_produto(bucket: str, prefix: str) -> dict:
    """Wrapper que cria um S3 client próprio (boto3 não é thread-safe)."""
    s3 = boto3.client("s3")
    try:
        return validar_produto(s3, bucket, prefix)
    except Exception as e:
        return {
            "prefix": prefix,
            "status": "erro",
            "erro": str(e),
            "cliente": prefix.split("/")[0] if "/" in prefix else "",
            "produto": prefix.rstrip("/").split("/")[-1],
        }


def salvar_json(s3, bucket: str, key: str, data: dict) -> None:
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(data, ensure_ascii=False).encode("utf-8"),
        ContentType="application/json; charset=utf-8",
        CacheControl="public, max-age=60",
    )


def gerar_relatorio_agregado(produtos_detalhes: list[dict], duracao_seg: float) -> dict:
    """A partir da lista de detalhes, gera o JSON resumido pra UI."""
    by_status = defaultdict(int)
    by_cliente: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "ok": 0, "com_avisos": 0, "com_bloqueio": 0, "erro": 0})

    produtos_resumo = []
    for d in produtos_detalhes:
        status = d.get("status", "erro")
        by_status[status] += 1
        cliente = d.get("cliente", "")
        by_cliente[cliente]["total"] += 1
        by_cliente[cliente][status] = by_cliente[cliente].get(status, 0) + 1

        produtos_resumo.append({
            "prefix": d.get("prefix"),
            "cliente": cliente,
            "produto": d.get("produto", ""),
            "ver": d.get("ver"),
            "url_publica": d.get("url_publica"),
            "status": status,
            "criticos_falhos": d.get("criticos_falhos", []),
            "avisos_count": len(d.get("avisos", [])),
            "total_bytes": d.get("total_bytes", 0),
            "erro": d.get("erro"),
        })

    produtos_resumo.sort(key=lambda p: ({"com_bloqueio": 0, "erro": 1, "com_avisos": 2, "ok": 3}.get(p["status"], 9), p["cliente"], p["produto"]))

    return {
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "duracao_segundos": round(duracao_seg, 1),
        "total_produtos": len(produtos_detalhes),
        "totais": {
            "ok": by_status.get("ok", 0),
            "com_avisos": by_status.get("com_avisos", 0),
            "com_bloqueio": by_status.get("com_bloqueio", 0),
            "erro": by_status.get("erro", 0),
        },
        "por_cliente": dict(by_cliente),
        "produtos": produtos_resumo,
    }


def detalhe_key(prefix: str) -> str:
    """Converte um prefix em key pro JSON de detalhes."""
    safe = prefix.rstrip("/").replace("/", "__")
    return f"{CACHE_PREFIX}/detalhes/{safe}.json"


def handler(event, context):
    """Entry point Lambda. Aceita event.prefix opcional pra refresh pontual."""
    inicio = time.time()
    s3 = boto3.client("s3")

    target_prefix = (event or {}).get("prefix") if isinstance(event, dict) else None

    # Modo 1: refresh de UM produto
    if target_prefix:
        if not target_prefix.endswith("/"):
            target_prefix = target_prefix + "/"
        detalhe = auditar_um_produto(BUCKET, target_prefix)
        salvar_json(s3, BUCKET, detalhe_key(target_prefix), detalhe)

        # merge no latest.json
        try:
            latest = json.loads(s3.get_object(Bucket=BUCKET, Key=f"{CACHE_PREFIX}/latest.json")["Body"].read())
            produtos = latest.get("produtos", [])
            # atualiza ou adiciona
            idx = next((i for i, p in enumerate(produtos) if p["prefix"] == target_prefix), None)
            novo_resumo = {
                "prefix": detalhe.get("prefix"),
                "cliente": detalhe.get("cliente", ""),
                "produto": detalhe.get("produto", ""),
                "ver": detalhe.get("ver"),
                "url_publica": detalhe.get("url_publica"),
                "status": detalhe.get("status", "erro"),
                "criticos_falhos": detalhe.get("criticos_falhos", []),
                "avisos_count": len(detalhe.get("avisos", [])),
                "total_bytes": detalhe.get("total_bytes", 0),
                "erro": detalhe.get("erro"),
            }
            if idx is not None:
                produtos[idx] = novo_resumo
            else:
                produtos.append(novo_resumo)
            latest["produtos"] = produtos
            latest["atualizado_em"] = datetime.now(timezone.utc).isoformat()
            salvar_json(s3, BUCKET, f"{CACHE_PREFIX}/latest.json", latest)
        except s3.exceptions.NoSuchKey:
            pass  # latest.json ainda não existe — primeira execução

        return {"ok": True, "modo": "single", "prefix": target_prefix, "status": detalhe.get("status")}

    # Modo 2: auditoria completa
    print(f"[auditoria] Listando produtos em s3://{BUCKET} ...")
    prefixes = list_produto_prefixes(s3, BUCKET)
    print(f"[auditoria] {len(prefixes)} produtos encontrados. Validando com {MAX_WORKERS} threads...")

    produtos_detalhes: list[dict] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(auditar_um_produto, BUCKET, p): p for p in prefixes}
        for i, fut in enumerate(as_completed(futures), 1):
            d = fut.result()
            produtos_detalhes.append(d)
            # salva detalhe individual em paralelo (não bloqueia o agregado)
            try:
                salvar_json(s3, BUCKET, detalhe_key(d["prefix"]), d)
            except Exception as e:
                print(f"[auditoria] ERRO salvar detalhe {d.get('prefix')}: {e}")
            if i % 50 == 0:
                print(f"[auditoria] {i}/{len(prefixes)} ...")

    duracao = time.time() - inicio
    relatorio = gerar_relatorio_agregado(produtos_detalhes, duracao)
    salvar_json(s3, BUCKET, f"{CACHE_PREFIX}/latest.json", relatorio)

    data_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    salvar_json(s3, BUCKET, f"{CACHE_PREFIX}/historico/{data_iso}.json", relatorio)

    print(f"[auditoria] Concluído em {duracao:.1f}s. Total={relatorio['total_produtos']}, "
          f"OK={relatorio['totais']['ok']}, Avisos={relatorio['totais']['com_avisos']}, "
          f"Bloqueio={relatorio['totais']['com_bloqueio']}, Erro={relatorio['totais']['erro']}")
    return {"ok": True, "modo": "full", "totais": relatorio["totais"], "duracao_segundos": duracao}


if __name__ == "__main__":
    # Permite rodar localmente: python3 handler.py
    import sys
    if len(sys.argv) > 1:
        # refresh de um produto: python3 handler.py rs/ver-9/arquibancada-aris/
        print(json.dumps(handler({"prefix": sys.argv[1]}, None), indent=2, ensure_ascii=False))
    else:
        print(json.dumps(handler({}, None), indent=2, ensure_ascii=False))
