"use strict";
/* ============ armazenamento seguro (fallback em memória) ============ */
const memStore = {};
const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return memStore[k] ?? null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch(e){} memStore[k]=v; },
  del(k){ try { localStorage.removeItem(k); } catch(e){} delete memStore[k]; }
};

/* ============ categorias: cores por defeito [claro, escuro] ============ */
const CAT_DEFS = {
  "Outras compras":            { c:["#2a78d6","#3987e5"], inc:true },
  "Renda":                     { c:["#eb6834","#d95926"], inc:true },
  "Viagens":                   { c:["#1baf7a","#199e70"], inc:true },
  "Supermercado":              { c:["#eda100","#c98500"], inc:true },
  "Transportes":               { c:["#e87ba4","#d55181"], inc:true },
  "Compras online":            { c:["#008300","#008300"], inc:true },
  "Restauração e cafés":       { c:["#4a3aa7","#9085e9"], inc:true },
  "Lazer e noite":             { c:["#e34948","#e66767"], inc:true },
  "Roupa e lojas":             { c:["#8e5bbf","#a97fd6"], inc:true },
  "Levantamentos":             { c:["#708090","#8a9bab"], inc:true },
  "Contas da casa":            { c:["#b5651d","#c97b35"], inc:true },
  "Subscrições e digital":     { c:["#17879c","#2ba3b8"], inc:true },
  "Desporto e ginásio":        { c:["#6a994e","#7fb069"], inc:true },
  "Saúde e farmácia":          { c:["#2f9e9e","#43b3b3"], inc:true },
  "Seguros":                   { c:["#7a6ea8","#9186c4"], inc:true },
  "Animais":                   { c:["#8a6d3b","#a58854"], inc:true },
  "Impostos e Estado":         { c:["#5f6b7a","#7d8b9c"], inc:true },
  "Comissões e taxas":         { c:["#97795b","#ab8d6f"], inc:true },
  "Outros":                    { c:["#8d8d85","#a0a098"], inc:true },
  "Transferências enviadas":   { c:["#9c4668","#b8607f"], inc:false },
  "Transferências recebidas":  { c:["#4f9d69","#63b17d"], inc:false },
  "Investimentos":             { c:["#b8860b","#cf9d22"], inc:false },
  "Rendimentos":               { c:["#1f6f43","#2f8f5b"], inc:false },
};
const FOLD_COLOR = ["#b0afa6","#6f6e66"];

/* ============ pessoas (camada de atribuição) ============ */
const OWNERS = ["Minha","Namorado","Partilhada"];
const OWNER_DEFS = {
  "Minha":      { c:["#2a78d6","#3987e5"] },
  "Namorado":   { c:["#eb6834","#d95926"] },
  "Partilhada": { c:["#1baf7a","#199e70"] },
};
const OWNER_DEFAULT = "Partilhada";

/* ============ dados ============ */
/* SEED = o que veio dos extratos já processados; os importados na app juntam-se
   a este. Os ids são estáveis (data+valor+descrição) para que as tuas correções
   sobrevivam a novas importações. */
const SEED = DATA.slice();
/* o saldo corrente distingue compras iguais no mesmo dia (8x BLOOM 12€, por
   exemplo); sem saldo, junta-se um contador de ocorrência */
/* com saldo corrente, data+valor+saldo identifica o movimento sem depender da
   descrição (que pode variar conforme o extrato parte a linha ao meio) */
const keyBase = t => t.balance
  ? `${t.date}|${t.amount}|${t.balance}`
  : `${t.date}|${t.amount}|${(t.desc||"").slice(0,60)}`;
function keyOf(t, seen){
  const base=keyBase(t);
  if(!seen) return t.id || base;
  let k=base, i=2;
  while(seen.has(k)){ k=base+"#"+i; i++; }
  return k;
}
let imported = [];
try { imported = JSON.parse(store.get("gastos.imported")||"[]"); } catch(e){ imported=[]; }
const saveImported = () => store.set("gastos.imported", JSON.stringify(imported));
function rebuildData(){
  const seen=new Set(), out=[];
  for(const t of SEED.concat(imported)){
    const k=keyOf(t,seen);
    seen.add(k);
    t.id=k;
    if(t._baseCat===undefined) t._baseCat=t.cat;
    out.push(t);
  }
  out.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  DATA.length=0; DATA.push(...out);
  BY_ID=new Map(DATA.map(t=>[t.id,t]));
}
let BY_ID=new Map();
/* migração: ids antigos eram índices numéricos */
function migrateIds(o){
  for(const bag of ["byId","ownerById"]){
    const src=o[bag]||{};
    const dst={};
    for(const [k,v] of Object.entries(src)){
      if(/^\d+$/.test(k)){ const t=SEED[+k]; if(t) dst[keyBase(t)]=v; }
      else dst[k]=v;
    }
    o[bag]=dst;
  }
}
const CATS = Object.keys(CAT_DEFS);
const kindOf = t => t.amount>0 ? "receita"
  : /^COMPRA/.test(t.desc) ? "compra"
  : /^DD-/.test(t.desc) ? "dd"
  : /^LEVANT/.test(t.desc) ? "lev"
  : /^(Trf|TRF|TRANSF)/i.test(t.desc) ? "trf" : "outro";
const tagKinds = () => DATA.forEach(t=>{ t.kind = kindOf(t); });

/* cobertura de dados: do primeiro ao último movimento que existe */
let MIN_DATE="2025-09-01", MAX_DATE="2026-07-31";
function recomputeCoverage(){
  if(!DATA.length) return;
  MIN_DATE=DATA[0].date; MAX_DATE=DATA[DATA.length-1].date;
}
const isCovered = iso => iso>=MIN_DATE && iso<=MAX_DATE;

/* ============ definições persistidas ============ */
let settings = { colors:{}, include:{}, incInclude:{}, customCats:{}, rules:[] };
let overrides = { byMerchant:{}, byId:{}, ownerByMerchant:{}, ownerById:{} };
try { const s = JSON.parse(store.get("gastos.settings")||"{}"); if(s.colors) settings={customCats:{},incInclude:{},rules:[],...s}; } catch(e){}
try { const o = JSON.parse(store.get("gastos.overrides")||"{}"); if(o.byMerchant) overrides={ownerByMerchant:{},ownerById:{},...o}; } catch(e){}
migrateIds(overrides);
const saveSettings = () => store.set("gastos.settings", JSON.stringify(settings));
const saveOverrides = () => { MODEL=null; store.set("gastos.overrides", JSON.stringify(overrides)); };

