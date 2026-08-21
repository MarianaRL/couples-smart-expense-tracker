#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Aplica o motor de rules.py ao dataset e relata a cobertura."""
import json, re, sys
from collections import Counter, defaultdict
from rules import MERCHANTS, KEYWORDS, SIGN

CITY = (r"(PORTO|COIMBRA|BRAGA|LISBOA|LISBON|MATOSINHOS|GAIA|AVEIRO|GUIMARAES|VIANA|LEIRIA|"
        r"CASCAIS|SINTRA|FARO|BARCELONA|MADRID|LONDON|DUBLIN|LEON|VIGO|MAIA)")

def merchant_of(desc):
    m = re.sub(r"^(COMPRA|LEVANT)\s+", "", desc)
    m = re.sub(r"\s*0(561746|183372)(/\d+)?\s*", " ", m)
    m = re.sub(r"\s+FINAL BALANCE.*$", "", m, flags=re.I)
    return re.sub(r"\s{2,}", " ", m).strip()

def clean(m):
    """nome sem sufixo de cidade colado, para comparação"""
    return re.sub(CITY + r"\s*$", "", m, flags=re.I).strip()

def categorize(desc, amount):
    sign = "+" if amount > 0 else "-"
    m = merchant_of(desc)
    c = clean(m)
    # 1. comerciante conhecido (prefixo, sem maiúsculas)
    for key, cat in MERCHANTS.items():
        k = key.lower()
        if c.lower().startswith(k) or m.lower().startswith(k) or k in c.lower():
            if SIGN.get(cat, sign) == sign:
                return cat, "comerciante"
    # 2. palavras-chave
    for cat, rx in KEYWORDS:
        if SIGN.get(cat) and SIGN[cat] != sign:
            continue
        if re.search(rx, desc, re.I) or re.search(rx, c, re.I):
            return cat, "palavra-chave"
    # 3. genérico
    if sign == "+":
        return "Rendimentos", "genérico"
    return ("Outras compras" if desc.startswith("COMPRA") else "Outros"), "genérico"

def main():
    t = json.load(open("/home/claude/transactions.json"))
    old = {x["desc"]+x["date"]: x for x in json.load(open("/home/claude/transactions_cat.json"))}
    src = Counter()
    for x in t:
        x["merchant"] = merchant_of(x["desc"])
        cat, how = categorize(x["desc"], x["amount"])
        x["cat"] = cat
        src[how] += 1
    spend = defaultdict(float); cnt = Counter()
    for x in t:
        if x["amount"] < 0: spend[x["cat"]] += -x["amount"]
        cnt[x["cat"]] += 1
    print("=== categorias (nº movimentos / despesa)")
    for c, n in cnt.most_common():
        print(f"{n:5d}  {spend.get(c,0):10.2f}  {c}")
    print("\n=== origem da categoria:", dict(src))
    rest = [x for x in t if x["cat"] in ("Outras compras","Outros")]
    print(f"\n=== por identificar: {len(rest)} movimentos, "
          f"{sum(-x['amount'] for x in rest if x['amount']<0):.2f} EUR")
    oc = defaultdict(lambda:[0,0.0])
    for x in rest:
        if x["amount"] < 0:
            oc[x["merchant"][:26]][0]+=1; oc[x["merchant"][:26]][1]+=-x["amount"]
    for k,(n,v) in sorted(oc.items(), key=lambda kv:-kv[1][1])[:30]:
        print(f"  {n:3d} {v:8.2f}  {k}")
    json.dump(t, open("/home/claude/transactions_cat.json","w"), ensure_ascii=False)

if __name__ == "__main__":
    main()
