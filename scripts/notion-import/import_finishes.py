"""
Importa os "Cadastro de Produtos - <Marca>" do Notion para att-finishes.

  python3 import_finishes.py           # dry-run (relatório)
  python3 import_finishes.py --apply   # grava no DynamoDB

Fontes (mesmo diretório):
  rows-<marca>.json      linhas do view "Tabela" (modo view do Notion MCP), formato bruto {results:[...]}
  schema-<marca>.json    (opcional) {"multi_select": {grupo: [opções]}} extraído do esquema da base
  inline-rows.json       linhas transcritas à mão para as bases que vieram inline (formato compacto)
  att-blocks.json, att-clients.json (scan DynamoDB, diretório ../import)

Regras:
  - Catálogo da marca = grupos multi_select do esquema (quando há) ∪ opções usadas nas linhas.
    Não são grupos: Variações, Categoria: Local, PRIORIDADE (viram variações/categoria).
  - Produto ↔ bloco: pela relação com o Banco de Produtos (url == block.notionUrl); senão pelo
    nome normalizado dentro da marca (sem o prefixo "N." da linha). Sem bloco → linha pulada.
  - Registro do produto: selections {groupId: [optionId]}, variations, category, pieceDescription,
    applicationNotes (Observação de aplicação de materiais / AJUSTES / Informação adicional).
  - Não sobrescreve um registro que já tenha sido editado no portal (updatedBy sem "import").
"""
import json, os, re, sys, glob, unicodedata, subprocess, datetime, collections

HERE = os.path.dirname(os.path.abspath(__file__))
IMP = os.path.join(HERE, "..", "import")
APPLY = "--apply" in sys.argv
NOW = datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z"
NOT_GROUPS = {"Variações", "Variação", "Variação Modular", "Categoria: Local", "PRIORIDADE"}
NOTES_FIELDS = ["Observação de aplicação de materiais", "AJUSTES", "AJUSTE", "Informação adicional"]
REL_FIELDS = ["CÓDIGO INTERNO", "Código Interno", "Banco de Produtos", "Banco de Dados"]
NAME_FIELDS = ["Nome", "Código + nome da peça", "Produto Matriz"]

def norm(s):
    s = unicodedata.normalize("NFD", s or "").lower()
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "", s)
def slug(s):
    s = unicodedata.normalize("NFD", s or "").lower()
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "x"
def clean_text(t):
    if not t: return ""
    t = re.sub(r"<br\s*/?>", "\n", t); t = t.replace("\r", "")
    t = re.sub(r"\*\*(.*?)\*\*", r"\1", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"[ \t]+", " ", t); t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()
def strip_prefix(name):
    return re.sub(r"^\s*\d+\s*[.\-]\s*", "", name or "").strip()
def unmarshal(v):
    if "S" in v: return v["S"]
    if "N" in v: return float(v["N"]) if "." in v["N"] else int(v["N"])
    if "BOOL" in v: return v["BOOL"]
    if "NULL" in v: return None
    if "L" in v: return [unmarshal(x) for x in v["L"]]
    if "M" in v: return {k: unmarshal(x) for k, x in v["M"].items()}
    raise ValueError(v)
def marshal(v):
    if isinstance(v, bool): return {"BOOL": v}
    if isinstance(v, (int, float)): return {"N": str(v)}
    if isinstance(v, str): return {"S": v}
    if isinstance(v, list): return {"L": [marshal(x) for x in v]}
    if isinstance(v, dict): return {"M": {k: marshal(x) for k, x in v.items()}}
    raise TypeError(v)
def load_table(name):
    d = json.load(open(os.path.join(IMP, f"{name}.json")))
    return [{k: unmarshal(v) for k, v in it.items()} for it in d["Items"]]

# marca → cliente do portal (nome normalizado; alias quando difere)
ALIAS = {"estudiobola": "estudiobola", "escal": "escalmoveis", "greenhouse": "greenhouse"}

