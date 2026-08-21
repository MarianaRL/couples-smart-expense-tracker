/* ==========================================================================
   Regras em linguagem natural (português) + assistente offline.
   Interpreta pedidos, propõe a regra, mostra quantos movimentos apanha e só
   aplica depois de confirmares.
   ========================================================================== */

const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");

const CAT_SYN = {
  "restauracao":"Restauração e cafés","restaurante":"Restauração e cafés","restaurantes":"Restauração e cafés",
  "comida":"Restauração e cafés","cafe":"Restauração e cafés","cafes":"Restauração e cafés",
  "supermercado":"Supermercado","mercearia":"Supermercado","compras de casa":"Supermercado",
  "transporte":"Transportes","transportes":"Transportes","uber":"Transportes","combustivel":"Transportes",
  "gasolina":"Transportes","portagens":"Transportes","estacionamento":"Transportes",
  "viagem":"Viagens","viagens":"Viagens","ferias":"Viagens",
  "lazer":"Lazer e noite","noite":"Lazer e noite","bares":"Lazer e noite","cinema":"Lazer e noite",
  "concertos":"Lazer e noite","cultura":"Lazer e noite",
  "roupa":"Roupa e lojas","lojas":"Roupa e lojas","vestuario":"Roupa e lojas",
  "online":"Compras online","internet":"Compras online",
  "subscricoes":"Subscrições e digital","subscricao":"Subscrições e digital","digital":"Subscrições e digital",
  "ginasio":"Desporto e ginásio","desporto":"Desporto e ginásio",
  "saude":"Saúde e farmácia","farmacia":"Saúde e farmácia","medico":"Saúde e farmácia",
  "animais":"Animais","cao":"Animais","gato":"Animais","veterinario":"Animais",
  "casa":"Contas da casa","contas":"Contas da casa","luz":"Contas da casa","agua":"Contas da casa",
  "impostos":"Impostos e Estado","estado":"Impostos e Estado","financas":"Impostos e Estado",
  "seguro":"Seguros","seguros":"Seguros",
  "renda":"Renda","levantamentos":"Levantamentos","levantamento":"Levantamentos",
  "comissoes":"Comissões e taxas","taxas":"Comissões e taxas",
  "investimentos":"Investimentos","rendimentos":"Rendimentos","salario":"Rendimentos",
};
const OWNER_SYN = {
  "minha":"Minha","minhas":"Minha","meu":"Minha","meus":"Minha","eu":"Minha","mim":"Minha",
  "namorado":"Namorado","dele":"Namorado","ele":"Namorado","do namorado":"Namorado",
  "partilhada":"Partilhada","partilhadas":"Partilhada","partilhado":"Partilhada","partilhados":"Partilhada",
  "dividida":"Partilhada","dividido":"Partilhada","metade":"Partilhada","nossa":"Partilhada",
  "nosso":"Partilhada","nossas":"Partilhada","nossos":"Partilhada","ambos":"Partilhada","dois":"Partilhada",
};
const MONTHS_PT = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const MONTHS_EN = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const MONTHS_ALL = () => LANG==="en" ? MONTHS_EN : MONTHS_PT;
/* sinónimos ingleses -> identificador interno (português) */
const CAT_SYN_EN = {
  "restaurant":"Restauração e cafés","restaurants":"Restauração e cafés","eating out":"Restauração e cafés",
  "food":"Restauração e cafés","coffee":"Restauração e cafés","cafe":"Restauração e cafés","cafes":"Restauração e cafés",
  "groceries":"Supermercado","grocery":"Supermercado","supermarket":"Supermercado",
  "transport":"Transportes","transports":"Transportes","travel card":"Transportes","fuel":"Transportes",
  "petrol":"Transportes","gas":"Transportes","parking":"Transportes","tolls":"Transportes","uber":"Transportes",
  "travel":"Viagens","trips":"Viagens","holidays":"Viagens","flights":"Viagens","hotels":"Viagens",
  "leisure":"Lazer e noite","nightlife":"Lazer e noite","bars":"Lazer e noite","cinema":"Lazer e noite",
  "concerts":"Lazer e noite","culture":"Lazer e noite","going out":"Lazer e noite",
  "clothes":"Roupa e lojas","clothing":"Roupa e lojas","shops":"Roupa e lojas","shopping":"Roupa e lojas",
  "online":"Compras online","online shopping":"Compras online",
  "subscriptions":"Subscrições e digital","subscription":"Subscrições e digital","digital":"Subscrições e digital",
  "gym":"Desporto e ginásio","sport":"Desporto e ginásio","sports":"Desporto e ginásio","fitness":"Desporto e ginásio",
  "health":"Saúde e farmácia","pharmacy":"Saúde e farmácia","doctor":"Saúde e farmácia","medical":"Saúde e farmácia",
  "pets":"Animais","pet":"Animais","vet":"Animais",
  "bills":"Contas da casa","household":"Contas da casa","utilities":"Contas da casa","electricity":"Contas da casa","water":"Contas da casa",
  "tax":"Impostos e Estado","taxes":"Impostos e Estado","government":"Impostos e Estado",
  "insurance":"Seguros","rent":"Renda","withdrawals":"Levantamentos","cash":"Levantamentos",
  "fees":"Comissões e taxas","bank fees":"Comissões e taxas",
  "investments":"Investimentos","income":"Rendimentos","salary":"Rendimentos",
};
const OWNER_SYN_EN = {
  "mine":"Minha","my":"Minha","me":"Minha","i":"Minha","myself":"Minha","hers":"Minha",
  "partner":"Namorado","boyfriend":"Namorado","his":"Namorado","him":"Namorado","he":"Namorado",
  "shared":"Partilhada","split":"Partilhada","both":"Partilhada","ours":"Partilhada","us":"Partilhada",
  "our":"Partilhada","joint":"Partilhada","together":"Partilhada","half":"Partilhada",
};

