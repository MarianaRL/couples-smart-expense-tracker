# Weekly spending: a shared-expenses tracker for couples

A single-file web app that turns bank statements into a picture of where a
couple's money goes. Every expense can be tagged as **yours**, **your
partner's**, or **shared**, so the split is visible instead of guessed.

Everything runs in the browser. Statements are parsed on your device, nothing
is uploaded, and there is no backend, no account and no tracking.

![Demo](docs/demo.gif)

*The demo above runs on invented data for a fictional couple.*

---

## What it does

**Reads your statements in the browser.** Drop in the monthly PDF statements
from your bank and they are parsed locally, with no upload and no third-party
service. The PDF text extractor is written from scratch on top of the browser's
own `DecompressionStream`, so there is no PDF library to trust or update. CSV
from any other bank works too, with the columns detected automatically and shown
to you for confirmation.

**Categorises automatically, then learns from you.** A rule engine assigns a
category from the transaction description. When you correct one, the correction
applies to every purchase from that merchant, and a small token model picks up
the pattern to suggest categories for merchants it has never seen. Your
corrections are weighted twelve times heavier than the automatic guesses, so the
model follows you rather than the other way round.

**Splits spending between two people.** Each transaction carries a person:
mine, my partner's, or shared. Shared is the default, so you only mark the
exceptions. The overview shows the weekly split and computes "your share" as
your own spending plus half of the shared.

**Takes instructions in plain language.** Type *"anything with cinema is
leisure"* or *"groceries over 40 are shared"* and the assistant shows you the
rule it understood, how many transactions it matches and three examples, before
anything is applied. It also answers questions such as *"how much did I spend on
transport in June?"*. This runs entirely offline, with no API key, no cost and
no data leaving the device. An Anthropic API key can be added for free-form
chat, but it is optional and off by default.

**Charts that show both directions.** Spending sits above the axis and money
received below it, on one shared scale, never a second y-axis. Weekly totals,
category stacks, and a drill-down into any week's transactions.

**Bilingual and themed.** English and Portuguese, picked from your browser and
switchable at any time. Light and dark themes.

---

## Quick start

```bash
git clone https://github.com/<your-user>/weekly-spending.git
cd weekly-spending
python3 build.py              # builds dist/index.html with the demo data
open dist/index.html          # or just double-click it
```

To start empty and import your own statements:

```bash
python3 build.py --empty --out dist/index.html
```

There is nothing to install. `build.py` only concatenates the sources into one
HTML file; the app itself is plain JavaScript with no dependencies.

---

## Your data

The repository ships with **invented data only**: a fictional couple, fictional
merchants. No real statement is included, and `.gitignore` is set up to keep
real ones out.

Anything you import stays in your browser's local storage, on the device where
you imported it. It is never sent anywhere. The Settings tab has an export
button that writes your categories, rules and assignments to a JSON file, which
is how you move them to another device or keep a backup.

Two consequences worth knowing: clearing your browser data clears your
customisations, and what you categorise on your laptop will not appear on your
phone unless you export and import.

---

## Layout

```
src/
  index.html      markup, styles, and the two placeholders build.py fills
  i18n.js         English and Portuguese strings, category labels
  rules.js        categorisation engine (generated from tools/rules.py)
  import.js       PDF text extraction and CSV parsing, no libraries
  chat.js         natural-language rule interpreter and question answering
  app.js          state, charts, tables, settings
  ui_assist.js    import UI, assistant UI, rules list
tools/
  rules.py        the categorisation rules, single source of truth
  categorize.py   applies the rules to a dataset offline
  make_demo.py    regenerates the demo dataset
demo/
  demo-transactions.json
build.py          concatenates src/ into dist/index.html
```

The categorisation rules live in `tools/rules.py` and are compiled into
`src/rules.js`, so the Python pipeline and the browser always agree.

---

## Bank support

PDF parsing reconstructs each line from the text positions on the page, which
also means it recovers statements whose cross-reference tables are damaged.
Several of the statements this was built against would not open in a normal PDF
reader.

There are two parsers, tried in order. The first is tuned to **Moey / Crédito
Agrícola** monthly statements (Portugal) and their exact column layout. If that
finds nothing, a generic parser takes over: it looks for a header row (Date,
Description, Debit, Credit, Balance, ...) in PT or EN to work out what each
column means, and falls back to reading the trailing numbers on each
transaction line by position when there is no header. Where a running balance
is present, it is used to double-check the sign of each amount, which makes the
generic parser reasonably layout-agnostic without any bank-specific code.

This covers most PDF statements, but it is a heuristic, not a full PDF-table
parser, so unusual layouts can still fail. When a PDF does not parse, export
CSV instead and use the CSV importer, which detects columns automatically and
shows them to you for confirmation.

Re-importing a statement you already loaded adds nothing: transactions are
identified by date, amount and running balance, which survives the small
differences in how a description gets split across lines.

---

## Limitations

- The free-form chat needs an Anthropic API key and only works when you open the
  built file directly. Hosted environments with a strict content-security policy
  block the call; the offline interpreter answers instead.
- The natural-language interpreter understands categorisation requests and
  questions about the numbers. It is a parser, not a language model, and it will
  tell you when it has not understood rather than guess.
- Category names are stored internally in Portuguese and displayed translated,
  so exported files stay compatible across languages.

---

## Licence

MIT. See [LICENSE](LICENSE).
