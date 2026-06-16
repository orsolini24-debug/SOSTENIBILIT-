import os, psycopg2, anthropic, csv, json, re, sys, time
from pathlib import Path

DB_URL=os.environ.get("DATABASE_URL","postgresql://neondb_owner:npg_pnzjqAK6Y4Gk@ep-shiny-leaf-al1zj3cc-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require")
AKEY=os.environ.get("ANTHROPIC_API_KEY","")
MODEL="claude-haiku-4-5-20251001"
PMI_PFX=tuple(f"{n:02d}_" for n in range(1,37))

INDICATORS={
"total_energy_consumption":("Consumo totale di energia (MWh o GJ)","energia|consumo elettrico|consumo totale di energia|total energy consumption|kwh|mwh|gj|energia totale|consumo energetico"),
"scope_1_ghg_emissions":("Emissioni GHG Scope 1 tCO2e","scope 1|emissioni dirette|ghg|co2|gas serra|riscaldamento|flotta"),
"scope_2_location_based_ghg_emissions":("Emissioni GHG Scope 2 location-based tCO2e","scope 2|location based|emissioni indirette|energia acquistata|scope 2 lb"),
"scope_2_market_based_ghg_emissions":("Emissioni GHG Scope 2 market-based tCO2e","scope 2|market based|emissioni indirette|scope 2 mb"),
"scope_3_total_ghg_emissions":("Emissioni GHG Scope 3 totali tCO2e","scope 3|catena del valore|emissioni indirette scope 3|totale scope 3|emissioni filiera"),
}

SYS="Estrai dato ESG. SOLO valore totale piu recente (2024/2023). found=false se assente. Numeri IT: punto=migliaia (75.317->75317). JSON valido, niente altro."

def get_chunks(cur,did,syns_str,n=5):
    syns=syns_str.split("|")
    ts=" OR ".join('"%s"'%s for s in syns)
    q="WITH sq AS (SELECT websearch_to_tsquery('italian',%s) q_it,websearch_to_tsquery('english',%s) q_en) SELECT page,text FROM document_chunks WHERE document_id=%s AND (to_tsvector('italian',text)@@(SELECT q_it FROM sq) OR to_tsvector('english',text)@@(SELECT q_en FROM sq)) ORDER BY (ts_rank_cd(to_tsvector('italian',text),(SELECT q_it FROM sq))+ts_rank_cd(to_tsvector('english',text),(SELECT q_en FROM sq))) DESC LIMIT %s"
    cur.execute(q,(ts,ts,did,n))
    return [{"page":r[0],"text":r[1]} for r in cur.fetchall()]

def call_llm(client,lbl,chunks):
    if not chunks: return {"found":False,"note":"no chunks"}
    ctx="\n---\n".join(f"[p.{c['page']}] {c['text'][:450]}" for c in chunks)
    pt=f"Indicatore: {lbl}\nCHUNK:\n{ctx}\nJSON: {{\"found\":true/false,\"raw_value\":\"..or null\",\"normalized_value\":num_or_null,\"unit\":\"tCO2e/MWh/etc or null\",\"year\":2024,\"page\":1,\"confidence\":\"alta/media/bassa\",\"note\":\"\"}}"
    for att in range(3):
        try:
            r=client.messages.create(model=MODEL,max_tokens=280,system=SYS,messages=[{"role":"user","content":pt}])
            raw=r.content[0].text.strip()
            raw=re.sub(r"^```json\s*","",raw); raw=re.sub(r"\s*```","",raw)
            return json.loads(raw.strip())
        except Exception as e:
            msg=str(e)
            if "429" in msg: time.sleep(5*(att+1)); continue
            return {"found":False,"note":msg[:60]}
    return {"found":False,"note":"rate_limit_x3"}

# parse args: ind_id [--skip N] [--append]
ind_id=sys.argv[1]
skip=0; append_mode=False
for i,a in enumerate(sys.argv[2:],2):
    if a=="--skip" and i+1<len(sys.argv): skip=int(sys.argv[i+1])
    if a=="--append": append_mode=True
lbl,syns_str=INDICATORS[ind_id]
out=Path(f"eval/pmi_{ind_id}.csv")

conn=psycopg2.connect(DB_URL); cur=conn.cursor()
cur.execute("SELECT id,name FROM documents WHERE status IN ('completed','ingested') ORDER BY name")
docs=[(d,n) for d,n in cur.fetchall() if any(n.startswith(p) for p in PMI_PFX)]
docs=docs[skip:]
print(f"Docs to process: {len(docs)} (skip={skip})")

client=anthropic.Anthropic(api_key=AKEY)
rows=[]; found=0
for did,nm in docs:
    co=re.sub(r"^\d{2}_","",nm.replace(".pdf","")).replace("_"," ").strip()
    chunks=get_chunks(cur,did,syns_str)
    res=call_llm(client,lbl,chunks)
    f=res.get("found",False)
    if f: found+=1
    nv=res.get("normalized_value"); pg=res.get("page","?"); cf=res.get("confidence","")
    tag=f"FOUND {nv} {res.get('unit','')} p.{pg} [{cf}]" if f else f"-- {res.get('note','')[:55]}"
    print(f"  {'V' if f else '-'} {co[:32]:<32} | {tag}", flush=True)
    rows.append({"doc_name":nm,"company":co,"indicator_id":ind_id,"found":f,
        "raw_value":res.get("raw_value") or "","normalized_value":nv if nv is not None else "",
        "unit":res.get("unit") or "","year":res.get("year") or "","page":pg if pg!="?" else "",
        "confidence":cf,"n_chunks":len(chunks),"note":res.get("note") or "",
        "reviewer_status":"","actual_value":"","reviewer_note":""})

print(f"\nDone: {found}/{len(rows)}")
fields=["doc_name","company","indicator_id","found","raw_value","normalized_value","unit","year","page","confidence","n_chunks","note","reviewer_status","actual_value","reviewer_note"]
mode="a" if append_mode and out.exists() else "w"
with open(out,mode,newline="",encoding="utf-8") as fh:
    w=csv.DictWriter(fh,fieldnames=fields)
    if mode=="w": w.writeheader()
    w.writerows(rows)
print(f"CSV -> {out} (mode={mode})")
conn.close()