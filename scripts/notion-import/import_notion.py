"""
Importa o "Banco de Produtos" do Notion para os blocos do portal (att-blocks).

Uso:
  python3 import_notion.py            # dry-run: só relatório, não escreve nada
  python3 import_notion.py --apply    # grava no DynamoDB (faça backup antes)

Entradas (no mesmo diretório):
  notion-page-*.json   páginas do view "Tabela" do Banco de Produtos (query em modo view)
  att-blocks.json, att-clients.json, att-contracts.json, att-publications.json  (scan DynamoDB)

Regras (ver PORTAL.md §5):
  - Marca: relação "Projetos" → nome do projeto → cliente do portal (nome normalizado).
    Projetos internos (.Bugs, .Produto…) e marcas sem cliente no portal são pulados e listados.
  - Produto já existe no portal se (mesma marca) e (slug do "Link atual" == slug de alguma
    publicação do bloco) OU (nome normalizado == título normalizado do bloco).
  - Bloco existente: recebe bim/modelador/rastreabilidade e o status mapeado do Notion —
    EXCETO se o portal diz "published" (customizador no ar) e o Notion diz uma etapa anterior:
    aí mantemos published e registramos a etapa do Notion em notionTech para a Jessica revisar.
    Nunca rebaixamos um customizador publicado automaticamente.
  - Produto novo: bloco criado com sku = código do Notion, título = nome extraído do código,
    contrato = contrato mais recente da marca, n = próximo número da marca.
  - Blocos do portal que não estão no Notion: intocados.
"""
import json, glob, re, sys, unicodedata, hashlib, subprocess, collections, datetime, os

HERE = os.path.dirname(os.path.abspath(__file__))
APPLY = "--apply" in sys.argv
TODAY = datetime.date.today().isoformat()
NOW = datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z"

# ---------- util ----------
def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "").lower()
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "", s)

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
    if v is None: return {"NULL": True}
    if isinstance(v, list): return {"L": [marshal(x) for x in v]}
    if isinstance(v, dict): return {"M": {k: marshal(x) for k, x in v.items()}}
    raise TypeError(v)

def load_table(name):
    d = json.load(open(os.path.join(HERE, f"{name}.json")))
    return [{k: unmarshal(v) for k, v in it.items()} for it in d["Items"]]

def product_name_from_code(code: str) -> str:
    """'2025-RS-DESIGN-01-E01-POLTRONA CASULO NIDO' → 'Poltrona Casulo Nido'."""
    parts = re.split(r"[-_ ]E\d+[-_ ]", code, flags=re.I)
    tail = parts[-1] if len(parts) > 1 else code
    tail = re.sub(r"^[-_ ]*\d+[-_ ]*", "", tail)          # '04-CUPULO' → 'CUPULO'
    tail = tail.replace("_", " ").replace("-", " ").strip(" -")
    words = [w for w in tail.split() if w]
    def cap(w):
        return w if (len(w) <= 3 and w.isupper() and not w.isalpha()) else w.capitalize()
    return " ".join(cap(w) for w in words) or code

def slug_from_link(url: str) -> str:
    m = re.search(r"explorar\.archtechtour\.com/([^/]+)/ver-\d+/([^/]+)/", url or "")
    return norm(m.group(2)) if m else ""

# ---------- mapeamento de status ----------
def map_status(tech: str, dados: str, link: str) -> str:
    t = (tech or "").strip()
    if t == "Não recebido": return "awaiting_client_files"
    if t == "Aguardando Informação": return "awaiting_client_files"
    if t == "Não iniciada": return "ready_to_start" if dados == "Recebido" else "awaiting_client_files"
    if t in ("Modelagem", "Revisão modelagem"): return "in_modeling"
    if t in ("Texturização", "Revisão texturização"): return "in_texturing"
    if t == "SKP VALIDAÇÃO": return "awaiting_client_material_validation"
    if t in ("Programação", "Revisão programação"): return "in_programming"
    if t == "Revisão Link": return "internal_review"
    if t in ("Envio link revisado", "Aguardando feedback", "Aguardando aprovação"): return "awaiting_client_final_validation"
    if t == "Conversão BIM": return "bim_conversion"
    if t == "Concluído": return "published" if link else "approved"
    if t == "fora de linha": return "archived"
    if t == "": return "draft"
    raise ValueError(f"Tech desconhecido: {t!r}")

# etapas do Notion que são "tão ou mais avançadas" que published → pode aplicar sobre bloco publicado
TECH_AT_LEAST_PUBLISHED = {"Concluído", "Conversão BIM", "fora de linha"}

