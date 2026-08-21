#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera dados de demonstração — casal fictício, comerciantes inventados.

Nada aqui vem de dados reais. Os nomes são inventados de propósito para não se
confundirem com negócios existentes. As categorias vêm atribuídas, e alguns
comerciantes ficam de fora de propósito para o painel de sugestões ter conteúdo.
"""
import json, random, datetime as dt
from collections import Counter

random.seed(20260821)
START, END = dt.date(2025, 11, 1), dt.date(2026, 8, 15)

# (descrição, categoria, min, max, vezes/mês)
RECURRING = [
    ("DD-00112233-NORTHWIND ENERGY",         "Contas da casa",         44,  71, 1),
    ("DD-00112244-CLEARWATER UTILITIES",     "Contas da casa",         17,  29, 1),
    ("DD-00112255-FIBRALINK COMMS",          "Contas da casa",         35,  35, 1),
    ("Trf ordem permanente SEPA+ H MARLOWE", "Renda",                 780, 780, 1),
    ("DD-00112266-IRONLEAF GYM",             "Desporto e ginásio",     29,  29, 1),
    ("COMPRA STREAMLY MEDIA",                "Subscrições e digital",   9,   9, 1),
    ("COMPRA CLOUDVAULT STORAGE",            "Subscrições e digital",   3,   3, 1),
    ("COMPRA HELIOS INSURANCE",              "Seguros",                31,  31, 1),
    ("ORDENADOS -HALCYON STUDIOS",           "Rendimentos",          1620,1620, 1),
    ("ORDENADOS -MERIDIAN LABS",             "Rendimentos",          1410,1410, 1),
]

# (descrição, categoria ou None para ficar por categorizar, min, max, vezes/mês)
FREQUENT = [
    ("COMPRA SUPERMERCADO VERDE",  "Supermercado",           9,  62, 13),
    ("COMPRA MERCEARIA DA ORLA",   "Supermercado",           4,  21,  6),
    ("COMPRA PADARIA AURORA",      "Restauração e cafés",  1.6,   9,  9),
    ("COMPRA CAFE LUMEN",          "Restauração e cafés",  1.4,   7, 11),
    ("COMPRA TASCA DO ORVALHO",    "Restauração e cafés",   11,  44,  5),
    ("COMPRA RAMEN KOJI",          "Restauração e cafés",   13,  39,  3),
    ("COMPRA PIZZARIA FORNALHA",   "Restauração e cafés",    9,  32,  3),
    ("COMPRA NIMBUS RIDES",        "Transportes",          3.2,  16, 11),
    ("COMPRA METRO CIDADE",        "Transportes",          1.7, 1.7,  6),
    ("COMPRA POSTO ARDENTE",       "Transportes",           38,  74,  2),
    ("OP BX VALOR 03 TRAN",        "Transportes",          3.1,  24,  4),
    ("COMPRA FARMACIA SOLARIS",    "Saúde e farmácia",       4,  27,  2),
    ("COMPRA LIVRARIA MARGEM",     "Roupa e lojas",          7,  31,  2),
    ("COMPRA CINEMA ODEON",        "Lazer e noite",          7,  19,  2),
    ("COMPRA BAR MERIDIANO",       "Lazer e noite",          4,  26,  4),
    ("COMPRA CLUB SUBSOLO",        "Lazer e noite",         10,  24,  2),
    ("COMPRA VESTE E CIA",         "Roupa e lojas",         14,  89,  2),
    ("COMPRA ZEPHYR FITNESS",      "Desporto e ginásio",    19,  74,  1),
    ("COMPRA ORBITA ONLINE",       "Compras online",         6,  58,  4),
    ("COMPRA PETALVE ANIMAIS",     "Animais",                9,  41,  1),
    ("LEVANT Caixa Central",       "Levantamentos",         20,  60,  1),
    # deixados por categorizar de propósito: alimentam o painel de sugestões
    ("COMPRA QUINTA DO ALECRIM",   None,                    12,  48,  1),
    ("COMPRA ATELIER NOVELO",      None,                     8,  35,  1),
    ("COMPRA CASA VENTURA",        None,                    15,  60,  1),
    ("COMPRA SQ *TERRA NOVA",      None,                     5,  22,  1),
]

TRIPS = [
    ("COMPRA AZUL AIRWAYS",      "Viagens",  78, 210),
    ("COMPRA HOTEL CANTIL",      "Viagens",  64, 190),
    ("COMPRA TERMINAL DUTY FRE", "Viagens",   9,  38),
    ("COMPRA TAXI AEROPORTO",    "Transportes", 14, 32),
]

OUT_NAMES = ["Trf imediata J MARLOWE", "Trf imediata R VALENTE", "Trf imediata C AZEVEDO"]
IN_NAMES  = ["IPS/R9900112233-J MARLOWE", "IPS/R9900112244-R VALENTE"]

money = lambda a, b: round(random.uniform(a, b), 2)

def month_days(y, m):
    nxt = dt.date(y + (m == 12), 1 if m == 12 else m + 1, 1)
    return (nxt - dt.date(y, m, 1)).days

rows = []
d = dt.date(START.year, START.month, 1)
while d <= END:
    y, m, nd = d.year, d.month, month_days(d.year, d.month)
    for desc, cat, lo, hi, times in RECURRING:
        for _ in range(times):
            amt = money(lo, hi)
            sign = 1 if desc.startswith("ORDENADOS") else -1
            rows.append((dt.date(y, m, random.randint(1, min(28, nd))), desc, sign * amt, cat))
    for desc, cat, lo, hi, weight in FREQUENT:
        for _ in range(max(0, int(random.gauss(weight, weight * 0.3)))):
            rows.append((dt.date(y, m, random.randint(1, nd)), desc, -money(lo, hi), cat))
    for _ in range(random.randint(1, 3)):
        rows.append((dt.date(y, m, random.randint(1, nd)), random.choice(OUT_NAMES),
                     -money(8, 120), "Transferências enviadas"))
    for _ in range(random.randint(1, 4)):
        rows.append((dt.date(y, m, random.randint(1, nd)), random.choice(IN_NAMES),
                     money(5, 90), "Transferências recebidas"))
    if m in (2, 5, 8):
        for desc, cat, lo, hi in TRIPS:
            rows.append((dt.date(y, m, random.randint(5, min(25, nd))), desc, -money(lo, hi), cat))
    d = dt.date(y + (m == 12), 1 if m == 12 else m + 1, 1)

rows = sorted([r for r in rows if START <= r[0] <= END], key=lambda r: r[0])

balance, out = 2450.0, []
for date, desc, amt, cat in rows:
    balance = round(balance + amt, 2)
    if balance < 200:
        extra = round(random.uniform(500, 900), 2)
        balance = round(balance + extra, 2)
        out.append({"date": date.isoformat(), "valueDate": date.isoformat(),
                    "desc": "IPS/R9900119999-SAVINGS TRANSFER", "amount": extra,
                    "balance": balance, "merchant": "SAVINGS TRANSFER",
                    "cat": "Transferências recebidas"})
    ref = "0" + random.choice(["561746", "183372"])
    full = desc if desc.startswith(("DD-", "Trf", "IPS/", "ORDENADOS", "OP BX", "LEVANT")) \
           else f"{desc} {ref}"
    merchant = desc.replace("COMPRA ", "").strip()
    out.append({"date": date.isoformat(), "valueDate": date.isoformat(), "desc": full,
                "amount": round(amt, 2), "balance": balance, "merchant": merchant,
                "cat": cat or ("Outras compras" if desc.startswith("COMPRA") else "Outros")})

json.dump(out, open("/home/claude/demo_transactions.json", "w"), ensure_ascii=False)

c = Counter(r["cat"] for r in out)
exp = sum(-r["amount"] for r in out if r["amount"] < 0)
inc = sum(r["amount"] for r in out if r["amount"] > 0)
print(f"{len(out)} movimentos · {out[0]['date']} a {out[-1]['date']}")
print(f"despesas {exp:.2f} · recebido {inc:.2f} · saldo final {out[-1]['balance']:.2f}")
for k, v in c.most_common():
    print(f"  {v:5d}  {k}")