function matchCategory(txt){
  const n=norm(txt).trim();
  if(!n) return null;
  const SYN={...CAT_SYN, ...CAT_SYN_EN};
  /* nome exacto, no idioma actual ou no identificador interno */
  for(const c of allCats()) if(norm(c)===n || norm(catLabel(c))===n) return c;
  if(SYN[n]) return SYN[n];
  for(const c of allCats()) if(norm(c).startsWith(n) || norm(catLabel(c)).startsWith(n)) return c;
  for(const [k,v] of Object.entries(SYN)) if(new RegExp(`\\b${k}\\b`).test(n)) return v;
  for(const c of allCats()) if((norm(c).includes(n)||norm(catLabel(c)).includes(n)) && n.length>=4) return c;
  return null;
}
/* Vocabulário restrito para perguntas: numa pergunta como "how much did I spend",
   o "I" não é um filtro de pessoa, é só gramática. */
const OWNER_STRICT = {
  "mine":"Minha","hers":"Minha","minha":"Minha","minhas":"Minha","meus gastos":"Minha",
  "partner":"Namorado","boyfriend":"Namorado","his":"Namorado","namorado":"Namorado","dele":"Namorado",
  "shared":"Partilhada","joint":"Partilhada","partilhada":"Partilhada","partilhadas":"Partilhada",
};
function matchOwner(txt, strict){
  const n=norm(txt).trim();
  /* em inglês só o vocabulário inglês: "meu" e "mim" colidiriam com palavras comuns */
  const SYN = strict ? OWNER_STRICT
            : (LANG==="en" ? OWNER_SYN_EN : {...OWNER_SYN, ...OWNER_SYN_EN});
  if(SYN[n]) return SYN[n];
  for(const [k,v] of Object.entries(SYN)) if(new RegExp(`\\b${k}\\b`).test(n)) return v;
  return null;
}
function parseMonthRange(n){
  let m=/\bem (\d{4})\b|\bde (\d{4})\b/.exec(n);
  if(m){ const y=m[1]||m[2]; return {from:`${y}-01-01`, to:`${y}-12-31`, label:y}; }
  /* percorre todas as ocorrências de "em X" / "de X": o mês pode não ser a primeira */
  for(const mm2 of n.matchAll(/\b(?:em|de|no mes de|durante|in|during|for)\s+([a-z]+)(?:\s+(?:de|of)\s+(\d{4}))?/g)){
    let idx=MONTHS_PT.indexOf(mm2[1]);
    if(idx<0) idx=MONTHS_EN.indexOf(mm2[1]);
    if(idx<0) idx=MONTHS_EN.findIndex(m=>m.slice(0,3)===mm2[1]);
    if(idx<0) continue;
    const years=[...new Set(DATA.map(t=>t.date.slice(0,4)))].sort();
    const y=mm2[2]||years[years.length-1];
    const mm=String(idx+1).padStart(2,"0");
    const last=new Date(+y, idx+1, 0).getDate();
    return {from:`${y}-${mm}-01`, to:`${y}-${mm}-${last}`, label:`${MONTH_NAMES[LANG][idx]} ${y}`};
  }
  if(/ultimo mes|ultimo mês|last month/.test(n)){
    const max=DATA.reduce((a,t)=>t.date>a?t.date:a,"");
    return {from:max.slice(0,8)+"01", to:max, label:LANG==="en"?"last month":"último mês"};
  }
  return null;
}
function parseAmounts(n){
  const num=s=>parseFloat(s.replace(/\./g,"").replace(",","."));
  let m=/\b(?:entre|between)\s*([\d.,]+)\s*(?:e|a|and)\s*([\d.,]+)/.exec(n);
  if(m) return {min:num(m[1]), max:num(m[2])};
  m=/\b(?:acima de|mais de|superior(?:es)? a|maior(?:es)? que|above|over|more than|greater than|>)\s*([\d.,]+)/.exec(n);
  if(m) return {min:num(m[1])};
  m=/\b(?:abaixo de|menos de|inferior(?:es)? a|menor(?:es)? que|ate|below|under|less than|up to|<)\s*([\d.,]+)/.exec(n);
  if(m) return {max:num(m[1])};
  return {};
}
/* texto entre aspas ou depois de "tenha/contenha/com/no/na/em" */
function parseText(raw){
  let m=/[«"“']([^»"”']+)[»"”']/.exec(raw);
  if(m) return m[1].trim();
  const n=norm(raw);
  m=/\b(?:tenha|tenham|contenha|contenham|tiver|tiverem|diga|digam|com a palavra|palavra|anything with|everything with|with|containing|contains|says|labelled|labeled)\s+([a-z0-9áàâãéêíóôõúç .&*-]{2,40}?)(?=\s+(?:e|sao|são|é|e da|fica|ficam|passa|passam|mete|poe|põe|marca|is|are|goes to|should be|count as|counts as|,|$))/.exec(raw.toLowerCase());
  if(m) return m[1].trim();
  m=/\b(?:no|na|em|do|da|de|at|from|on)\s+([a-z0-9áàâãéêíóôõúç.&*-]{3,30})\b/.exec(raw.toLowerCase());
  if(m && !MONTHS_PT.includes(norm(m[1])) && !MONTHS_EN.includes(norm(m[1])) && !matchCategory(m[1])) return m[1].trim();
  return null;
}