# ---------- Projetos (Notion) → cliente (portal) ----------
PROJETOS = {
  "https://app.notion.com/p/1c7759356d9b80dfbe72de366d08f20d": "Cadeiras Rosa",
  "https://app.notion.com/p/1cf759356d9b809a853dfd78ad585642": "Christie",
  "https://app.notion.com/p/1f2759356d9b8058b8f1c841595995b6": "Dengo",
  "https://app.notion.com/p/317759356d9b80adbd0ffe0fcbe9027e": "DEXCO",
  "https://app.notion.com/p/1c7759356d9b801d893fcd2ac848be23": "Docol",
  "https://app.notion.com/p/1c7759356d9b80a293f4e6ac0f1c5a15": "Escal",
  "https://app.notion.com/p/1c8759356d9b80d5bedaea0ef7805c24": "estudiobola",
  "https://app.notion.com/p/1c7759356d9b8093bd76c97665357729": "Green House",
  "https://app.notion.com/p/2a1759356d9b8060af64d63f9f37317b": "Hunter Douglas",
  "https://app.notion.com/p/1c7759356d9b80139ef0fa858da2acc4": "Inkasa",
  "https://app.notion.com/p/1c7759356d9b80b69f2fdb04e344a54e": "Jader Almeida",
  "https://app.notion.com/p/1c7759356d9b80b9a784c02db8438892": "Minimal Design",
  "https://app.notion.com/p/1c7759356d9b80169780c9db2769566e": "Pedro Franco",
  "https://app.notion.com/p/21f759356d9b80d4a0f5e88538a21fd4": "Persol",
  "https://app.notion.com/p/1c7759356d9b80f4b344c270402c3e4e": "Riccó",
  "https://app.notion.com/p/2af759356d9b80b098c4e8b36e9fdc9a": "RS Design",
  "https://app.notion.com/p/1c7759356d9b80e58373d8b1314fa45e": "Tidelli",
  "https://app.notion.com/p/1c8759356d9b80ffa900d3fcd971b210": "Wentz",
  "https://app.notion.com/p/284759356d9b80c3926ad5e50b7dcc89": "WJ Luminárias",
  # internos — sem cliente no portal, pulados de propósito
  "https://app.notion.com/p/21f759356d9b806f8eb1ed6d080f5283": ".Bugs&Repairs",
  "https://app.notion.com/p/262759356d9b80b88386e309b1de9c44": ".Explore",
  "https://app.notion.com/p/22b759356d9b805c805ada1557622b38": ".Manuais & bibliotecas",
  "https://app.notion.com/p/23e759356d9b803db7cddf1af6a07ec8": ".Marketing",
  "https://app.notion.com/p/22c759356d9b80ddbc20d22f787e75a0": ".Produto",
}
ALIAS = {"estudiobola": "estudiobola", "escal": "escalmoveis"}  # nome no Notion → nome normalizado no portal

