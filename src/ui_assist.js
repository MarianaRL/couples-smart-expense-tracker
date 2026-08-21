/* ==========================================================================
   Interface do assistente: importação, conversa e regras.
   ========================================================================== */

/* ---------------- importação ---------------- */
let pendingCSV=null;

function logImport(node){ $("#importLog").append(node); }
function clearImportLog(){ $("#importLog").replaceChildren(); }

function mergeTxns(newTxns, source){
  const existing=new Set(DATA.map(t=>t.id));
  const add=[];
  for(const t of newTxns){
    const rec={date:t.date, valueDate:t.valueDate||t.date, desc:t.desc,
               amount:t.amount, balance:t.balance||0};
    rec.merchant=merchantOf(rec.desc);
    rec.cat=autoCategorize(rec.desc, rec.amount);
    rec._baseCat=rec.cat;
    rec.origem=source;
    /* já existe um movimento igual, com o mesmo saldo? então é reimportação */
    if(existing.has(keyBase(rec))) continue;
    const k=keyOf(rec,existing);
    existing.add(k);
    add.push(rec);
  }
  if(add.length){
    imported.push(...add);
    saveImported();
    rebuildData(); tagKinds(); recomputeCoverage();
    MODEL=null;
  }
  return {added:add.length, dup:newTxns.length-add.length};
}

async function handleFiles(files){
  clearImportLog();
  for(const file of files){
    const row=el("div",{style:"margin:5px 0"},
      el("b",null,file.name), t("reading"));
    logImport(row);
    try{
      if(/\.pdf$/i.test(file.name)){
        const r=await importPdf(file);
        if(!r.txns.length){
          row.replaceChildren(el("b",null,file.name),
            el("span",{style:"color:var(--bad)"},t("noMovesFound")));
          continue;
        }
        const {added,dup}=mergeTxns(r.txns,"pdf:"+file.name);
        const warn = r.breaks? t("balancesBad",r.breaks) : t("balancesOk");
        row.replaceChildren(el("b",null,file.name), t("importedN",added,dup,warn));
      } else {
        const text=await file.text();
        const {rows}=parseCSV(text);
        if(rows.length<2){
          row.replaceChildren(el("b",null,file.name), t("emptyFile"));
          continue;
        }
        const map=guessColumns(rows);
        pendingCSV={rows,map,name:file.name};
        renderCSVMap();
        row.replaceChildren(el("b",null,file.name), t("csvLines",rows.length-(map.hasHeader?1:0)));
      }
    }catch(err){
      row.replaceChildren(el("b",null,file.name),
        el("span",{style:"color:var(--bad)"},t("failed",err.message)));
    }
  }
  renderAll();
}

function renderCSVMap(){
  const host=$("#csvMap");
  if(!pendingCSV){ host.classList.add("hidden"); host.replaceChildren(); return; }
  host.classList.remove("hidden"); host.replaceChildren();
  const {rows,map}=pendingCSV;
  const cols=rows[0].map((h,i)=> (map.hasHeader? h : t("csvCol",i+1)) || t("csvCol",i+1));
  host.append(el("p",{class:"sub",style:"margin:0 0 8px"},
    t("csvWhich",pendingCSV.name)));
  const mk=(label,key)=>{
    const sel=el("select",{style:"font:inherit;font-size:13px;padding:5px 7px;border-radius:7px;border:1px solid var(--border);background:var(--surface-1);color:var(--ink-1)"});
    sel.append(el("option",{value:"-1"},t("csvNone")));
    cols.forEach((c,i)=>sel.append(el("option",{value:String(i),...(map[key]===i?{selected:""}:{})},c)));
    sel.addEventListener("change",()=>{ map[key]=+sel.value; });
    return el("span",{style:"display:inline-flex;gap:6px;align-items:center;margin:0 14px 8px 0"},
      el("span",{class:"muted",style:"font-size:12.5px"},label), sel);
  };
  host.append(el("div",null, mk(t("colDate"),"date"), mk(t("colDesc"),"desc"),
    mk(t("colAmount"),"amount"), mk(t("balanceAfter"),"balance")));
  const go=el("button",{class:"ghost"},t("csvImport"));
  go.addEventListener("click",()=>{
    const txns=csvToTxns(rows,map);
    if(!txns.length){
      $("#csvMap").append(el("p",{style:"color:var(--bad);font-size:13px"},
        t("csvNoRows")));
      return;
    }
    const {added,dup}=mergeTxns(txns,"csv:"+pendingCSV.name);
    pendingCSV=null; renderCSVMap();
    logImport(el("div",{style:"margin:5px 0"},
      t("csvDone",added,dup)));
    renderAll();
  });
  const cancel=el("button",{class:"ghost"},t("cancel"));
  cancel.addEventListener("click",()=>{ pendingCSV=null; renderCSVMap(); });
  host.append(el("div",{style:"display:flex;gap:8px;margin-top:6px"},go,cancel));
}