const darkMode = () => document.documentElement.getAttribute("data-theme")==="dark" ||
  (!document.documentElement.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
const catColor = c => settings.colors[c] || (CAT_DEFS[c]? CAT_DEFS[c].c[darkMode()?1:0] : FOLD_COLOR[darkMode()?1:0]);
const catIncluded = c => settings.include[c] !== undefined ? settings.include[c] : (CAT_DEFS[c]?CAT_DEFS[c].inc:true);
/* lado das receitas: por defeito conta tudo menos movimentos de dinheiro entre contas próprias */
const INC_OFF_BY_DEFAULT = new Set(["Investimentos","Transferências enviadas"]);
const incIncluded = c => settings.incInclude[c] !== undefined ? settings.incInclude[c] : !INC_OFF_BY_DEFAULT.has(c);
/* prioridade: esta transação > este comerciante > regras > categoria automática */
const catOf = t => overrides.byId[t.id] || overrides.byMerchant[t.merchant]
                || (rulesFor(t).cat) || t._baseCat || t.cat;
const allCats = () => [...CATS, ...Object.keys(settings.customCats)];
/* Regras por transação têm prioridade sobre as por comerciante. Ao aplicar a um
   comerciante inteiro, limpa as regras individuais desse comerciante — senão a
   alteração ficava silenciosamente anulada pelas regras antigas. */
function setCatForMerchant(merchant, v){
  overrides.byMerchant[merchant]=v;
  for(const t of DATA) if(t.merchant===merchant) delete overrides.byId[t.id];
}
function setOwnerForMerchant(merchant, v){
  overrides.ownerByMerchant[merchant]=v;
  for(const t of DATA) if(t.merchant===merchant) delete overrides.ownerById[t.id];
}
const CUSTOM_POOL = ["#c0574f","#3f8f6b","#7a5fb5","#c07830","#4f7fb0","#a05a86","#6e8f3f","#8f6e4f"];
function createCategory(name, color){
  name = (name||"").trim().slice(0,30);
  if(!name) return null;
  const existing = allCats().find(c=>c.toLowerCase()===name.toLowerCase());
  if(existing) return existing;
  settings.customCats[name] = true;
  settings.colors[name] = color || CUSTOM_POOL[Object.keys(settings.customCats).length % CUSTOM_POOL.length];
  saveSettings();
  return name;
}
function deleteCategory(name){
  if(!settings.customCats[name]) return;
  delete settings.customCats[name];
  delete settings.colors[name];
  delete settings.include[name];
  for(const k of Object.keys(overrides.byMerchant)) if(overrides.byMerchant[k]===name) delete overrides.byMerchant[k];
  for(const k of Object.keys(overrides.byId)) if(overrides.byId[k]===name) delete overrides.byId[k];
  if(state.cat===name) state.cat="all";
  saveSettings(); saveOverrides();
}
const ownerOf = t => overrides.ownerById[t.id] || overrides.ownerByMerchant[t.merchant]
                  || (rulesFor(t).owner) || OWNER_DEFAULT;
const ownerColor = o => settings.colors["pessoa:"+o] || (OWNER_DEFS[o]? OWNER_DEFS[o].c[darkMode()?1:0] : FOLD_COLOR[darkMode()?1:0]);
const OWNER_SHORT = { "Minha":"Minha", "Namorado":"Namorado", "Partilhada":"Partilhada" };

/* ============ aprendizagem a partir das categorizações ============
   Modelo simples de palavras: cada palavra do nome do comerciante vota nas
   categorias onde já apareceu. As tuas correções pesam muito mais do que a
   categorização automática, por isso o modelo segue-te a ti. */
const UNCAT = new Set(["Outras compras","Outros"]);
const STOPWORDS = new Set(["LDA","UNIPESSOAL","SOC","SOCIEDADE","COM","WWW","PT","ESP","THE","AND",
  "DOS","DAS","DEL","DOM","SAO","STA","STO","FINAL","BALANCE","AVAILABLE","COMPRA","TRAN","VALOR"]);
const CITY_TOKENS = new Set(["PORTO","COIMBRA","BRAGA","LISBOA","LISBON","MATOSINHOS","GAIA","AVEIRO",
  "GUIMARAES","VIANA","LEIRIA","CASCAIS","SINTRA","FARO","BARCELONA","MADRID","LONDON","DUBLIN",
  "LEON","VIGO","MAIA","AMSTERD","MUNCHEN","OSAKA","YAM"]);
function tokens(name){
  const up = name.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  const out=[];
  for(let w of up.split(/[^A-Z0-9]+/)){
    if(w.length<3 || /^\d+$/.test(w)) continue;
    if(STOPWORDS.has(w) || CITY_TOKENS.has(w)) continue;
    /* separa cidade colada ao nome: "IDIOTAPORTO" -> "IDIOTA" */
    for(const c of CITY_TOKENS) if(w.length>c.length+2 && w.endsWith(c)) w=w.slice(0,-c.length);
    if(w.length>=3) out.push(w);
  }
  return [...new Set(out)];
}
let MODEL=null;
function buildModel(){
  /* modelos separados por sinal: um nome que aparece em transferências recebidas
     não deve sugerir "Rendimentos" para uma compra */
  const mk=()=>new Map();
  const M={"-":mk(), "+":mk()};
  const add=(name,cat,weight,sign)=>{
    if(!cat || UNCAT.has(cat)) return;
    const tok=M[sign];
    for(const w of tokens(name)){
      if(!tok.has(w)) tok.set(w,new Map());
      const m=tok.get(w); m.set(cat,(m.get(cat)||0)+weight);
    }
  };
  const signOfId=id=>{ const t=BY_ID.get(id); return t && t.amount>0 ? "+" : "-"; };
  /* categorização automática: peso 1 */
  for(const t of DATA) add(t.merchant, t.cat, 1, t.amount>0?"+":"-");
  /* correções da Mariana: peso 12 — dominam sempre a automática */
  for(const [merch,cat] of Object.entries(overrides.byMerchant)){
    const any=DATA.find(t=>t.merchant===merch);
    add(merch,cat,12, any && any.amount>0 ? "+" : "-");
  }
  for(const [id,cat] of Object.entries(overrides.byId)){
    const t=BY_ID.get(id); if(t) add(t.merchant,cat,12,signOfId(id));
  }
  MODEL=M;
}
function suggestFor(name, sign){
  if(!MODEL) buildModel();
  const tokMap=MODEL[sign||"-"];
  const scores=new Map();
  const ts=tokens(name);
  for(const w of ts){
    const m=tokMap.get(w); if(!m) continue;
    const tot=[...m.values()].reduce((a,b)=>a+b,0);
    for(const [c,v] of m) scores.set(c,(scores.get(c)||0)+v/tot);
  }
  if(!scores.size) return null;
  const ranked=[...scores.entries()].sort((a,b)=>b[1]-a[1]);
  const total=ranked.reduce((a,[,v])=>a+v,0);
  const [cat,val]=ranked[0];
  const share=val/total;
  /* "forte" = uma só categoria domina e há mais do que uma palavra a apoiá-la */
  return {cat, share, strong: share>=0.65 && val>=0.9, matched: ts.length};
}

/* ============ utilitários ============ */
const tr_ = (k,...a) => t(k,...a);  /* alias: dentro de txRow/toggleDetail, 't' é a transação */
const $ = s => document.querySelector(s);
let fmtEUR, fmtEUR0;
function setLocale(){
  fmtEUR=new Intl.NumberFormat(LOCALE(),{style:"currency",currency:"EUR"});
  fmtEUR0=new Intl.NumberFormat(LOCALE(),{style:"currency",currency:"EUR",maximumFractionDigits:0});
}
setLocale();
const eur = v => fmtEUR.format(v);
const MESES_ = () => MONTH_NAMES[LANG];
const pDate = iso => new Date(iso+"T12:00:00");
const isoOf = d => d.toISOString().slice(0,10);
const fmtD = iso => { const d=pDate(iso); return `${d.getDate()} ${MESES_()[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDshort = iso => { const d=pDate(iso); return `${d.getDate()} ${MESES_()[d.getMonth()]}`; };
const addDays = (iso,n) => { const d=pDate(iso); d.setDate(d.getDate()+n); return isoOf(d); };
const mondayOf = iso => { const d=pDate(iso); const wd=(d.getDay()+6)%7; d.setDate(d.getDate()-wd); return isoOf(d); };
const weekLabel = wk => `${fmtDshort(wk)}–${fmtDshort(addDays(wk,6))}`;
const el = (tag, attrs, ...children) => {
  const e = document.createElement(tag);
  if(attrs) for(const [k,v] of Object.entries(attrs)){
    if(k==="class") e.className=v; else if(k==="style") e.style.cssText=v;
    else if(k.startsWith("on")) e.addEventListener(k.slice(2),v);
    else e.setAttribute(k,v);
  }
  for(const c of children) if(c!=null) e.append(c);
  return e;
};
const svgEl = (tag,attrs,...children)=>{
  const e=document.createElementNS("http://www.w3.org/2000/svg",tag);
  if(attrs) for(const [k,v] of Object.entries(attrs)){
    if(k.startsWith("on")) e.addEventListener(k.slice(2),v); else e.setAttribute(k,v);
  }
  for(const c of children) if(c!=null) e.append(c);
  return e;
};
const niceTicks = max => {
  if(max<=0) return [0,1];
  const step = [1,2,2.5,5,10].map(m=>m*Math.pow(10,Math.floor(Math.log10(max/4))))
    .find(s=>max/s<=5.5) || Math.pow(10,Math.ceil(Math.log10(max/4)));
  const out=[]; for(let v=0;v<=max+1e-9;v+=step) out.push(Math.round(v*100)/100);
  if(out[out.length-1]<max) out.push(out[out.length-1]+step);
  return out;
};

/* ============ estado de filtros ============ */
const state = {
  range:"w12", from:null, to:null,
  kind:"all", cat:"all", owner:"all", search:"",
  week:null,           // semana selecionada (drill)
  selection:new Set(), // ids selecionados para ações em massa
  openDetail:null,     // id da transação com o detalhe aberto
  tab:"overview",
  sort:{key:"date", dir:-1},
  page:0,
};

function rangeBounds(){
  const last = MAX_DATE;
  switch(state.range){
    case "w4":  return [addDays(mondayOf(last), -7*3), last];
    case "w12": return [addDays(mondayOf(last), -7*11), last];
    case "y2026": return ["2026-01-01", last];
    case "y2025": return [MIN_DATE, "2025-12-31"];
    case "custom": return [state.from||MIN_DATE, state.to||last];
    default: return [MIN_DATE, last];
  }
}

function passes(t, opts={}){
  const [a,b] = rangeBounds();
  if(t.date<a || t.date>b) return false;
  if(state.kind!=="all" && t.kind!==state.kind) return false;
  const c = catOf(t);
  if(state.cat!=="all" && c!==state.cat) return false;
  if(state.owner!=="all" && ownerOf(t)!==state.owner) return false;
  if(state.search){
    const q = state.search.toLowerCase();
    if(!t.desc.toLowerCase().includes(q) && !t.merchant.toLowerCase().includes(q) && !c.toLowerCase().includes(q)) return false;
  }
  if(opts.week && mondayOf(t.date)!==opts.week) return false;
  return true;
}
/* despesas que entram na análise (categoria filtrada entra sempre) */
const inAnalysis = t => t.amount<0 && (state.cat!=="all" ? catOf(t)===state.cat : catIncluded(catOf(t)));
const incInAnalysis = t => t.amount>0 && (state.cat!=="all" ? catOf(t)===state.cat : incIncluded(catOf(t)));

function weeksInRange(){
  const [a,b] = rangeBounds();
  const eff_a = a<MIN_DATE?MIN_DATE:a, eff_b = b>MAX_DATE?MAX_DATE:b;
  const out=[];
  for(let wk=mondayOf(eff_a); wk<=eff_b; wk=addDays(wk,7)){
    const days=[...Array(7)].map((_,i)=>addDays(wk,i));
    const covered = days.filter(isCovered).length;
    out.push({wk, hasData:covered>0, full:covered===7});
  }
  return out;
}

/* ============ agregações ============ */
function aggregate(){
  const txs = DATA.filter(t=>passes(t));
  const weeks = weeksInRange();
  const byWeek = new Map(weeks.map(w=>[w.wk,{...w, total:0, inc:0, cats:new Map(), owners:new Map(), txs:[]}]));
  const byCat = new Map(), byOwner = new Map();
  let totalExp=0, totalInc=0;
  for(const t of txs){
    const wk = mondayOf(t.date);
    const w = byWeek.get(wk);
    if(incInAnalysis(t)){ totalInc+=t.amount; if(w) w.inc=(w.inc||0)+t.amount; }
    if(inAnalysis(t)){
      const c = catOf(t), o = ownerOf(t), v=-t.amount;
      totalExp+=v;
      byCat.set(c,(byCat.get(c)||0)+v);
      byOwner.set(o,(byOwner.get(o)||0)+v);
      if(w){ w.total+=v; w.cats.set(c,(w.cats.get(c)||0)+v); w.owners.set(o,(w.owners.get(o)||0)+v); }
    }
    if(w) w.txs.push(t);
  }
  const dataWeeks = [...byWeek.values()].filter(w=>w.hasData);
  const avg = dataWeeks.length? totalExp/dataWeeks.length : 0;
  return { txs, weeks:[...byWeek.values()], byCat, byOwner, totalExp, totalInc, avg, nDataWeeks:dataWeeks.length };
}

/* média semanal do período homólogo anterior (para o delta) */
function prevAvg(){
  if(state.range==="all") return null;
  const [a,b] = rangeBounds();
  const days = Math.round((pDate(b)-pDate(a))/86400000)+1;
  const pb = addDays(a,-1), pa = addDays(pb,-(days-1));
  if(pb<MIN_DATE) return null;
  let tot=0; const wkSet=new Set();
  for(const t of DATA){
    if(t.date<pa||t.date>pb) continue;
    if(state.kind!=="all"&&t.kind!==state.kind) continue;
    if(state.search) continue;
    if(!inAnalysis(t)) continue;
    if(state.cat!=="all"&&catOf(t)!==state.cat) continue;
    tot+=-t.amount; wkSet.add(mondayOf(t.date));
  }
  let nw=0;
  for(let wk=mondayOf(pa); wk<=pb; wk=addDays(wk,7)){
    if([...Array(7)].map((_,i)=>addDays(wk,i)).some(isCovered)) nw++;
  }
  if(!nw||!tot) return null;
  return tot/nw;
}

/* ============ tooltip ============ */
const tt = $("#tooltip");
function showTT(evt, title, rows){
  tt.replaceChildren();
  if(title){ tt.append(el("div",{class:"tt-title"},title)); }
  for(const r of rows){
    const row = el("div",{class:"row"});
    if(r.color) row.append(el("span",{class:"key",style:`background:${r.color}`}));
    row.append(el("span",{class:"v"},r.value));
    if(r.name) row.append(el("span",{class:"n"},r.name));
    tt.append(row);
  }
  tt.style.display="block";
  moveTT(evt);
}
function moveTT(evt){
  const pad=14, w=tt.offsetWidth, h=tt.offsetHeight;
  let x=evt.clientX+pad, y=evt.clientY+pad;
  if(x+w>innerWidth-8) x=evt.clientX-w-pad;
  if(y+h>innerHeight-8) y=evt.clientY-h-pad;
  tt.style.left=x+"px"; tt.style.top=y+"px";
}
const hideTT = ()=>{ tt.style.display="none"; };

/* ============ KPIs ============ */
function renderKPIs(agg){
  const k = $("#kpis"); k.replaceChildren();
  const pv = prevAvg();
  let deltaNode=null;
  if(pv && agg.avg){
    const pct = (agg.avg-pv)/pv*100;
    const up = pct>=0;
    deltaNode = el("div",{class:"dlt"},
      el("span",{class:up?"up":"down"},`${up?"▲":"▼"} ${Math.abs(pct).toFixed(0)}%`),
      " "+t("vsPrev"));
  }
  const tiles = [
    [t("kpiAvg"), eur(agg.avg), deltaNode],
    [t("kpiTotal"), eur(agg.totalExp), el("div",{class:"dlt"},t("weeksWithData",agg.nDataWeeks))],
    [t("kpiIncome"), eur(agg.totalInc), el("div",{class:"dlt"},`${t("balance")} ${agg.totalInc-agg.totalExp>=0?"+":"−"}${eur(Math.abs(agg.totalInc-agg.totalExp))}`)],
    [t("kpiCount"), String(agg.txs.length), null],
  ];
  for(const [lbl,val,extra] of tiles){
    k.append(el("div",{class:"card tile",style:"margin:0"},
      el("div",{class:"lbl"},lbl), el("div",{class:"val"},val), extra));
  }
}

/* ============ gráfico semanal (colunas) ============ */
function renderWeekly(agg){
  const host = $("#weeklyChart"); host.replaceChildren();
  const weeks = agg.weeks;
  $("#weeklySub").textContent = state.cat!=="all" ? t("weeklySubCat",catLabel(state.cat)) : t("weeklySub");
  if(!weeks.length){ host.append(el("div",{class:"empty"},t("noData"))); return; }
  const INC_COLOR="#008300";
  const W = Math.max(560, Math.min(1020, host.clientWidth||1020)), H=300;
  const posMax0 = Math.max(...weeks.map(w=>w.total), 1);
  const negMax0 = Math.max(...weeks.map(w=>w.inc||0), 0);
  /* margem esquerda proporcional ao maior rótulo do eixo */
  const m = {t:18,r:8,b:34,l:Math.max(52, 16+7.2*fmtEUR0.format(Math.max(posMax0,negMax0)).length)};
  const iw = W-m.l-m.r, ih = H-m.t-m.b;
  const posMax = Math.max(...weeks.map(w=>w.total), 1);
  const negMax = Math.max(...weeks.map(w=>w.inc||0), 0);
  /* passo comum para os dois lados do eixo */
  const refTicks = niceTicks(Math.max(posMax, negMax, 1));
  const step = refTicks[1]-refTicks[0];
  const posTop = Math.max(step, Math.ceil(posMax/step)*step);
  const negTop = negMax>0 ? Math.ceil(negMax/step)*step : 0;
  const span = posTop+negTop;
  const y = v => m.t + (posTop-v)/span*ih;
  const band = iw/weeks.length;
  const bw = Math.min(24, Math.max(6, band*0.62));
  const svg = svgEl("svg",{viewBox:`0 0 ${W} ${H}`,width:"100%",role:"img","aria-label":"Despesas e dinheiro recebido por semana"});
  for(let tv=-negTop; tv<=posTop+1e-9; tv+=step){
    const tvr=Math.round(tv*100)/100;
    if(Math.abs(tvr)<1e-9) continue;
    svg.append(svgEl("line",{x1:m.l,x2:W-m.r,y1:y(tvr),y2:y(tvr),stroke:"var(--grid)","stroke-width":1}));
    svg.append(svgEl("text",{x:m.l-8,y:y(tvr)+4,"text-anchor":"end",class:"vlabel"},
      (tvr<0?"−":"")+fmtEUR0.format(Math.abs(tvr))));
  }
  svg.append(svgEl("line",{x1:m.l,x2:W-m.r,y1:y(0),y2:y(0),stroke:"var(--axis)","stroke-width":1}));
  svg.append(svgEl("text",{x:m.l-8,y:y(0)+4,"text-anchor":"end",class:"vlabel"},fmtEUR0.format(0)));
  const maxWeek = weeks.reduce((a,b)=>b.hasData&&b.total>(a?a.total:-1)?b:a,null);
  const lblEvery = Math.ceil(weeks.length/ (iw>700?10:6));
  weeks.forEach((w,i)=>{
    const cx = m.l+band*i+band/2;
    if(i%lblEvery===0) svg.append(svgEl("text",{x:cx,y:H-12,"text-anchor":"middle"},fmtDshort(w.wk)));
    const selected = state.week && state.week===w.wk;
    const dim = state.week && !selected;
    const bx = cx-bw/2;
    if(!w.hasData){
      svg.append(svgEl("line",{x1:cx-4,x2:cx+4,y1:y(0)-1,y2:y(0)-1,stroke:"var(--ink-3)","stroke-width":2,opacity:0.7}));
    } else {
      if(w.total>0){
        const h = Math.max(2, y(0)-y(w.total));
        const r = Math.min(4,h/2);
        const by=y(0)-h;
        const path = `M${bx},${y(0)} L${bx},${by+r} Q${bx},${by} ${bx+r},${by} L${bx+bw-r},${by} Q${bx+bw},${by} ${bx+bw},${by+r} L${bx+bw},${y(0)} Z`;
        svg.append(svgEl("path",{d:path,fill:"var(--accent)",opacity:dim?0.35:1}));
        if(maxWeek && w.wk===maxWeek.wk)
          svg.append(svgEl("text",{x:cx,y:by-6,"text-anchor":"middle",class:"vlabel"},fmtEUR0.format(w.total)));
      }
      if((w.inc||0)>0){
        const h = Math.max(2, y(-w.inc)-y(0));
        const r = Math.min(4,h/2);
        const byB=y(0)+h; /* fundo da barra negativa */
        const path = `M${bx},${y(0)+1} L${bx},${byB-r} Q${bx},${byB} ${bx+r},${byB} L${bx+bw-r},${byB} Q${bx+bw},${byB} ${bx+bw},${byB-r} L${bx+bw},${y(0)+1} Z`;
        svg.append(svgEl("path",{d:path,fill:INC_COLOR,opacity:dim?0.35:1}));
      }
    }
    /* zona de interação: banda inteira */
    const hit = svgEl("rect",{x:m.l+band*i,y:m.t,width:band,height:ih,fill:"transparent",style:"cursor:pointer",tabindex:"0"});
    const ttShow = evt => {
      const rows=[];
      if(w.hasData){
        rows.push({color:"var(--accent)", value:eur(w.total), name:w.full?t("expenses"):t("incompleteWeek")});
        rows.push({color:INC_COLOR, value:eur(w.inc||0), name:t("received")});
        const bal=(w.inc||0)-w.total;
        rows.push({value:(bal>=0?"+":"−")+eur(Math.abs(bal)), name:t("balance")});
        [...w.cats.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3)
          .forEach(([c,v])=>rows.push({color:catColor(c), value:eur(v), name:catLabel(c)}));
      } else rows.push({value:t("noDataShort"), name:t("missingStatement")});
      showTT(evt, t("weekOf",weekLabel(w.wk)), rows);
    };
    hit.addEventListener("pointermove",ttShow);
    hit.addEventListener("focus",e=>ttShow({clientX:innerWidth/2,clientY:120}));
    hit.addEventListener("pointerleave",hideTT);
    hit.addEventListener("blur",hideTT);
    hit.addEventListener("click",()=>{ state.week = state.week===w.wk? null : w.wk; renderAll(); });
    svg.append(hit);
  });
  host.append(svg);
  /* legenda (2 séries) */
  const leg=el("div",{class:"legend"},
    el("span",{class:"it"},el("span",{class:"sw",style:"background:var(--accent)"}),t("legendExp")),
    el("span",{class:"it"},el("span",{class:"sw",style:`background:${INC_COLOR}`}),t("legendInc")));
  host.append(leg);
  /* tabela acessível */
  const tbl = el("table",{class:"weektbl"},
    el("tr",null,el("th",null,t("colWeek")),el("th",null,t("colExp")),el("th",null,t("colInc")),el("th",null,t("colBal"))),
    ...weeks.map(w=>{
      const bal=(w.inc||0)-w.total;
      return el("tr",null,
        el("td",null,weekLabel(w.wk)),
        el("td",null,w.hasData? eur(w.total) : t("noDataShort")),
        el("td",null,w.hasData? eur(w.inc||0) : "—"),
        el("td",null,w.hasData? (bal>=0?"+":"−")+eur(Math.abs(bal)) : "—"));
    }));
  $("#weeklyTbl").replaceChildren(tbl);
}

/* ============ drill-down da semana ============ */
function renderDrill(agg){
  const card = $("#weekDrill");
  if(!state.week){ card.style.display="none"; card.replaceChildren(); return; }
  const w = agg.weeks.find(x=>x.wk===state.week);
  card.style.display="block"; card.replaceChildren();
  card.append(el("h2",null,t("weekOf",weekLabel(state.week))));
  if(!w || !w.txs.length){
    card.append(el("p",{class:"sub"},t("noMovesWeek")));
    return;
  }
  card.append(el("p",{class:"sub"},
    t("drillExp",eur(w.total),w.txs.length),
    el("a",{class:"linky",onclick:()=>{state.week=null;renderAll();}},t("clearSel"))));
  /* barras por categoria da semana */
  const cats = [...w.cats.entries()].sort((a,b)=>b[1]-a[1]);
  if(cats.length){
    const maxv = cats[0][1];
    const box = el("div",{style:"margin:6px 0 14px"});
    for(const [c,v] of cats){
      const row = el("div",{style:"display:flex;align-items:center;gap:10px;margin:5px 0"});
      row.append(el("span",{style:"width:170px;flex:none;font-size:12.5px;color:var(--ink-2);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"},catLabel(c)));
      const track = el("div",{style:"flex:1;height:14px;position:relative"});
      track.append(el("div",{style:`position:absolute;left:0;top:1px;height:12px;width:${Math.max(1.5,v/maxv*100)}%;background:${catColor(c)};border-radius:0 4px 4px 0`}));
      row.append(track);
      row.append(el("span",{style:"width:90px;flex:none;font-size:12px;color:var(--ink-2);font-variant-numeric:tabular-nums;text-align:right"},eur(v)));
      box.append(row);
    }
    card.append(box);
  }
  card.append(txTableFor(w.txs.slice().sort((a,b)=>a.date<b.date?1:-1)));
}

/* ============ divisão por pessoa ============ */
function renderOwner(agg){
  const sum=$("#ownerSummary"), host=$("#ownerChart"), leg=$("#ownerLegend");
  sum.replaceChildren(); host.replaceChildren(); leg.replaceChildren();
  const mine=agg.byOwner.get("Minha")||0, his=agg.byOwner.get("Namorado")||0, shared=agg.byOwner.get("Partilhada")||0;
  const oLbl=ownerLabel;
  const total=mine+his+shared;
  /* resumo com barra 100% */
  const row=el("div",{style:"display:flex;gap:22px;flex-wrap:wrap;margin-bottom:12px"});
  for(const [o,v] of [["Minha",mine],["Namorado",his],["Partilhada",shared]]){
    row.append(el("div",null,
      el("div",{style:"font-size:12.5px;color:var(--ink-3)"},
        el("span",{class:"catdot",style:`background:${ownerColor(o)}`}),oLbl(o)),
      el("div",{style:"font-size:19px;font-weight:650;margin-top:1px"},eur(v)),
      el("div",{style:"font-size:12px;color:var(--ink-3)"},total? (v/total*100).toFixed(0)+"%" : "—")));
  }
  if(state.owner==="all"){
    row.append(el("div",{style:"margin-left:auto;text-align:right"},
      el("div",{style:"font-size:12.5px;color:var(--ink-3)"},t("myShare")),
      el("div",{style:"font-size:19px;font-weight:650;margin-top:1px"},eur(mine+shared/2)),
      el("div",{style:"font-size:12px;color:var(--ink-3)"},t("myShareSub"))));
  }
  sum.append(row);
  if(total>0){
    const bar=el("div",{style:"display:flex;height:14px;gap:2px"});
    for(const [o,v] of [["Minha",mine],["Namorado",his],["Partilhada",shared]]){
      if(v<=0) continue;
      bar.append(el("div",{style:`width:${v/total*100}%;background:${ownerColor(o)};border-radius:4px`,
        onpointermove:evt=>showTT(evt,ownerLabel(o),[{color:ownerColor(o),value:eur(v),name:t("ofExpenses",(v/total*100).toFixed(1))}]),
        onpointerleave:hideTT}));
    }
    sum.append(bar);
  }
  /* colunas semanais empilhadas por pessoa */
  const weeks=agg.weeks;
  if(!weeks.length||total<=0){ host.append(el("div",{class:"empty"},t("noData"))); return; }
  const W=Math.max(560,Math.min(1020,host.clientWidth||1020)), H=220;
  const m={t:14,r:8,b:34,l:46}, iw=W-m.l-m.r, ih=H-m.t-m.b;
  const max=Math.max(...weeks.map(w=>w.total),1);
  const ticks=niceTicks(max), ymax=ticks[ticks.length-1];
  const y=v=>m.t+ih-v/ymax*ih;
  const band=iw/weeks.length, bw=Math.min(24,Math.max(6,band*0.62));
  const svg=svgEl("svg",{viewBox:`0 0 ${W} ${H}`,width:"100%",role:"img","aria-label":"Despesas semanais por pessoa"});
  for(const tv of ticks){
    svg.append(svgEl("line",{x1:m.l,x2:W-m.r,y1:y(tv),y2:y(tv),stroke:"var(--grid)","stroke-width":1}));
    svg.append(svgEl("text",{x:m.l-8,y:y(tv)+4,"text-anchor":"end",class:"vlabel"},fmtEUR0.format(tv)));
  }
  svg.append(svgEl("line",{x1:m.l,x2:W-m.r,y1:y(0),y2:y(0),stroke:"var(--axis)","stroke-width":1}));
  const lblEvery=Math.ceil(weeks.length/(iw>700?10:6));
  weeks.forEach((w,i)=>{
    const cx=m.l+band*i+band/2, bx=cx-bw/2;
    if(i%lblEvery===0) svg.append(svgEl("text",{x:cx,y:H-12,"text-anchor":"middle"},fmtDshort(w.wk)));
    if(!w.hasData){
      svg.append(svgEl("line",{x1:cx-4,x2:cx+4,y1:y(0)-1,y2:y(0)-1,stroke:"var(--ink-3)","stroke-width":2,opacity:0.7}));
    } else {
      let acc=0;
      const segs=OWNERS.map(o=>({o,v:w.owners.get(o)||0})).filter(x=>x.v>0);
      segs.forEach((seg,si)=>{
        const y1=y(acc+seg.v), y0=y(acc);
        const hpx=Math.max(0.5,y0-y1-(si<segs.length-1?2:0));
        const isTop=si===segs.length-1;
        if(isTop&&hpx>3){
          const r=Math.min(4,hpx/2), by=y0-hpx;
          svg.append(svgEl("path",{d:`M${bx},${y0} L${bx},${by+r} Q${bx},${by} ${bx+r},${by} L${bx+bw-r},${by} Q${bx+bw},${by} ${bx+bw},${by+r} L${bx+bw},${y0} Z`,fill:ownerColor(seg.o)}));
        } else {
          svg.append(svgEl("rect",{x:bx,y:y0-hpx,width:bw,height:hpx,fill:ownerColor(seg.o)}));
        }
        acc+=seg.v;
      });
    }
    const hit=svgEl("rect",{x:m.l+band*i,y:m.t,width:band,height:ih,fill:"transparent",tabindex:"0"});
    const ttShow=evt=>{
      const rows=w.hasData
        ? OWNERS.map(o=>({o,v:w.owners.get(o)||0})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v)
            .map(x=>({color:ownerColor(x.o),value:eur(x.v),name:ownerLabel(x.o)}))
        : [{value:t("noDataShort"),name:t("missingStatement")}];
      if(w.hasData) rows.unshift({value:eur(w.total),name:t("total")});
      showTT(evt,t("weekOf",weekLabel(w.wk)),rows);
    };
    hit.addEventListener("pointermove",ttShow);
    hit.addEventListener("focus",e=>ttShow({clientX:innerWidth/2,clientY:200}));
    hit.addEventListener("pointerleave",hideTT); hit.addEventListener("blur",hideTT);
    svg.append(hit);
  });
  host.append(svg);
  for(const o of OWNERS)
    leg.append(el("span",{class:"it"},el("span",{class:"sw",style:`background:${ownerColor(o)}`}),ownerLabel(o)));
}

/* ============ gráfico empilhado por categoria ============ */
function renderStack(agg){
  const host = $("#stackChart"); host.replaceChildren();
  const leg = $("#stackLegend"); leg.replaceChildren();
  const weeks = agg.weeks;
  const top = [...agg.byCat.entries()].sort((a,b)=>b[1]-a[1]).slice(0,7).map(([c])=>c);
  const hasFold = agg.byCat.size>top.length;
  const series = hasFold? [...top,"__fold__"] : top;
  const nameOf = s => s==="__fold__"?t("othersCat"):catLabel(s);
  const colorOf = s => s==="__fold__"? FOLD_COLOR[darkMode()?1:0] : catColor(s);
  if(!weeks.length || !series.length){ host.append(el("div",{class:"empty"},t("noData"))); return; }
  const W = Math.max(560, Math.min(1020, host.clientWidth||1020)), H=260;
  const m={t:16,r:8,b:34,l:46}, iw=W-m.l-m.r, ih=H-m.t-m.b;
  const weekVal = (w,s)=> s==="__fold__"
    ? [...w.cats.entries()].filter(([c])=>!top.includes(c)).reduce((a,[,v])=>a+v,0)
    : (w.cats.get(s)||0);
  const max = Math.max(...weeks.map(w=>w.total),1);
  const ticks = niceTicks(max), ymax=ticks[ticks.length-1];
  const y = v=> m.t+ih - v/ymax*ih;
  const band = iw/weeks.length, bw=Math.min(24,Math.max(6,band*0.62));
  const svg = svgEl("svg",{viewBox:`0 0 ${W} ${H}`,width:"100%",role:"img","aria-label":"Despesas semanais por categoria"});
  for(const tv of ticks){
    svg.append(svgEl("line",{x1:m.l,x2:W-m.r,y1:y(tv),y2:y(tv),stroke:"var(--grid)","stroke-width":1}));
    svg.append(svgEl("text",{x:m.l-8,y:y(tv)+4,"text-anchor":"end",class:"vlabel"},fmtEUR0.format(tv)));
  }
  svg.append(svgEl("line",{x1:m.l,x2:W-m.r,y1:y(0),y2:y(0),stroke:"var(--axis)","stroke-width":1}));
  const lblEvery = Math.ceil(weeks.length/(iw>700?10:6));
  weeks.forEach((w,i)=>{
    const cx=m.l+band*i+band/2, bx=cx-bw/2;
    if(i%lblEvery===0) svg.append(svgEl("text",{x:cx,y:H-12,"text-anchor":"middle"},fmtDshort(w.wk)));
    if(!w.hasData){
      svg.append(svgEl("line",{x1:cx-4,x2:cx+4,y1:y(0)-1,y2:y(0)-1,stroke:"var(--ink-3)","stroke-width":2,opacity:0.7}));
    } else {
      let acc=0;
      const segs = series.map(s=>({s,v:weekVal(w,s)})).filter(x=>x.v>0);
      segs.forEach((seg,si)=>{
        const y1=y(acc+seg.v), y0=y(acc);
        const hpx = Math.max(0.5, y0-y1 - (si<segs.length-1?2:0)); /* 2px de intervalo entre segmentos */
        const isTop = si===segs.length-1;
        if(isTop && hpx>3){
          const r=Math.min(4,hpx/2), by=y0-hpx;
          svg.append(svgEl("path",{d:`M${bx},${y0} L${bx},${by+r} Q${bx},${by} ${bx+r},${by} L${bx+bw-r},${by} Q${bx+bw},${by} ${bx+bw},${by+r} L${bx+bw},${y0} Z`,fill:colorOf(seg.s)}));
        } else {
          svg.append(svgEl("rect",{x:bx,y:y0-hpx,width:bw,height:hpx,fill:colorOf(seg.s)}));
        }
        acc+=seg.v;
      });
    }
    const hit = svgEl("rect",{x:m.l+band*i,y:m.t,width:band,height:ih,fill:"transparent",tabindex:"0"});
    const ttShow = evt=>{
      const rows = w.hasData
        ? series.map(s=>({s,v:weekVal(w,s)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v)
            .map(x=>({color:colorOf(x.s),value:eur(x.v),name:nameOf(x.s)}))
        : [{value:t("noDataShort"),name:t("missingStatement")}];
      if(w.hasData) rows.unshift({value:eur(w.total),name:t("total")});
      showTT(evt,t("weekOf",weekLabel(w.wk)),rows);
    };
    hit.addEventListener("pointermove",ttShow);
    hit.addEventListener("focus",e=>ttShow({clientX:innerWidth/2,clientY:160}));
    hit.addEventListener("pointerleave",hideTT); hit.addEventListener("blur",hideTT);
    svg.append(hit);
  });
  host.append(svg);
  for(const s of series){
    leg.append(el("span",{class:"it"},
      el("span",{class:"sw",style:`background:${colorOf(s)}`}), nameOf(s)));
  }
}

/* ============ barras por categoria ============ */
function renderCatBars(agg){
  const host=$("#catBars"); host.replaceChildren();
  const entries=[...agg.byCat.entries()].sort((a,b)=>b[1]-a[1]);
  $("#catBarsSub").textContent = t("catBarsSub",eur(agg.totalExp));
  if(!entries.length){ host.append(el("div",{class:"empty"},t("noData"))); return; }
  const maxv=entries[0][1];
  const counts=new Map();
  for(const t of agg.txs) if(inAnalysis(t)){ const c=catOf(t); counts.set(c,(counts.get(c)||0)+1); }
  for(const [c,v] of entries){
    const row=el("div",{style:"display:flex;align-items:center;gap:10px;margin:6px 0;cursor:pointer",
      onclick:()=>{ state.cat = state.cat===c? "all" : c; syncControls(); renderAll(); },
      onpointermove:evt=>showTT(evt,catLabel(c),[{color:catColor(c),value:eur(v),name:`${counts.get(c)||0} ${t("moves")}`}]),
      onpointerleave:hideTT});
    row.append(el("span",{style:"width:190px;flex:none;font-size:13px;color:var(--ink-1);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"},catLabel(c)));
    const track=el("div",{style:"flex:1;height:18px;position:relative"});
    track.append(el("div",{style:`position:absolute;left:0;top:1px;height:16px;width:${Math.max(1.5,v/maxv*100)}%;background:${catColor(c)};border-radius:0 4px 4px 0;opacity:${state.cat!=="all"&&state.cat!==c?0.35:1}`}));
    row.append(track);
    row.append(el("span",{style:"width:100px;flex:none;font-size:12.5px;color:var(--ink-2);font-variant-numeric:tabular-nums;text-align:right"},eur(v)));
    host.append(row);
  }
}

/* ============ tabela de transações ============ */
function txTableFor(list){
  const t=el("table",{class:"tx"});
  t.append(el("thead",null,el("tr",null,
    el("th",null,tr_("colDate")),el("th",null,tr_("colDesc")),el("th",null,tr_("colCat")),
    el("th",null,tr_("colOwner")),el("th",{style:"text-align:right"},tr_("colAmount")))));
  const tb=el("tbody");
  for(const x of list) tb.append(txRow(x));
  t.append(tb);
  const wrap=el("div",{style:"overflow-x:auto"});
  wrap.append(t);
  return wrap;
}
function txRow(t, selectable){
  const c=catOf(t);
  const tr=el("tr",{class:"txrow",tabindex:"0"});
  if(selectable){
    const cb=el("input",{type:"checkbox"});
    cb.checked=state.selection.has(t.id);
    cb.addEventListener("click",e=>e.stopPropagation());
    cb.addEventListener("change",()=>{
      if(cb.checked) state.selection.add(t.id); else state.selection.delete(t.id);
      updateBulkBar();
    });
    const td=el("td",{style:"width:28px"},cb);
    td.addEventListener("click",e=>e.stopPropagation());
    tr.append(td);
  }
  tr.append(el("td",{style:"white-space:nowrap"},fmtD(t.date)));
  tr.append(el("td",null,t.merchant||t.desc));
  tr.append(el("td",null,el("span",{class:"catdot",style:`background:${catColor(c)}`}),catLabel(c)));
  const o=ownerOf(t);
  tr.append(el("td",{style:"white-space:nowrap"},el("span",{class:"catdot",style:`background:${ownerColor(o)}`}),ownerLabel(o)));
  tr.append(el("td",{class:"num "+(t.amount>0?"pos":"neg")},(t.amount>0?"+":"")+eur(t.amount)));
  const open=()=>toggleDetail(tr,t);
  tr.addEventListener("click",open);
  tr.addEventListener("keydown",e=>{ if(e.key==="Enter") open(); });
  return tr;
}
function toggleDetail(tr,t){
  const next=tr.nextElementSibling;
  if(next && next.classList.contains("detrow")){ next.remove(); state.openDetail=null; return; }
  document.querySelectorAll("tr.detrow").forEach(x=>x.remove());
  state.openDetail=t.id;
  const td=el("td",{colspan:String(tr.children.length)});
  const d=el("div",{class:"detail"});
  const rows=[
    [tr_("origDesc"),t.desc],
    [tr_("dateValue"),`${fmtD(t.date)} · ${fmtD(t.valueDate)}`],
    [tr_("amount"),(t.amount>0?"+":"")+eur(t.amount)],
    [tr_("balanceAfter"),eur(t.balance)],
    [tr_("kind"),tr_("kindNames")[t.kind]],
  ];
  for(const [k,v] of rows) d.append(el("div",{class:"drow"},el("span",{class:"dk"},k),el("span",null,v)));
  const sel=el("select");
  for(const c of allCats()) sel.append(el("option",{value:c,...(catOf(t)===c?{selected:""}:{})},catLabel(c)));
  sel.append(el("option",{value:"__new__"},tr_("newCat")));
  const chk=el("input",{type:"checkbox",checked:""});
  const newBox=el("span",{class:"hidden",style:"display:inline-flex;gap:6px;align-items:center;margin-left:8px"});
  const newName=el("input",{type:"text",placeholder:tr_("catName"),style:"font:inherit;font-size:13px;padding:4px 6px;border-radius:7px;border:1px solid var(--border);background:var(--surface-1);color:var(--ink-1);width:150px"});
  const newColor=el("input",{type:"color",value:CUSTOM_POOL[Object.keys(settings.customCats).length % CUSTOM_POOL.length],style:"width:30px;height:26px;border:1px solid var(--border);border-radius:7px;padding:1px;background:var(--surface-1);cursor:pointer"});
  const newOk=el("button",{class:"ghost"},tr_("create"));
  newBox.append(newName,newColor,newOk);
  const applyCat=v=>{
    if(chk.checked){ setCatForMerchant(t.merchant,v); }
    else { overrides.byId[t.id]=v; }
    saveOverrides(); renderAll();
  };
  sel.addEventListener("change",()=>{
    if(sel.value==="__new__"){ newBox.classList.remove("hidden"); newName.focus(); return; }
    newBox.classList.add("hidden");
    applyCat(sel.value);
  });
  const doCreate=()=>{
    const name=createCategory(newName.value, newColor.value);
    if(name) applyCat(name);
  };
  newOk.addEventListener("click",doCreate);
  newName.addEventListener("keydown",e=>{ if(e.key==="Enter") doCreate(); });
  const same=DATA.filter(x=>x.merchant===t.merchant).length;
  d.append(el("div",{class:"drow"},el("span",{class:"dk"},tr_("colCat")),
    el("span",null,sel,el("label",{class:"inline"},chk,tr_("applyToMerchant",same)),newBox)));
  /* atribuição de pessoa */
  const osel=el("select");
  for(const o of OWNERS) osel.append(el("option",{value:o,...(ownerOf(t)===o?{selected:""}:{})},ownerLabel(o)));
  const ochk=el("input",{type:"checkbox",checked:""});
  osel.addEventListener("change",()=>{
    if(ochk.checked){ setOwnerForMerchant(t.merchant,osel.value); }
    else { overrides.ownerById[t.id]=osel.value; }
    saveOverrides(); renderAll();
  });
  d.append(el("div",{class:"drow"},el("span",{class:"dk"},tr_("colOwner")),
    el("span",null,osel,el("label",{class:"inline"},ochk,tr_("applyToMerchant",same)))));
  td.append(d);
  tr.after(el("tr",{class:"detrow"},td));
}
const PAGE=50;
let currentFiltered=[];
function updateBulkBar(){
  const n=state.selection.size;
  $("#bulkBar").classList.toggle("hidden",n===0);
  $("#bulkCount").textContent=t("selectedN",n);
  /* repõe as opções de categoria (inclui personalizadas) mantendo a escolha atual */
  const bc=$("#bulkCat"), cur=bc.value;
  bc.replaceChildren(el("option",{value:""},t("bulkNoChange")));
  for(const c of allCats()) bc.append(el("option",{value:c},catLabel(c)));
  bc.value=[...bc.options].some(o=>o.value===cur)? cur : "";
}
function renderTable(agg){
  const list=agg.txs.slice();
  const {key,dir}=state.sort;
  list.sort((a,b)=>{
    let va,vb;
    if(key==="amount"){va=a.amount;vb=b.amount;}
    else if(key==="cat"){va=catOf(a);vb=catOf(b);}
    else if(key==="owner"){va=ownerOf(a);vb=ownerOf(b);}
    else if(key==="desc"){va=a.merchant;vb=b.merchant;}
    else {va=a.date;vb=b.date;}
    return (va<vb?-1:va>vb?1:0)*dir;
  });
  const totalPages=Math.max(1,Math.ceil(list.length/PAGE));
  if(state.page>=totalPages) state.page=totalPages-1;
  const pageList=list.slice(state.page*PAGE,(state.page+1)*PAGE);
  const exp=list.filter(t=>t.amount<0).reduce((a,t)=>a-t.amount,0);
  $("#txCount").textContent=t("txCount",list.length,eur(exp));
  const tb=$("#txTable tbody"); tb.replaceChildren();
  const openRows=[];
  for(const t of pageList){
    const tr=txRow(t, true);
    tb.append(tr);
    if(state.openDetail===t.id) openRows.push([tr,t]);
  }
  /* reabre o detalhe que estava aberto, para não perder o sítio a cada alteração */
  for(const [tr,t] of openRows){ state.openDetail=null; toggleDetail(tr,t); }
  /* seleção em massa */
  currentFiltered=list;
  const sa=$("#selAll");
  const selInFilter=list.filter(t=>state.selection.has(t.id)).length;
  sa.checked=list.length>0 && selInFilter===list.length;
  sa.indeterminate=selInFilter>0 && selInFilter<list.length;
  sa.onchange=()=>{
    if(sa.checked) for(const t of currentFiltered) state.selection.add(t.id);
    else for(const t of currentFiltered) state.selection.delete(t.id);
    renderTable(agg);
  };
  updateBulkBar();
  const pg=$("#pager"); pg.replaceChildren();
  if(totalPages>1){
    pg.append(el("button",{class:"ghost",onclick:()=>{state.page=Math.max(0,state.page-1);renderTable(agg);}},t("prev")));
    pg.append(el("span",null,t("pageOf",state.page+1,totalPages)));
    pg.append(el("button",{class:"ghost",onclick:()=>{state.page=Math.min(totalPages-1,state.page+1);renderTable(agg);}},t("next")));
  }
}

/* ============ sugestões para o que ficou por categorizar ============ */
function renderSuggestions(){
  const host=$("#suggestList"), sub=$("#suggestSub"), msg=$("#suggestMsg");
  host.replaceChildren(); msg.textContent="";
  /* agrupa por comerciante os movimentos ainda sem categoria */
  const groups=new Map();
  for(const t of DATA){
    if(t.amount>=0) continue;
    if(!UNCAT.has(catOf(t))) continue;
    const g=groups.get(t.merchant)||{n:0,v:0,ids:[]};
    g.n++; g.v+=-t.amount; g.ids.push(t.id);
    groups.set(t.merchant,g);
  }
  const rows=[...groups.entries()].map(([m,g])=>({m,...g,s:suggestFor(m,"-")}))
    .sort((a,b)=>b.v-a.v);
  const strong=rows.filter(r=>r.s&&r.s.strong);
  const totalV=rows.reduce((a,r)=>a+r.v,0);
  sub.textContent = rows.length ? t("uncatSub",rows.length,eur(totalV)) : t("allCategorised");
  $("#applyStrong").classList.toggle("hidden", strong.length===0);
  $("#applyStrong").textContent = t("applyStrong",strong.length);
  if(!rows.length) return;
  for(const r of rows.slice(0,40)){
    const row=el("div",{class:"setrow"});
    row.append(el("span",{class:"nm"},
      el("span",null,r.m),
      el("span",{class:"muted",style:"font-size:11.5px"}, ` · ${r.n} ${t("moves")}`)));
    row.append(el("span",{class:"tot"},eur(r.v)));
    const sel=el("select",{style:"font:inherit;font-size:13px;padding:4px 6px;border-radius:7px;border:1px solid var(--border);background:var(--surface-1);color:var(--ink-1);max-width:200px"});
    sel.append(el("option",{value:""},r.s? t("suggestion",catLabel(r.s.cat)) : t("chooseCat")));
    for(const c of allCats()) sel.append(el("option",{value:c},catLabel(c)));
    const apply=el("button",{class:"ghost",style:"padding:3px 10px;font-size:12px"},t("apply"));
    apply.addEventListener("click",()=>{
      const v=sel.value || (r.s? r.s.cat : "");
      if(!v) return;
      setCatForMerchant(r.m,v); saveOverrides(); MODEL=null; renderAll();
    });
    if(r.s) row.append(el("span",{class:"muted",style:"font-size:12px;min-width:52px;text-align:right"},
      r.s.strong? t("strong") : `${Math.round(r.s.share*100)}%`));
    else row.append(el("span",{style:"min-width:52px"}));
    row.append(sel, apply);
    host.append(row);
  }
  if(rows.length>40) host.append(el("p",{class:"muted",style:"font-size:12.5px;margin:10px 0 0"},
    t("shownTop",40,rows.length)));
}

/* ============ definições ============ */
function renderSettings(){
  const host=$("#catSettings"); host.replaceChildren();
  const totals=new Map(), incTotals=new Map();
  for(const t of DATA){
    const c=catOf(t);
    if(t.amount<0) totals.set(c,(totals.get(c)||0)-t.amount);
    else incTotals.set(c,(incTotals.get(c)||0)+t.amount);
  }
  const cats=allCats().sort((a,b)=>(totals.get(b)||0)-(totals.get(a)||0));
  for(const c of cats){
    const color=el("input",{type:"color",value:toHex6(catColor(c)),"aria-label":`Cor de ${c}`});
    color.addEventListener("input",()=>{ settings.colors[c]=color.value; saveSettings(); renderAll(); });
    const chk=el("input",{type:"checkbox"});
    chk.checked=catIncluded(c);
    chk.addEventListener("change",()=>{ settings.include[c]=chk.checked; saveSettings(); renderAll(); });
    const ichk=el("input",{type:"checkbox"});
    ichk.checked=incIncluded(c);
    ichk.addEventListener("change",()=>{ settings.incInclude[c]=ichk.checked; saveSettings(); renderAll(); });
    const row=el("div",{class:"setrow"},
      color,
      el("span",{class:"nm"},catLabel(c), settings.customCats[c]? el("span",{class:"muted",style:"font-size:11.5px"},t("custom")):null),
      el("span",{class:"tot"},totals.get(c)?eur(totals.get(c)):"—"),
      el("label",{class:"inc"},chk,t("isExpense")),
      el("span",{class:"tot",style:"min-width:96px"},incTotals.get(c)?eur(incTotals.get(c)):"—"),
      el("label",{class:"inc"},ichk,t("isIncome")));
    if(settings.customCats[c]){
      const del=el("button",{class:"ghost",title:t("remove"),style:"padding:3px 9px;font-size:12px"},t("remove"));
      del.addEventListener("click",()=>{
        const n=[...Object.values(overrides.byMerchant),...Object.values(overrides.byId)].filter(x=>x===c).length;
        deleteCategory(c);
        renderAll();
      });
      row.append(del);
    }
    host.append(row);
  }
  /* criar nova categoria */
  const nName=el("input",{type:"text",placeholder:t("newCatName"),style:"font:inherit;font-size:13px;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface-1);color:var(--ink-1);width:210px"});
  const nColor=el("input",{type:"color",value:CUSTOM_POOL[Object.keys(settings.customCats).length % CUSTOM_POOL.length],style:"width:34px;height:30px;border:1px solid var(--border);border-radius:7px;padding:1px;background:var(--surface-1);cursor:pointer"});
  const nBtn=el("button",{class:"ghost"},t("addCat"));
  const nMsg=el("span",{class:"muted",style:"font-size:12.5px"});
  const doAdd=()=>{
    const before=Object.keys(settings.customCats).length;
    const name=createCategory(nName.value,nColor.value);
    if(!name){ nMsg.textContent=t("needName"); return; }
    if(Object.keys(settings.customCats).length===before && !settings.customCats[name]){ nMsg.textContent=t("already",name); return; }
    nName.value=""; nMsg.textContent="";
    renderAll();
  };
  nBtn.addEventListener("click",doAdd);
  nName.addEventListener("keydown",e=>{ if(e.key==="Enter") doAdd(); });
  host.append(el("div",{style:"display:flex;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap"},nName,nColor,nBtn,nMsg));
  /* pessoas */
  const oh=$("#ownerSettings"); oh.replaceChildren();
  const ototals=new Map();
  for(const t of DATA) if(t.amount<0){ const o=ownerOf(t); ototals.set(o,(ototals.get(o)||0)-t.amount); }
  for(const o of OWNERS){
    const color=el("input",{type:"color",value:toHex6(ownerColor(o)),"aria-label":`Cor de ${o}`});
    color.addEventListener("input",()=>{ settings.colors["pessoa:"+o]=color.value; saveSettings(); renderAll(); });
    oh.append(el("div",{class:"setrow"},
      color,
      el("span",{class:"nm"},ownerLabel(o) + (o===OWNER_DEFAULT? t("byDefault"):"")),
      el("span",{class:"tot"},ototals.get(o)?eur(ototals.get(o)):"—")));
  }
  $("#dataInfo").replaceChildren(
    el("p",null,t("dataCount",DATA.length,fmtD(MIN_DATE),fmtD(MAX_DATE))),
    el("p",null,t("dataNote")));
}
function toHex6(c){
  if(/^#[0-9a-f]{6}$/i.test(c)) return c;
  const d=document.createElement("div"); d.style.color=c; document.body.append(d);
  const m=getComputedStyle(d).color.match(/\d+/g); d.remove();
  return m? "#"+m.slice(0,3).map(x=>(+x).toString(16).padStart(2,"0")).join("") : "#888888";
}

/* ============ chips de filtros ativos ============ */
function renderChips(){
  const host=$("#chips"); host.replaceChildren();
  const mk=(txt,clear)=>el("span",{class:"chip"},txt,el("button",{onclick:()=>{clear();syncControls();renderAll();},title:t("remove")},"×"));
  if(state.cat!=="all") host.append(mk(`${t("fCat")}: ${catLabel(state.cat)}`,()=>state.cat="all"));
  if(state.owner!=="all") host.append(mk(`${t("fOwner")}: ${ownerLabel(state.owner)}`,()=>state.owner="all"));
  if(state.kind!=="all") host.append(mk(`${t("fKind")}: ${$("#fKind").selectedOptions[0].textContent}`,()=>state.kind="all"));
  if(state.search) host.append(mk(`“${state.search}”`,()=>state.search=""));
  if(state.week) host.append(mk(t("weekOf",weekLabel(state.week)),()=>state.week=null));
}

/* ============ idioma ============ */
function applyStaticI18n(){
  document.documentElement.lang = LANG==="en" ? "en" : "pt-PT";
  document.querySelectorAll("[data-i18n]").forEach(e=>{ e.textContent=t(e.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach(e=>{ e.placeholder=t(e.dataset.i18nPh); });
  document.querySelectorAll("[data-i18n-title]").forEach(e=>{ e.title=t(e.dataset.i18nTitle); });
  document.querySelectorAll("[data-owner]").forEach(e=>{ e.textContent=ownerLabel(e.dataset.owner); });
  document.title = t("appTitle");
}
function setLang(l){
  LANG=l;
  try{ localStorage.setItem("gastos.lang",l); }catch(e){}
  setLocale();
  applyStaticI18n();
  if(typeof renderExamples==="function") renderExamples();
  syncControls();
  renderAll();
}

/* ============ navegação e controlos ============ */
function syncControls(){
  $("#fRange").value=state.range;
  $("#fKind").value=state.kind;
  $("#fCat").value=state.cat;
  $("#fOwner").value=state.owner;
  $("#fSearch").value=state.search;
  $("#customRange").classList.toggle("hidden",state.range!=="custom");
}
function refreshCatFilter(){
  const fc=$("#fCat"), cur=state.cat;
  fc.replaceChildren(el("option",{value:"all"},t("fCatAll")));
  for(const c of allCats()) fc.append(el("option",{value:c},catLabel(c)));
  fc.value=[...fc.options].some(o=>o.value===cur)? cur : "all";
}
function renderAll(){
  if(window.setPeriod) window.setPeriod();
  const agg=aggregate();
  refreshCatFilter();
  renderChips();
  renderKPIs(agg);
  renderWeekly(agg);
  renderOwner(agg);
  renderDrill(agg);
  renderStack(agg);
  renderCatBars(agg);
  renderSuggestions();
  renderRules();
  renderTable(agg);
  renderSettings();
}

function boot(){
  LANG=detectLang(); setLocale(); applyStaticI18n();
  rebuildData(); tagKinds(); recomputeCoverage();
  const setPeriod=()=>{$("#periodLbl").textContent=`${fmtD(MIN_DATE)} — ${fmtD(MAX_DATE)}`;};
  setPeriod(); window.setPeriod=setPeriod;
  $("#dataNote").style.display="none";
  /* categorias no filtro */
  const fc=$("#fCat");
  for(const c of CATS) fc.append(el("option",{value:c},c));
  /* eventos */
  $("#fRange").addEventListener("change",e=>{
    state.range=e.target.value; state.week=null;
    $("#customRange").classList.toggle("hidden",state.range!=="custom");
    if(state.range!=="custom") renderAll();
  });
  $("#fFrom").addEventListener("change",e=>{ state.from=e.target.value; if(state.range==="custom") renderAll(); });
  $("#fTo").addEventListener("change",e=>{ state.to=e.target.value; if(state.range==="custom") renderAll(); });
  $("#fKind").addEventListener("change",e=>{ state.kind=e.target.value; state.page=0; renderAll(); });
  $("#fCat").addEventListener("change",e=>{ state.cat=e.target.value; state.page=0; renderAll(); });
  $("#fOwner").addEventListener("change",e=>{ state.owner=e.target.value; state.page=0; renderAll(); });
  let debounce;
  $("#fSearch").addEventListener("input",e=>{
    clearTimeout(debounce);
    debounce=setTimeout(()=>{ state.search=e.target.value.trim(); state.page=0; renderAll(); },220);
  });
  $("#tabs").addEventListener("click",e=>{
    const b=e.target.closest("button"); if(!b) return;
    state.tab=b.dataset.tab;
    document.querySelectorAll("#tabs button").forEach(x=>x.classList.toggle("on",x===b));
    for(const id of ["overview","cats","txs","assist","settings"])
      document.getElementById("tab-"+id).classList.toggle("hidden",id!==state.tab);
    const noFilters = state.tab==="settings"||state.tab==="assist";
    $("#filterRow").classList.toggle("hidden",noFilters);
    $("#chips").classList.toggle("hidden",noFilters);
  });
  $("#weeklyTblBtn").addEventListener("click",()=>{
    const t=$("#weeklyTbl"); const hid=t.classList.toggle("hidden");
    $("#weeklyTblBtn").textContent=hid?t("seeTable"):t("hideTable");
  });
  document.querySelectorAll("#txTable th").forEach(th=>{
    th.addEventListener("click",()=>{
      const k=th.dataset.s;
      if(!k) return;
      if(state.sort.key===k) state.sort.dir*=-1; else state.sort={key:k,dir:k==="date"||k==="amount"?-1:1};
      renderTable(aggregate());
    });
  });
  /* ações em massa */
  $("#bulkApply").addEventListener("click",()=>{
    const who=$("#bulkOwner").value, cat=$("#bulkCat").value;
    if(!who && !cat){ $("#bulkMsg").textContent=t("bulkNeed"); return; }
    for(const id of state.selection){
      if(who) overrides.ownerById[id]=who;
      if(cat) overrides.byId[id]=cat;
    }
    saveOverrides();
    const n=state.selection.size;
    state.selection.clear();
    $("#bulkOwner").value=""; $("#bulkCat").value=""; $("#bulkMsg").textContent="";
    renderAll();
    const partes=[who&&t("toPerson",ownerLabel(who)), cat&&t("toCat",catLabel(cat))].filter(Boolean).join(" + ");
    $("#txCount").textContent=t("bulkDone",n,partes) + $("#txCount").textContent;
  });
  $("#bulkClear").addEventListener("click",()=>{ state.selection.clear(); renderTable(aggregate()); });
  $("#applyStrong").addEventListener("click",()=>{
    const groups=new Set();
    for(const t of DATA) if(t.amount<0 && UNCAT.has(catOf(t))) groups.add(t.merchant);
    let n=0;
    for(const m of groups){
      const s=suggestFor(m,"-");
      if(s&&s.strong){ setCatForMerchant(m,s.cat); n++; }
    }
    saveOverrides(); MODEL=null; renderAll();
    $("#suggestMsg").textContent=t("appliedN",n);
  });
  /* exportar / importar personalizações */
  $("#exportBtn").addEventListener("click",()=>{
    const payload={app:"gastos-semanais",versao:2,settings,overrides,imported};
    const blob=new Blob([JSON.stringify(payload,null,1)],{type:"application/json"});
    const a=el("a",{href:URL.createObjectURL(blob),download:"gastos-personalizacoes.json"});
    document.body.append(a); a.click(); a.remove();
    $("#portMsg").textContent=t("exported");
  });
  $("#importBtn").addEventListener("click",()=>$("#importFile").click());
  $("#importFile").addEventListener("change",e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const p=JSON.parse(r.result);
        if(p.app!=="gastos-semanais"||!p.settings||!p.overrides) throw new Error("formato");
        settings={colors:{},include:{},incInclude:{},customCats:{},rules:[],...p.settings};
        if(Array.isArray(p.imported)){ imported=p.imported; saveImported(); rebuildData(); tagKinds(); recomputeCoverage(); }
        overrides={byMerchant:{},byId:{},ownerByMerchant:{},ownerById:{},...p.overrides};
        saveSettings(); saveOverrides(); renderAll();
        $("#portMsg").textContent=t("importedOk");
      }catch(err){
        $("#portMsg").textContent=t("importBad");
      }
      e.target.value="";
    };
    r.readAsText(f);
  });
  /* tema */
  const savedTheme=store.get("gastos.theme");
  if(savedTheme) document.documentElement.setAttribute("data-theme",savedTheme);
  $("#langBtn").addEventListener("click",()=>setLang(LANG==="pt"?"en":"pt"));
  $("#themeBtn").addEventListener("click",()=>{
    const cur=darkMode()?"dark":"light";
    const next=cur==="dark"?"light":"dark";
    document.documentElement.setAttribute("data-theme",next);
    store.set("gastos.theme",next);
    renderAll();
  });
  $("#resetColors").addEventListener("click",()=>{
    /* repõe cores e inclusões; mantém as categorias personalizadas e as suas cores */
    const keptColors={};
    for(const c of Object.keys(settings.customCats)) if(settings.colors[c]) keptColors[c]=settings.colors[c];
    settings={colors:keptColors,include:{},incInclude:{},customCats:settings.customCats,rules:settings.rules}; saveSettings(); renderAll();
  });
  ["tab-overview"].forEach(()=>{});
  bootAssist();
  syncControls();
  renderAll();
}
boot();