def main():
    blocks = load_table("att-blocks")
    clients = load_table("att-clients")
    contracts = load_table("att-contracts")
    pubs = load_table("att-publications")
    MISSING = {"Dengo": 40, "Inkasa": 20}   # "Produtos contratados" no banco Projetos do Notion
    new_clients, new_contracts = [], []
    for nome, total in MISSING.items():
        if norm(nome) in {norm(c["name"]) for c in clients}: continue
        cl = {"id": f"c_{norm(nome)}", "name": nome, "code": norm(nome), "contactEmail": "", "active": True}
        ct = {"id": f"ct_{norm(nome)}", "clientId": cl["id"], "title": f"Contrato {nome} – Em definição (importado do Notion)",
              "totalBlocks": total, "usedBlocks": 0, "startDate": TODAY, "active": True}
        clients.append(cl); contracts.append(ct); new_clients.append(cl); new_contracts.append(ct)
    client_by_norm = {norm(c["name"]): c for c in clients}
    def client_for_project(nome):
        key = ALIAS.get(norm(nome), norm(nome))
        return client_by_norm.get(key)

    pages = sorted(glob.glob(os.path.join(HERE, "notion-page-*.json")))
    rows = []
    for p in pages: rows += json.load(open(p))["results"]
    seen = set(); uniq = []
    for r in rows:
        if r["url"] in seen: continue
        seen.add(r["url"]); uniq.append(r)
    rows = uniq
    print(f"Notion: {len(rows)} produtos em {len(pages)} página(s)")

    # índices do portal
    by_client_title = collections.defaultdict(dict)
    for b in blocks: by_client_title[b["clientId"]][norm(b["title"])] = b
    pub_slug_to_block = {}
    for p in pubs:
        s = slug_from_link(p.get("url", ""))
        if s: pub_slug_to_block[(s)] = p["blockId"]
    block_by_id = {b["id"]: b}  # placeholder, rebuilt below
    block_by_id = {b["id"]: b for b in blocks}
    latest_contract = {}
    for c in sorted(contracts, key=lambda c: c.get("startDate", "")):
        latest_contract[c["clientId"]] = c
    next_n = collections.defaultdict(int)
    for b in blocks: next_n[b["clientId"]] = max(next_n[b["clientId"]], int(b.get("n") or 0))

    report = collections.Counter()
    skipped = collections.defaultdict(list)
    conflicts = []       # publicado no portal, Notion numa etapa anterior
    status_changes = collections.Counter()
    creates = []; updates = []; new_pubs = []
    matched_ids = set()
    slug_any = {}   # slug → (clientId, blockId) de qualquer marca, para achar duplicata cruzada
    for p in pubs:
        sl = slug_from_link(p.get("url", ""))
        if sl and p["blockId"] in block_by_id: slug_any[sl] = (block_by_id[p["blockId"]]["clientId"], p["blockId"])
    cross = []

    for r in rows:
        code = (r.get("Código interno") or "").strip()
        tech = (r.get("Tech") or "").strip()
        dados = (r.get("Dados e Informação") or "").strip()
        link = (r.get("Link atual") or "").strip()
        projs = json.loads(r.get("Projetos") or "[]")
        if not code:
            skipped["sem código"].append(r["url"]); continue
        if not projs:
            skipped["sem marca (Projetos vazio)"].append(code); continue
        nome_proj = PROJETOS.get(projs[0], f"?{projs[0]}")
        if nome_proj.startswith("."):
            skipped[f"projeto interno {nome_proj}"].append(code); continue
        client = client_for_project(nome_proj)
        if not client:
            skipped[f"marca sem cliente no portal: {nome_proj}"].append(code); continue

        bim = {"skp": r.get("SKP") == "__YES__", "rvt": r.get("RVT") == "__YES__", "gsm": r.get("GSM") == "__YES__"}
        new_status = map_status(tech, dados, link)
        name = product_name_from_code(code)
        common = {"bim": bim, "notionUrl": r["url"], "notionCode": code, "notionTech": tech or "(vazio)", "importedAt": NOW}

        # --- match ---
        existing = None
        s = slug_from_link(link)
        if s and s in pub_slug_to_block:
            cand = block_by_id.get(pub_slug_to_block[s])
            if cand and cand["clientId"] == client["id"]: existing = cand
        if not existing:
            existing = by_client_title[client["id"]].get(norm(name))
        if existing and existing["id"] in matched_ids:
            # dois produtos do Notion caindo no mesmo bloco → o segundo vira novo
            existing = None

        if existing:
            matched_ids.add(existing["id"])
            upd = dict(existing); upd.update(common)
            old = existing["status"]
            if old == "published" and tech not in TECH_AT_LEAST_PUBLISHED:
                conflicts.append((client["name"], existing.get("sku"), existing["title"], tech))
                report["mantido published (Notion atrás)"] += 1
            elif old != new_status:
                upd["status"] = new_status
                if new_status == "published" and not upd.get("published"):
                    upd["published"] = (r.get("date:Data link:start") or TODAY)
                status_changes[f"{old} → {new_status}"] += 1
                report["status atualizado"] += 1
            else:
                report["já igual (só campos BIM/Notion)"] += 1
            updates.append(upd)
        else:
            next_n[client["id"]] += 1
            ct = latest_contract.get(client["id"])
            nb = {
                "id": "nb_" + hashlib.sha1(r["url"].encode()).hexdigest()[:10],
                "clientId": client["id"], "contractId": ct["id"] if ct else "",
                "n": next_n[client["id"]], "sku": code, "csku": "", "title": name,
                "svc": "standard", "status": new_status, "pri": "normal",
                "created": (r.get("date:Data FBX:start") or TODAY),
                **common,
            }
            if new_status == "published": nb["published"] = r.get("date:Data link:start") or TODAY
            if not ct: skipped["sem contrato na marca (bloco criado sem contrato)"].append(code)
            sl = slug_from_link(link)
            if sl and sl in slug_any and slug_any[sl][0] != client["id"]:
                cross.append((client["name"], code, link, slug_any[sl][0]))
            if link and new_status in ("published", "bim_conversion", "awaiting_client_final_validation"):
                mv = re.search(r"/ver-(\d+)/", link)
                new_pubs.append({"id": f"pub_{nb['id']}", "blockId": nb["id"], "url": link,
                    "embed": f'<iframe width="100%" height="640px" frameborder="0" src="{link}" allow="camera; gyroscope; accelerometer; xr-spatial-tracking; fullscreen"></iframe>',
                    "env": "production", "v": int(mv.group(1)) if mv else 1})
            creates.append(nb)
            report[f"novo bloco"] += 1
            if name == code or name.isdigit() or re.search(r"E\d+$", code):
                report["  ↳ novo bloco SEM nome legível no Notion (título = código; Jessica revisa)"] += 1

    # ---------- relatório ----------
    print("\n== Resultado ==")
    for k, v in report.most_common(): print(f"  {v:4d}  {k}")
    print("\n== Novos blocos por marca ==")
    cnt = collections.Counter(next((c["name"] for c in clients if c["id"] == b["clientId"]), "?") for b in creates)
    for k, v in cnt.most_common(): print(f"  {v:4d}  {k}")
    print("\n== Novos blocos por status ==")
    for k, v in collections.Counter(b["status"] for b in creates).most_common(): print(f"  {v:4d}  {k}")
    print("\n== Mudanças de status em blocos existentes ==")
    for k, v in status_changes.most_common(): print(f"  {v:4d}  {k}")
    print(f"\n== Divergências (portal publicado, Notion atrás — mantidos, revisar): {len(conflicts)} ==")
    for c in conflicts[:15]: print("  ", " · ".join(str(x) for x in c))
    if len(conflicts) > 15: print(f"   … e mais {len(conflicts)-15}")
    print(f"\n== Possíveis duplicatas cruzadas (link com slug já usado por bloco de OUTRA marca): {len(cross)} ==")
    for c in cross[:10]: print("  ", " · ".join(str(x) for x in c))
    print(f"\n== Clientes/contratos a criar: {[c['name'] for c in new_clients]} ==")
    print(f"== Publicações a criar para blocos novos com link: {len(new_pubs)} ==")
    print("\n== Pulados ==")
    for k, v in skipped.items(): print(f"  {len(v):4d}  {k}" + (f"  ex.: {v[:3]}" if len(v) <= 12 else f"  ex.: {v[:3]} …"))

    out = {"creates": creates, "updates": updates, "conflicts": conflicts, "skipped": {k: v for k, v in skipped.items()},
           "new_clients": new_clients, "new_contracts": new_contracts, "new_pubs": new_pubs, "cross": cross}
    json.dump(out, open(os.path.join(HERE, "import-plan.json"), "w"), ensure_ascii=False, indent=1)
    print(f"\nplano gravado em import-plan.json ({len(creates)} criar, {len(updates)} atualizar)")

    if not APPLY:
        print("\nDRY-RUN — nada foi escrito. Rode com --apply para gravar."); return

    # ---------- gravação ----------
    items = creates + updates
    print(f"\nGravando {len(items)} itens em att-blocks (batch de 25)…")
    for i in range(0, len(items), 25):
        chunk = items[i:i+25]
        req = {"att-blocks": [{"PutRequest": {"Item": {k: marshal(v) for k, v in it.items() if v is not None}}} for it in chunk]}
        tmp = os.path.join(HERE, "_batch.json"); json.dump(req, open(tmp, "w"), ensure_ascii=False)
        r = subprocess.run(["aws", "dynamodb", "batch-write-item", "--request-items", f"file://{tmp}", "--region", "us-east-1", "--profile", "att-admin", "--output", "json"], capture_output=True, text=True)
        if r.returncode: raise SystemExit(r.stderr)
        un = json.loads(r.stdout).get("UnprocessedItems", {})
        if un: raise SystemExit(f"itens não processados no lote {i}: {un}")
        print(f"  {min(i+25, len(items))}/{len(items)}")
    def batch(table, its):
        for i in range(0, len(its), 25):
            chunk = its[i:i+25]
            req = {table: [{"PutRequest": {"Item": {k: marshal(v) for k, v in it.items() if v is not None}}} for it in chunk]}
            tmp = os.path.join(HERE, "_batch.json"); json.dump(req, open(tmp, "w"), ensure_ascii=False)
            r = subprocess.run(["aws", "dynamodb", "batch-write-item", "--request-items", f"file://{tmp}", "--region", "us-east-1", "--profile", "att-admin", "--output", "json"], capture_output=True, text=True)
            if r.returncode: raise SystemExit(r.stderr)
            if json.loads(r.stdout).get("UnprocessedItems"): raise SystemExit(f"não processado em {table} lote {i}")
    if new_clients: batch("att-clients", new_clients); print(f"clientes criados: {len(new_clients)}")
    if new_contracts: batch("att-contracts", new_contracts); print(f"contratos criados: {len(new_contracts)}")
    if new_pubs: batch("att-publications", new_pubs); print(f"publicações criadas: {len(new_pubs)}")
    print("OK — gravado.")

if __name__ == "__main__":
    main()