/* ---------- aplicar regras ---------- */
function ruleMatches(r,t){
  const w=r.when;
  if(w.text && !norm(t.desc+" "+t.merchant).includes(norm(w.text))) return false;
  if(w.cat && (t._baseCat||t.cat)!==w.cat) return false;
  if(w.min!=null && Math.abs(t.amount)<w.min) return false;
  if(w.max!=null && Math.abs(t.amount)>w.max) return false;
  if(w.from && t.date<w.from) return false;
  if(w.to && t.date>w.to) return false;
  if(w.sign==="-" && t.amount>=0) return false;
  if(w.sign==="+" && t.amount<=0) return false;
  return true;
}
function rulesFor(t){
  const out={cat:null, owner:null};
  for(const r of (settings.rules||[])){
    if(r.on===false) continue;
    if(!ruleMatches(r,t)) continue;
    if(r.then.cat) out.cat=r.then.cat;
    if(r.then.owner) out.owner=r.then.owner;
  }
  return out;
}
function countMatches(rule){ return DATA.filter(t=>ruleMatches(rule,t)).length; }

/* ---------- interpretar um pedido ---------- */
function interpret(raw){
  const n=norm(raw);
  /* --- perguntas --- */
  if(/^(quanto|quantos|qual|quais|onde|quem|mostra|lista|how much|how many|what|which|where|who|show|list)/.test(n) || /\?$/.test(raw.trim())){
    return answerQuestion(raw,n);
  }
  /* --- regra --- */
  const cat=(()=>{
    let m=/(?:e|sao|são|é|fica|ficam|passa a ser|passam a ser|mete|met[ea]r|poe|põe|por|marca|conta como|classifica como|categoria|is|are|goes to|go to|should be|count as|counts as|category)\s+(?:como\s+|em\s+|na\s+|no\s+|as\s+|a\s+|the\s+)?([a-zç0-9 &çãéíóúâêô]+)$/i.exec(raw.trim());
    if(m) return matchCategory(m[1]);
    return null;
  })();
  const owner=matchOwner(raw);
  const text=parseText(raw);
  const amounts=parseAmounts(n);
  const period=parseMonthRange(n);
  const inCat=(()=>{
    const m=/\b(?:de|em|da categoria|categoria|category|in|on)\s+([a-zç0-9 &çãéíóúâêô]{3,30})/i.exec(raw);
    if(m){ const c=matchCategory(m[1]); if(c) return c; }
    /* categoria logo no início: "groceries over 40 are shared", "supermercado acima de 40" */
    const lead=/^([a-zç &çãéíóúâêô]{3,26}?)\s+(?:acima|abaixo|entre|mais|menos|above|below|over|under|between|more|less|is|are|sao|são|é)\b/i.exec(raw.trim());
    return lead? matchCategory(lead[1]) : null;
  })();

  if(!cat && !owner)
    return {kind:"erro", msg:t("errNoTarget")};
  if(!text && amounts.min==null && amounts.max==null && !period && !inCat)
    return {kind:"erro", msg:t("errNoCond")};

  const when={};
  if(text) when.text=text;
  if(inCat && !cat) when.cat=inCat;
  else if(inCat && cat && inCat!==cat) when.cat=inCat;
  if(amounts.min!=null) when.min=amounts.min;
  if(amounts.max!=null) when.max=amounts.max;
  if(period){ when.from=period.from; when.to=period.to; }
  when.sign="-";
  const then={};
  if(cat) then.cat=cat;
  if(owner) then.owner=owner;
  const rule={id:"r"+Date.now()+Math.floor(performance.now()%1000), when, then, on:true, raw:raw.trim()};
  return {kind:"regra", rule, n:countMatches(rule)};
}