/* ---------------- conversa ---------------- */
function chatBubble(who, content){
  const mine=who==="user";
  const wrap=el("div",{style:`display:flex;margin:7px 0;${mine?"justify-content:flex-end":""}`});
  const b=el("div",{style:`max-width:82%;padding:9px 12px;border-radius:12px;font-size:13.5px;white-space:pre-wrap;`+
    (mine? "background:var(--accent);color:#fff" : "background:var(--chip);color:var(--ink-1);border:1px solid var(--border)")});
  if(typeof content==="string") b.textContent=content; else b.append(content);
  wrap.append(b);
  $("#chatLog").append(wrap);
  $("#chatLog").scrollTop=$("#chatLog").scrollHeight;
  return b;
}

function proposeRule(res){
  const box=el("div");
  box.append(el("div",null,t("understood")));
  box.append(el("div",{style:"margin:6px 0;font-weight:600"},describeRule(res.rule)));
  box.append(el("div",{class:"muted",style:"font-size:12.5px"},
    res.n? t("catches",res.n) : t("catchesNone")));
  const sample=DATA.filter(t=>ruleMatches(res.rule,t)).slice(0,3);
  if(sample.length) box.append(el("div",{class:"muted",style:"font-size:12px;margin-top:4px"},
    sample.map(t=>`${fmtDshort(t.date)} · ${t.merchant} · ${eur(-t.amount)}`).join("\n")));
  const ok=el("button",{class:"ghost",style:"margin:10px 8px 0 0"},t("createRule"));
  const no=el("button",{class:"ghost",style:"margin-top:10px"},t("nevermind"));
  ok.addEventListener("click",()=>{
    settings.rules.push(res.rule); saveSettings(); MODEL=null;
    ok.remove(); no.remove();
    box.append(el("div",{style:"margin-top:8px;color:var(--good);font-size:13px"},t("ruleCreated")));
    renderAll();
  });
  no.addEventListener("click",()=>{ ok.remove(); no.remove(); });
  box.append(el("div",null,ok,no));
  return box;
}

async function sendChat(){
  const inp=$("#chatInput");
  const raw=inp.value.trim();
  if(!raw) return;
  inp.value="";
  chatBubble("user",raw);
  const key=store.get("gastos.apikey");
  if(key){
    const b=chatBubble("bot","…");
    try{
      const answer=await askClaude(raw,key);
      b.textContent=answer;
      return;
    }catch(err){
      b.textContent=t("apiFail",err.message);
    }
  }
  const res=interpret(raw);
  if(res.kind==="regra") chatBubble("bot",proposeRule(res));
  else chatBubble("bot",res.msg);
}

