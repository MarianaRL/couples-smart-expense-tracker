/* ==========================================================================
   Importação de extratos dentro do browser.
   PDF: descomprime os streams com DecompressionStream e reconstrói as linhas
   pela posição do texto, sem bibliotecas externas.
   CSV: deteta separador e mapeia colunas.
   ========================================================================== */

/* ---------- utilitários de bytes ---------- */
function bytesIndexOf(buf, pat, from){
  outer: for(let i=from; i<=buf.length-pat.length; i++){
    for(let j=0;j<pat.length;j++) if(buf[i+j]!==pat[j]) continue outer;
    return i;
  }
  return -1;
}
const ascii = s => Uint8Array.from([...s].map(c=>c.charCodeAt(0)));

async function inflate(bytes){
  for(const fmt of ["deflate","deflate-raw"]){
    try{
      const ds=new DecompressionStream(fmt);
      const out=new Response(new Blob([bytes]).stream().pipeThrough(ds));
      return new Uint8Array(await out.arrayBuffer());
    }catch(e){ /* tenta o formato seguinte */ }
  }
  return null;
}

/* ---------- extração de texto de um PDF ---------- */
const PDF_TOK = /\((?:\\.|[^()\\])*\)|\[(?:\\.|[^\]])*?\]\s*TJ|[-+]?\d*\.?\d+|[A-Za-z'"*]+/gs;

function pdfUnescape(s){
  let out="";
  for(let i=1;i<s.length-1;i++){
    const c=s[i];
    if(c==="\\"){
      const n=s[i+1];
      if(n==="("||n===")"||n==="\\"){ out+=n; i++; }
      else if(n==="n"){ out+="\n"; i++; }
      else if(n==="r"){ out+="\r"; i++; }
      else if(n==="t"){ out+="\t"; i++; }
      else if(n>="0"&&n<="7"){
        let oct=""; let j=i+1;
        while(j<s.length && oct.length<3 && s[j]>="0" && s[j]<="7"){ oct+=s[j]; j++; }
        out+=String.fromCharCode(parseInt(oct,8)&0xFF); i=j-1;
      } else i++;
    } else out+=c;
  }
  return out;
}
function arrText(a){
  const parts=a.match(/\((?:\\.|[^()\\])*\)/gs)||[];
  return parts.map(pdfUnescape).join("");
}

function extractRuns(content){
  const runs=[];
  let x=0,y=0,lx=0,ly=0,TL=0,nums=[];
  let m;
  PDF_TOK.lastIndex=0;
  while((m=PDF_TOK.exec(content))!==null){
    const t=m[0];
    if(t[0]==="("){ runs.push([x,y,pdfUnescape(t)]); nums=[]; }
    else if(t[0]==="["){ runs.push([x,y,arrText(t)]); nums=[]; }
    else if(/^[-+]?\d*\.?\d+$/.test(t)){ nums.push(parseFloat(t)); }
    else {
      if(t==="Tm" && nums.length>=6){ lx=nums[nums.length-2]; ly=nums[nums.length-1]; x=lx; y=ly; }
      else if((t==="Td"||t==="TD") && nums.length>=2){
        lx+=nums[nums.length-2]; ly+=nums[nums.length-1]; x=lx; y=ly;
        if(t==="TD") TL=-nums[nums.length-1];
      }
      else if(t==="TL" && nums.length) TL=nums[nums.length-1];
      else if(t==="T*"){ ly-=TL; x=lx; y=ly; }
      else if(t==="BT"){ x=y=lx=ly=0; }
      nums=[];
    }
  }
  return runs;
}

function groupLines(runs){
  const lines=new Map();
  for(const [x,y,t] of runs){
    if(!t.trim()) continue;
    const key=Math.round(y/2);
    if(!lines.has(key)) lines.set(key,[]);
    lines.get(key).push([x,t]);
  }
  return [...lines.entries()].sort((a,b)=>b[0]-a[0])
    .map(([,segs])=>segs.sort((a,b)=>a[0]-b[0]));
}

async function pdfTextLines(arrayBuffer){
  const buf=new Uint8Array(arrayBuffer);
  const S=ascii("stream"), E=ascii("endstream");
  const pages=[];
  let i=0;
  while(true){
    const s=bytesIndexOf(buf,S,i);
    if(s<0) break;
    let p=s+S.length;
    if(buf[p]===13) p++;
    if(buf[p]===10) p++;
    const e=bytesIndexOf(buf,E,p);
    if(e<0) break;
    i=e+E.length;
    const raw=buf.subarray(p,e);
    if(raw.length<20) continue;
    const inf=await inflate(raw);
    if(!inf) continue;
    const txt=new TextDecoder("latin1").decode(inf);
    if(!txt.includes("BT")) continue;
    pages.push(groupLines(extractRuns(txt)));
  }
  return pages;
}

/* ---------- extratos Moey / Crédito Agrícola ---------- */
const DATE2 = /^\s*(\d{2}-\d{2}-\d{4})\s*\/\s*(\d{2}-\d{2}-\d{4})(.*)$/;
const AMT   = /^[\d.]+,\d{2}$/;
const BALS  = /^([+-])\s*([\d.]+,\d{2})$/;
const NOISE = /(SALDO|CCAM|Sede|Cap\. ?Soc|DECO|Prémio|responsabilidade|Moey, marca|Nome|IBAN|BIC|Extracto|Data de Emissão|DESCRI|MOVIMENTOS|ACCOUNT|Página|taxa em referência)/i;
const eurNum = s => Math.round(parseFloat(s.replace(/\./g,"").replace(",","."))*100)/100;

function parseMoeyPages(pages){
  const txns=[];
  for(const lines of pages){
    for(let segs of lines){
      segs=segs.map(([x,t])=>[x,t.trim()]).filter(([,t])=>t);
      segs=segs.filter(([x,t])=>!(x<45 && /^[A-Z0-9]{6,10}$/.test(t)));
      if(!segs.length) continue;
      const [fx,ft]=segs[0];
      const m = fx<70 ? DATE2.exec(ft) : null;
      if(m){
        const [,d1,d2,rest]=m;
        const desc=[]; let amount=null, balance=null, sign=null;
        if(rest.trim()) desc.push(rest.trim());
        for(const [x,t] of segs.slice(1)){
          const bm=BALS.exec(t);
          if(x>=450 && bm){ sign=bm[1]; balance=eurNum(bm[2]); }
          else if(x>=415 && AMT.test(t)) amount=eurNum(t);
          else if(x<415) desc.push(t);
        }
        if(amount==null||balance==null) continue;
        const [dd,mm,yy]=d1.split("-");
        const [vd,vm,vy]=d2.split("-");
        txns.push({
          date:`${yy}-${mm}-${dd}`,
          valueDate:`${vy}-${vm}-${vd}`,
          desc:desc.join("").replace(/\s{2,}/g," ").trim(),
          amount: amount*(sign==="+"?1:-1),
          balance
        });
      } else if(txns.length && segs.length===1 && fx>=100 && fx<=420){
        if(!NOISE.test(ft)) txns[txns.length-1].desc += " "+ft;
      }
    }
  }
  return txns;
}

/* ---------- extratos genéricos (qualquer outro banco) ----------
   Sem layout fixo: procura uma linha de cabeçalho com rótulos conhecidos
   (Data, Descrição, Débito, Crédito, Saldo, ...) para saber a que coluna
   pertence cada valor; na falta de cabeçalho, usa a posição dos valores
   dentro da linha. O sinal do montante é confirmado pela diferença entre
   saldos consecutivos, sempre que essa informação existe. */
const HEAD_KEYS = {
  date:    /^(data|date|fecha)\b/i,
  desc:    /^(descri|histor|detalhe|memo|movimento|concepto|refer[eê]ncia|transaction|details)/i,
  debit:   /^(d[eé]bito|debit|sa[ií]da|cargo|payments?\/?debits?)/i,
  credit:  /^(cr[eé]dito|credit|entrada|abono|deposits?\/?credits?)/i,
  amount:  /^(montante|valor|importe|amount|value)/i,
  balance: /^(saldo|balance|balan[cç]o)/i
};
const DATE_ANY_START = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\s\-\/][A-Za-zçÇ]{3,9}\.?[\s\-\/,]+\d{2,4}|[A-Za-zçÇ]{3,9}\.?[\s\-\/,]+\d{1,2},?[\s\-\/,]+\d{2,4})/;
const NOISE_GENERIC = /(p[aá]gina|page \d|iban|bic|swift|extracto|extrato|statement|saldo (inicial|final|anterior)|total de|nif|nipc|www\.|https?:\/\/)/i;
function looksLikeAmount(t){
  return /^[+-]?\(?(?:\d{1,3}(?:[.,]\d{3})*|\d+)[.,]\d{2}\)?-?$/.test(t);
}
function findHeaderCols(allLines){
  for(const segs of allLines){
    const roles=[];
    for(const [x,raw] of segs){
      const txt=raw.trim();
      for(const role in HEAD_KEYS){
        if(HEAD_KEYS[role].test(txt)){ roles.push({x,role}); break; }
      }
    }
    const has=r=>roles.some(o=>o.role===r);
    if(has("date") && (has("amount")||has("balance")||has("debit")||has("credit"))) return roles;
  }
  return null;
}
function parseGenericPages(pages){
  const allLines=[]; for(const lines of pages) for(const segs of lines) allLines.push(segs);
  const cols=findHeaderCols(allLines);
  const numAnchors = cols? cols.filter(c=>c.role==="debit"||c.role==="credit"||c.role==="amount"||c.role==="balance") : [];
  const dateAnchor = cols? cols.find(c=>c.role==="date") : null;

  const txns=[];
  let prevBalance=null;
  for(const lines of pages){
    for(const raw of lines){
      const segs=raw.map(([x,t])=>[x,t.trim()]).filter(([,t])=>t);
      if(!segs.length) continue;
      const [fx,ft]=segs[0];
      const dm=DATE_ANY_START.exec(ft);
      const date=dm? parseDateAny(dm[1]) : null;
      const dateOk = date && (!dateAnchor || Math.abs(fx-dateAnchor.x)<80);
      if(dateOk){
        const rest0=ft.slice(dm[0].length).trim();
        const descParts=[]; if(rest0) descParts.push(rest0);
        const numSegs=[];
        for(const [x,t] of segs.slice(1)){
          if(looksLikeAmount(t)){
            const v=parseAmountAny(t);
            if(v!=null) numSegs.push({x,v}); else descParts.push(t);
          } else descParts.push(t);
        }
        if(!numSegs.length) continue;
        let amount=null, balance=null, debit=null, credit=null;
        if(numAnchors.length){
          for(const ns of numSegs){
            let best=null,bd=Infinity;
            for(const a of numAnchors){ const d=Math.abs(ns.x-a.x); if(d<bd){ bd=d; best=a; } }
            if(!best) continue;
            if(best.role==="balance") balance=ns.v;
            else if(best.role==="amount") amount=ns.v;
            else if(best.role==="debit") debit=ns.v;
            else if(best.role==="credit") credit=ns.v;
          }
        }
        if(amount==null && balance==null && debit==null && credit==null){
          numSegs.sort((a,b)=>a.x-b.x);
          if(numSegs.length>=2){ balance=numSegs[numSegs.length-1].v; amount=-Math.abs(numSegs[numSegs.length-2].v); }
          else amount=-Math.abs(numSegs[0].v);
        }
        if(amount==null && (debit!=null||credit!=null)){
          if(debit!=null) amount=-Math.abs(debit);
          else amount=Math.abs(credit);
        }
        if(amount==null) continue;
        if(balance!=null && prevBalance!=null){
          const diff=Math.round((balance-prevBalance)*100)/100, absA=Math.abs(amount);
          if(Math.abs(diff-absA)<0.02) amount=absA;
          else if(Math.abs(diff+absA)<0.02) amount=-absA;
        }
        txns.push({
          date, valueDate:date,
          desc: descParts.join(" ").replace(/\s{2,}/g," ").trim() || "Movimento importado",
          amount, balance
        });
        if(balance!=null) prevBalance=balance;
      } else if(txns.length && segs.length===1 && !looksLikeAmount(ft) && ft.length>2 && !NOISE_GENERIC.test(ft) && fx>=30){
        txns[txns.length-1].desc += " "+ft;
      }
    }
  }
  return txns;
}

