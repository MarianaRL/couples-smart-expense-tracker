#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Constrói a app numa única página HTML.

  python3 build.py                -> dist/index.html com os dados de demonstração
  python3 build.py --data FICH    -> usa outro ficheiro de transações
  python3 build.py --empty        -> app sem dados, para importar os teus
"""
import argparse, json, pathlib, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
ORDER = ["i18n.js", "rules.js", "import.js", "chat.js", "app.js", "ui_assist.js"]

def build(data_path, out_path):
    tpl = (SRC / "index.html").read_text(encoding="utf-8")
    data = [] if data_path is None else json.loads(pathlib.Path(data_path).read_text(encoding="utf-8"))
    for row in data:
        row.pop("month", None)
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    js = "\n".join((SRC / f).read_text(encoding="utf-8") for f in ORDER).replace("</", "<\\/")
    html = tpl.replace("/*__DATA__*/[]", payload).replace("/*__APP__*/", js)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    kb = len(html.encode("utf-8")) / 1024
    print(f"{out_path}  ·  {len(data)} transactions  ·  {kb:.0f} KB")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(ROOT / "demo" / "demo-transactions.json"))
    ap.add_argument("--empty", action="store_true")
    ap.add_argument("--out", default=str(ROOT / "dist" / "index.html"))
    a = ap.parse_args()
    build(None if a.empty else a.data, pathlib.Path(a.out))