/* ---------------- conversa livre com chave ---------------- */
function dataSummary(){
  const byCat={};
  for(const t of DATA) if(t.amount<0){ const c=catOf(t); byCat[c]=(byCat[c]||0)-t.amount; }
  const top=Object.entries(byCat).sort((a,b)=>b[1]-a[1])
    .map(([c,v])=>`${c}: ${v.toFixed(2)}`).join("; ");
  return `Período ${MIN_DATE} a ${MAX_DATE}. ${DATA.length} movimentos. Despesas por categoria: ${top}.`;
}
async function askClaude(question,key){
  const r=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"content-type":"application/json","x-api-key":key,
             "anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({
      model:"claude-sonnet-4-5",
      max_tokens:700,
      system:"És um assistente de finanças pessoais dentro de uma app. Responde em português europeu, "+
             "de forma curta e direta, sem listas com marcadores. Usa apenas os dados fornecidos. "+
             "Se te pedirem para criar uma regra de categorização, explica qual seria e diz ao "+
             "utilizador para a escrever no assistente para a poder confirmar.\n\nDados: "+dataSummary(),
      messages:[{role:"user",content:question}]
    })
  });
  if(!r.ok) throw new Error("HTTP "+r.status);
  const j=await r.json();
  return (j.content||[]).map(c=>c.text||"").join("").trim() || "(resposta vazia)";
}

function renderExamples(){
  const bar=$("#chatExamples");
  bar.replaceChildren();
  for(const e of t("examples")){
    const c=el("span",{class:"chip",style:"cursor:pointer"},e);
    c.addEventListener("click",()=>{ $("#chatInput").value=e; sendChat(); });
    bar.append(c);
  }
}

/* ---------------- regras ---------------- */
function renderRules(){
  const host=$("#rulesList"); host.replaceChildren();
  const rs=settings.rules||[];
  if(!rs.length){
    host.append(el("p",{class:"muted",style:"font-size:13px;margin:0"},
      t("noRules")));
    return;
  }
  for(const r of rs){
    const n=countMatches(r);
    const chk=el("input",{type:"checkbox"});
    chk.checked=r.on!==false;
    chk.addEventListener("change",()=>{ r.on=chk.checked; saveSettings(); renderAll(); });
    const del=el("button",{class:"ghost",style:"padding:3px 9px;font-size:12px"},t("remove"));
    del.addEventListener("click",()=>{
      settings.rules=settings.rules.filter(x=>x.id!==r.id);
      saveSettings(); renderAll();
    });
    host.append(el("div",{class:"setrow"},
      el("label",{class:"inc"},chk,""),
      el("span",{class:"nm"},
        el("span",null,describeRule(r)),
        r.raw? el("span",{class:"muted",style:"font-size:11.5px;display:block"},`«${r.raw}»`):null),
      el("span",{class:"tot"},`${n} ${t("moves")}`),
      del));
  }
}

/* ---------------- arranque desta aba ---------------- */
function bootAssist(){
  const dz=$("#dropzone"), fi=$("#importFiles");
  dz.addEventListener("click",()=>fi.click());
  fi.addEventListener("change",e=>{ handleFiles([...e.target.files]); e.target.value=""; });
  ["dragenter","dragover"].forEach(ev=>dz.addEventListener(ev,e=>{
    e.preventDefault(); dz.style.borderColor="var(--accent)"; dz.style.background="var(--hover)";
  }));
  ["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{
    e.preventDefault(); dz.style.borderColor="var(--axis)"; dz.style.background="";
  }));
  dz.addEventListener("drop",e=>{
    const files=[...(e.dataTransfer?.files||[])];
    if(files.length) handleFiles(files);
  });
  $("#chatSend").addEventListener("click",sendChat);
  $("#chatInput").addEventListener("keydown",e=>{ if(e.key==="Enter") sendChat(); });
  renderExamples();
  const key=store.get("gastos.apikey");
  $("#apiSub").textContent = key ? t("apiHasKey") : t("apiNoKey");
  $("#apiSave").addEventListener("click",()=>{
    const v=$("#apiKey").value.trim();
    if(v){ store.set("gastos.apikey",v); $("#apiKey").value=""; $("#apiSub").textContent=t("apiSaved"); }
  });
  $("#apiClear").addEventListener("click",()=>{
    store.del("gastos.apikey"); $("#apiKey").value="";
    $("#apiSub").textContent=t("apiCleared");
  });
  chatBubble("bot",t("greeting"));
}