async function importPdf(file){
  const pages = await pdfTextLines(await file.arrayBuffer());
  let txns = parseMoeyPages(pages);
  if(!txns.length) txns = parseGenericPages(pages);
  /* validação: a cadeia de saldos tem de fechar, quando há saldo a validar */
  let breaks=0;
  for(let i=1;i<txns.length;i++){
    if(txns[i-1].balance==null || txns[i].balance==null) continue;
    if(Math.abs(Math.round((txns[i-1].balance+txns[i].amount)*100)/100 - txns[i].balance) > 0.005) breaks++;
  }
  return {txns, breaks, pages:pages.length};
}

/* ---------- CSV ---------- */
function splitCSVLine(line, sep){
  const out=[]; let cur=""; let q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(q){
      if(c==='"'&&line[i+1]==='"'){ cur+='"'; i++; }
      else if(c==='"') q=false;
      else cur+=c;
    } else if(c==='"') q=true;
    else if(c===sep){ out.push(cur); cur=""; }
    else cur+=c;
  }
  out.push(cur);
  return out.map(s=>s.trim());
}
function parseCSV(text){
  const clean=text.replace(/^﻿/,"");
  const lines=clean.split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length) return {rows:[],sep:";"};
  const counts={};
  for(const s of [";",",","\t","|"]) counts[s]=(lines[0].split(s).length-1);
  const sep=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
  return {rows:lines.map(l=>splitCSVLine(l,sep)), sep};
}
/* datas em vários formatos comuns, incluindo nomes de mês PT/EN */
const MONTH_NUM = {
  jan:1,fev:2,feb:2,mar:3,abr:4,apr:4,mai:5,may:5,jun:6,jul:7,
  ago:8,aug:8,set:9,sep:9,out:10,oct:10,nov:11,dez:12,dec:12
};
function parseDateAny(s){
  s=(s||"").trim();
  let m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s); if(m) return `${m[1]}-${m[2]}-${m[3]}`;
  m=/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(s);
  if(m) return `${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  m=/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2})$/.exec(s);
  if(m) return `20${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  m=/^(\d{1,2})[\s\-\/]+([A-Za-zçÇ]{3,9})\.?[\s\-\/,]+(\d{2,4})$/.exec(s);
  if(m){
    const mo=MONTH_NUM[m[2].slice(0,3).toLowerCase()];
    if(mo){ let y=m[3]; if(y.length===2) y="20"+y; return `${y}-${String(mo).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`; }
  }
  m=/^([A-Za-zçÇ]{3,9})\.?[\s\-\/,]+(\d{1,2}),?[\s\-\/,]+(\d{2,4})$/.exec(s);
  if(m){
    const mo=MONTH_NUM[m[1].slice(0,3).toLowerCase()];
    if(mo){ let y=m[3]; if(y.length===2) y="20"+y; return `${y}-${String(mo).padStart(2,"0")}-${String(m[2]).padStart(2,"0")}`; }
  }
  return null;
}
/* valores "1.234,56" | "1,234.56" | "-12.34" */
function parseAmountAny(s){
  s=(s||"").trim().replace(/\s|€|EUR/gi,"");
  if(!s) return null;
  let neg = /^\(.*\)$/.test(s) || s.startsWith("-") || /-$/.test(s);
  s=s.replace(/[()]/g,"").replace(/^[-+]/,"").replace(/-$/,"");
  if(/,\d{1,2}$/.test(s)) s=s.replace(/\./g,"").replace(",",".");
  else s=s.replace(/,/g,"");
  const v=parseFloat(s);
  if(isNaN(v)) return null;
  return neg? -Math.abs(v) : v;
}
/* adivinha que coluna é o quê */
function guessColumns(rows){
  const head=rows[0].map(h=>h.toLowerCase());
  const body=rows.slice(1, 40);
  const find=(...keys)=>head.findIndex(h=>keys.some(k=>h.includes(k)));
  let date=find("data mov","data lanç","data lanc","data valor","data","date");
  let desc=find("descri","descript","movimento","histórico","historico","detalhe","memo","referência","referencia");
  let amount=find("montante","valor","importe","amount","débito","credito","crédito");
  let debit=find("débito","debito"), credit=find("crédito","credito");
  let balance=find("saldo","balance");
  const score=(i,fn)=>body.filter(r=>r[i]!=null&&fn(r[i])).length;
  if(date<0) for(let i=0;i<rows[0].length;i++) if(score(i,v=>parseDateAny(v))>body.length*0.7){ date=i; break; }
  if(amount<0) for(let i=0;i<rows[0].length;i++)
    if(i!==date && i!==balance && score(i,v=>parseAmountAny(v)!==null)>body.length*0.7){ amount=i; break; }
  if(desc<0) for(let i=0;i<rows[0].length;i++)
    if(i!==date && i!==amount && score(i,v=>String(v).length>6 && !parseDateAny(v))>body.length*0.5){ desc=i; break; }
  return {date, desc, amount, balance, debit, credit,
          hasHeader: !parseDateAny(rows[0][date>=0?date:0])};
}
function csvToTxns(rows, map){
  const start = map.hasHeader? 1 : 0;
  const out=[];
  for(let i=start;i<rows.length;i++){
    const r=rows[i];
    const date=parseDateAny(r[map.date]);
    if(!date) continue;
    let amount=null;
    if(map.amount>=0) amount=parseAmountAny(r[map.amount]);
    if(amount==null && map.debit>=0 && map.credit>=0){
      const d=parseAmountAny(r[map.debit]), c=parseAmountAny(r[map.credit]);
      if(d) amount=-Math.abs(d); else if(c) amount=Math.abs(c);
    }
    if(amount==null || !isFinite(amount)) continue;
    const desc=(map.desc>=0? r[map.desc] : "").trim() || "Movimento importado";
    const balance = map.balance>=0? (parseAmountAny(r[map.balance]) ?? 0) : 0;
    out.push({date, valueDate:date, desc, amount, balance});
  }
  return out;
}