def raw_rows_to_compact(rows):
    """Linhas brutas do view → formato compacto (name/url/rel/sel/var/cat/desc/notes)."""
    out = []
    for r in rows:
        name = next((r.get(f) for f in NAME_FIELDS if r.get(f)), "") or ""
        if not name.strip() or re.fullmatch(r"\s*\d+\.?\s*", name): continue
        rel = None
        for f in REL_FIELDS:
            if r.get(f):
                try: rel = json.loads(r[f])[0]
                except Exception: rel = None
                if rel: break
        sel, var, cat = {}, [], []
        for k, v in r.items():
            if not isinstance(v, str) or not v.startswith("["): continue
            try: arr = json.loads(v)
            except Exception: continue
            if not arr or not all(isinstance(x, str) for x in arr): continue
            if k in REL_FIELDS: continue
            if k in ("Variações", "Variação", "Variação Modular"): var += arr
            elif k == "Categoria: Local": cat += arr
            elif k in NOT_GROUPS: continue
            else: sel[k] = arr
        notes = "\n\n".join(clean_text(r.get(f)) for f in NOTES_FIELDS if clean_text(r.get(f)))
        out.append({"name": name, "url": r["url"], "rel": rel, "sel": sel, "var": var, "cat": cat,
                    "desc": clean_text(r.get("Descrição peça")), "notes": notes})
    return out

