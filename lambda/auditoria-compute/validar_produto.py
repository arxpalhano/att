"""Lógica de validação de 1 customizador Verge3D.

Refatorado de att-agents/plugins/att-validador/scripts/validar_produto.py para uso
dentro do Lambda (sem dependência de aws CLI / curl). Usa boto3 + urllib direto.
"""

from __future__ import annotations

import re
import urllib.request
import urllib.error
from typing import Any
from pathlib import PurePosixPath

import boto3
from botocore.exceptions import ClientError


# Texturas placeholder do template Verge3D que não precisam estar na pasta
TEXTURE_IGNORE = {
    "newTexture.png",
    "screenshot.png",
    "loading.svg",
    "preview.png",
    "thumbnail.png",
}

PUBLIC_BASE = "https://explorar.archtechtour.com"


def _http_head_status(url: str, timeout: float = 5.0) -> str:
    """Retorna código HTTP via HEAD request, ou "000" / "error" se falhar."""
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return str(resp.status)
    except urllib.error.HTTPError as e:
        return str(e.code)
    except Exception:
        return "000"


def list_produto_files(s3, bucket: str, prefix: str) -> tuple[list[tuple[str, int]], int]:
    """Lista os arquivos do produto. Retorna ([(path_relativo, size_bytes)], total_bytes)."""
    files: list[tuple[str, int]] = []
    total = 0
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            size = obj["Size"]
            rel = key[len(prefix):] if key.startswith(prefix) else key
            files.append((rel, size))
            total += size
    return files, total


def get_object_text(s3, bucket: str, key: str) -> str | None:
    try:
        resp = s3.get_object(Bucket=bucket, Key=key)
        return resp["Body"].read().decode("utf-8", errors="replace")
    except ClientError:
        return None


def validar_produto(s3, bucket: str, prefix: str) -> dict[str, Any]:
    """Roda os 12 checks num produto. Retorna dict com checks + metadados.

    bucket: 'explorar.archtechtour.com'
    prefix: 'rs/ver-9/arquibancada-aris/' (terminado em /)
    """
    if not prefix.endswith("/"):
        prefix = prefix + "/"
    parts = [p for p in prefix.strip("/").split("/") if p]
    cliente = parts[0] if parts else ""
    produto = parts[-1] if parts else ""
    ver = parts[1] if len(parts) > 2 and parts[1].startswith("ver") else None

    files_with_size, total_bytes = list_produto_files(s3, bucket, prefix)
    files = [f for f, _ in files_with_size]
    has = lambda name: any(f.endswith(name) or f == name for f in files)

    chk1 = has("index.html")

    required = ["v3d.js", "model.js", "ui.js", "visual_logic.js", "visual_logic.xml"]
    chk2_missing = [f for f in required if not has(f)]
    chk2 = not chk2_missing

    index_html = get_object_text(s3, bucket, prefix + "index.html") if chk1 else None
    visual_logic = get_object_text(s3, bucket, prefix + "visual_logic.xml") if has("visual_logic.xml") else None

    expected_id = f"{cliente}-{produto}"
    found_id = ""
    if index_html:
        m = re.search(r'data-produto-id="([^"]+)"', index_html)
        if m:
            found_id = m.group(1)
    chk3 = bool(found_id) and found_id.endswith(produto)

    chk4 = any(f.endswith(".gltf.xz") or f.endswith(".bin.xz") for f in files)

    chk5_missing: list[str] = []
    if visual_logic:
        refs = set(re.findall(r"[A-Za-z0-9_\.\- ]+\.(?:png|jpg|jpeg|hdr|webp)", visual_logic))
        file_basenames = {PurePosixPath(f).name for f in files}
        for ref in refs:
            base = PurePosixPath(ref).name
            if base in TEXTURE_IGNORE:
                continue
            if base not in file_basenames:
                chk5_missing.append(ref)
    chk5 = not chk5_missing

    def extract_dl_url(html: str, eid: str) -> str | None:
        if not html:
            return None
        pat = (
            rf'<a[^>]*id=["\']{eid}["\'][^>]*href=["\']([^"\']+)["\']'
            rf'|<a[^>]*href=["\']([^"\']+)["\'][^>]*id=["\']{eid}["\']'
        )
        m = re.search(pat, html, flags=re.IGNORECASE | re.DOTALL)
        if not m:
            return None
        return m.group(1) or m.group(2)

    def check_download(kind: str, eid: str) -> dict:
        url = extract_dl_url(index_html or "", eid)
        if not url:
            return {"kind": kind, "url": None, "status": "no-link", "ok": False, "critical": True,
                    "note": f"Link <a id='{eid}'> não encontrado no index.html"}
        status = _http_head_status(url)
        return {"kind": kind, "url": url, "status": status, "ok": status == "200", "critical": True}

    dl_skp = check_download("Sketchup", "sketchup-model")
    dl_arch = check_download("Archicad", "archicad-model")
    dl_revit = check_download("Revit", "revit-model")

    chk9_wrong: list[str] = []
    if index_html:
        urls = set(re.findall(
            r"https://explorar\.archtechtour\.com/mostra/[A-Za-z0-9_\-]+/[A-Za-z0-9_\-]+/[^\"' ]+",
            index_html,
        ))
        produto_lower = produto.lower()
        for u in urls:
            if produto_lower not in u.lower():
                chk9_wrong.append(u)
    chk9 = not chk9_wrong

    chk10 = bool(index_html and "odwlqrkix5.execute-api.us-east-1.amazonaws.com/register-event" in index_html)

    ds_count = sum(1 for f in files if ".DS_Store" in f)
    chk11 = ds_count == 0

    chk12 = total_bytes < 100 * 1024 * 1024

    checks = {
        "1_index_html": {"ok": chk1, "critical": True},
        "2_verge3d_files": {"ok": chk2, "critical": True, "missing": chk2_missing},
        "3_data_produto_id": {"ok": chk3, "critical": False, "expected": expected_id, "found": found_id},
        "4_modelo_xz": {"ok": chk4, "critical": True},
        "5_texturas_existem": {"ok": chk5, "critical": True, "missing": chk5_missing[:20]},
        "6_download_sketchup": dl_skp,
        "7_download_archicad": dl_arch,
        "8_download_revit": dl_revit,
        # check 9 é AVISO (não bloqueia): muitos produtos antigos reusam URLs de template (ex.: CadeiraDoty).
        # Pode ser intencional. Cabe ao operador decidir se vai corrigir.
        "9_urls_download_corretas": {"ok": chk9, "critical": False, "wrong": chk9_wrong[:5]},
        "10_analytics_endpoint": {"ok": chk10, "critical": False},
        "11_no_ds_store": {"ok": chk11, "critical": False, "count": ds_count},
        "12_total_size_under_100mb": {"ok": chk12, "critical": False, "bytes": total_bytes},
    }

    criticos_falhos = [k for k, v in checks.items() if v.get("critical") and not v.get("ok")]
    avisos = [k for k, v in checks.items() if not v.get("critical") and not v.get("ok")]

    if criticos_falhos:
        status = "com_bloqueio"
    elif avisos:
        status = "com_avisos"
    else:
        status = "ok"

    return {
        "prefix": prefix,
        "cliente": cliente,
        "ver": ver,
        "produto": produto,
        "url_publica": f"{PUBLIC_BASE}/{prefix}index.html",
        "status": status,
        "total_bytes": total_bytes,
        "total_files": len(files),
        "criticos_falhos": criticos_falhos,
        "avisos": avisos,
        "checks": checks,
    }