function describeRule(r){
  const p=[];
  if(r.when.text) p.push(t("rDescHas",r.when.text));
  if(r.when.cat) p.push(t("rCat",catLabel(r.when.cat)));
  if(r.when.min!=null && r.when.max!=null) p.push(t("rBetween",eur(r.when.min),eur(r.when.max)));
  else if(r.when.min!=null) p.push(t("rAbove",eur(r.when.min)));
  else if(r.when.max!=null) p.push(t("rBelow",eur(r.when.max)));
  if(r.when.from) p.push(t("rDates",fmtD(r.when.from),fmtD(r.when.to)));
  const dest=[];
  if(r.then.cat) dest.push(catLabel(r.then.cat));
  if(r.then.owner) dest.push(ownerLabel(r.then.owner));
  return `${p.join(" + ")} → ${dest.join(" + ")}`;
}

/* ---------- perguntas sobre os números ---------- */
function answerQuestion(raw,n){
  const askMyShare=/minha parte|a minha parte|quanto me toca|my share|my part|what do i owe/.test(n);
  const period=parseMonthRange(n);
  const cat=(()=>{
    for(const m of raw.matchAll(/\b(?:em|com|de|no|na|on|in|for|at)\s+([a-zç0-9 &çãéíóúâêô]{3,30})/gi)){
      const c=matchCategory(m[1]); if(c) return c;
    }
    return null;
  })();
  const owner=askMyShare? null : matchOwner(raw,true);
  /* se já temos categoria ou pessoa, não procurar também o texto */
  const text=(cat||owner)? null : parseText(raw);
  /* só despesas que contam na análise, para não misturar transferências */
  let sel=DATA.filter(t=>t.amount<0 && catIncluded(catOf(t)));
  const bits=[];
  if(period){ sel=sel.filter(t=>t.date>=period.from&&t.date<=period.to); bits.push(period.label); }
  if(cat){ sel=sel.filter(t=>catOf(t)===cat); bits.push(catLabel(cat)); }
  else if(text){ sel=sel.filter(t=>norm(t.desc+" "+t.merchant).includes(norm(text))); bits.push(`«${text}»`); }
  if(owner){ sel=sel.filter(t=>ownerOf(t)===owner); bits.push(ownerLabel(owner)); }

  if(/quem gastou|quem gasta|who spent|who spends/.test(n)){
    const by={};
    for(const t of sel){ const o=ownerOf(t); by[o]=(by[o]||0)-t.amount; }
    const rows=Object.entries(by).sort((a,b)=>b[1]-a[1]);
    if(!rows.length) return {kind:"resposta", msg:t("noMoves")};
    return {kind:"resposta", msg:rows.map(([o,v])=>`${ownerLabel(o)}: ${eur(v)}`).join(" · ")};
  }
  if(askMyShare){
    let mine=0;
    for(const t of sel){ const o=ownerOf(t); if(o==="Minha") mine+=-t.amount; else if(o==="Partilhada") mine+=-t.amount/2; }
    return {kind:"resposta", msg:t("answerShare",eur(mine),bits.join(", "))};
  }
  if(/^quantos|^how many/.test(n))
    return {kind:"resposta", msg:t("answerCount",sel.length,bits.join(", "))};
  if(/maiores|top|maior gasto|biggest|largest|most expensive/.test(n)){
    const top=sel.slice().sort((a,b)=>a.amount-b.amount).slice(0,5);
    if(!top.length) return {kind:"resposta", msg:t("noMoves")};
    return {kind:"resposta", msg:top.map(t=>`${fmtD(t.date)} · ${t.merchant} · ${eur(-t.amount)}`).join("\n")};
  }
  if(/onde gast|em que gast|por categoria|where did i spend|by category|breakdown/.test(n)){
    const by={};
    for(const t of sel){ const c=catOf(t); by[c]=(by[c]||0)-t.amount; }
    const rows=Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,6);
    if(!rows.length) return {kind:"resposta", msg:t("noMoves")};
    return {kind:"resposta", msg:rows.map(([c,v])=>`${catLabel(c)}: ${eur(v)}`).join("\n")};
  }
  const total=sel.reduce((a,t)=>a-t.amount,0);
  if(!sel.length) return {kind:"resposta", msg:t("noMoves")};
  return {kind:"resposta", msg:t("answerSpend",eur(total),sel.length,bits.join(", "))};
}