def main():
    blocks = load_table("att-blocks"); clients = load_table("att-clients")
    client_by_norm = {norm(c["name"]): c for c in clients}
    block_by_notion = {b["notionUrl"]: b for b in blocks if b.get("notionUrl")}
    by_client_title = collections.defaultdict(dict)
    for b in blocks: by_client_title[b["clientId"]][norm(b["title"])] = b

    # fontes
    sources = {}  # brand → {"groups": {g: [opts]}, "rows": [compact]}
    for f in glob.glob(os.path.join(HERE, "rows-*.json")):
        brand = os.path.basename(f)[5:-5]
        raw = json.load(open(f)); rows = raw["results"] if isinstance(raw, dict) else raw
        sch = os.path.join(HERE, f"schema-{brand}.json")
        groups = {}
        if os.path.exists(sch):
            groups = {k: v for k, v in json.load(open(sch))["multi_select"].items() if k not in NOT_GROUPS}
        sources.setdefault(brand, {"groups": {}, "rows": []})
        sources[brand]["groups"].update(groups); sources[brand]["rows"] += raw_rows_to_compact(rows)
    inline = json.load(open(os.path.join(HERE, "inline-rows.json")))
    for brand, d in inline.items():
        if brand.startswith("_"): continue
        sources.setdefault(brand, {"groups": {}, "rows": []})
        sources[brand]["groups"].update(d.get("groups", {})); sources[brand]["rows"] += d["rows"]

    # existente no banco (para não sobrescrever edição feita no portal)
    existing = {}
    try:
        cur = json.loads(subprocess.run(["aws", "dynamodb", "scan", "--table-name", "att-finishes", "--region", "us-east-1", "--profile", "att-admin", "--output", "json"], capture_output=True, text=True).stdout)
        for it in cur.get("Items", []):
            o = {k: unmarshal(v) for k, v in it.items()}; existing[o["id"]] = o
    except Exception as e:
        print("aviso: não li att-finishes:", e)

    report = collections.Counter(); skipped = collections.defaultdict(list); catalogs = []; records = []
    for brand, src in sorted(sources.items()):
        client = client_by_norm.get(ALIAS.get(norm(brand), norm(brand)))
        if not client: skipped[f"marca sem cliente no portal: {brand}"].append(len(src["rows"])); continue
        # catálogo: esquema ∪ usado nas linhas
        groups = {g: list(dict.fromkeys(opts)) for g, opts in src["groups"].items()}
        for r in src["rows"]:
            for g, opts in r.get("sel", {}).items():
                groups.setdefault(g, [])
                for o in opts:
                    if o not in groups[g]: groups[g].append(o)
        gid = {g: slug(g) for g in groups}
        oid = {(g, o): f"{slug(g)}-{slug(o)}" for g, opts in groups.items() for o in opts}
        cat_id = f"cat_{client['id']}"
        prev = existing.get(cat_id)
        if prev and "import" not in (prev.get("updatedBy") or "import"):
            report[f"catálogo mantido (editado no portal): {brand}"] += 1
        else:
            catalogs.append({"id": cat_id, "kind": "catalog", "clientId": client["id"],
                "groups": [{"id": gid[g], "name": g, "options": [{"id": oid[(g, o)], "name": o} for o in opts]} for g, opts in groups.items() if opts],
                "updatedAt": NOW, "updatedBy": "import-notion", "notionUrl": inline.get(brand, {}).get("db")})
            report[f"catálogo: {brand} ({len(groups)} grupos, {sum(len(v) for v in groups.values())} opções)"] += 1
        # produtos
        for r in src["rows"]:
            blk = block_by_notion.get(r.get("rel")) if r.get("rel") else None
            if not blk: blk = by_client_title[client["id"]].get(norm(strip_prefix(r["name"])))
            if not blk: skipped[f"produto sem bloco no portal ({brand})"].append(r["name"][:50]); continue
            if blk["clientId"] != client["id"]: skipped[f"bloco de outra marca ({brand})"].append(r["name"][:50]); continue
            rid = f"blk_{blk['id']}"
            prev = existing.get(rid)
            if prev and "import" not in (prev.get("updatedBy") or "import"):
                report["produto mantido (editado no portal)"] += 1; continue
            selections = {gid[g]: [oid[(g, o)] for o in opts if (g, o) in oid] for g, opts in r.get("sel", {}).items() if g in gid}
            rec = {"id": rid, "kind": "block", "clientId": client["id"], "blockId": blk["id"],
                   "selections": selections, "variations": list(dict.fromkeys(r.get("var") or [])),
                   "updatedAt": NOW, "updatedBy": "import-notion", "notionUrl": r["url"]}
            if r.get("cat"): rec["category"] = ", ".join(r["cat"])
            if r.get("desc"): rec["pieceDescription"] = r["desc"]
            if r.get("notes"): rec["applicationNotes"] = r["notes"]
            records.append(rec); report[f"produtos: {brand}"] += 1

    print("== Resultado =="); [print(f"  {v:4d}  {k}") for k, v in sorted(report.items())]
    print("== Pulados =="); [print(f"  {len(v):4d}  {k}  ex.: {v[:3]}") for k, v in skipped.items()]
    json.dump({"catalogs": catalogs, "records": records}, open(os.path.join(HERE, "finishes-plan.json"), "w"), ensure_ascii=False, indent=1)
    print(f"plano: {len(catalogs)} catálogos, {len(records)} produtos → finishes-plan.json")
    if not APPLY: print("DRY-RUN — nada gravado."); return
    items = catalogs + records
    for i in range(0, len(items), 25):
        req = {"att-finishes": [{"PutRequest": {"Item": {k: marshal(v) for k, v in it.items() if v is not None}}} for it in items[i:i+25]]}
        tmp = os.path.join(HERE, "_batch.json"); json.dump(req, open(tmp, "w"), ensure_ascii=False)
        r = subprocess.run(["aws", "dynamodb", "batch-write-item", "--request-items", f"file://{tmp}", "--region", "us-east-1", "--profile", "att-admin", "--output", "json"], capture_output=True, text=True)
        if r.returncode: raise SystemExit(r.stderr)
        if json.loads(r.stdout).get("UnprocessedItems"): raise SystemExit(f"não processado no lote {i}")
    print(f"OK — gravados {len(items)} itens.")

if __name__ == "__main__":
    main()
