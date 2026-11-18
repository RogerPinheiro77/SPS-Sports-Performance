path = "index.html"
s = open(path, encoding="utf-8").read()

old1 = """function _npHidratacaoHtml(athleteId,printMode){
  const list=(APP.hydrationRecords||[]).filter(r=>r.athleteId===athleteId).sort((a,b)=>{
    const ga=(APP.games||[]).find(g=>g.id===a.gameId),gb=(APP.games||[]).find(g=>g.id===b.gameId);
    return(gb?.date||'').localeCompare(ga?.date||'');
  });
  if(!list.length)return{count:0,html:`<div style="font-size:11.5px;color:${printMode?'#888':'var(--t2)'}">Sem registos de hidratação.</div>`};
  const rows=list.map(r=>{
    const g=(APP.games||[]).find(x=>x.id===r.gameId);
    const lossPct=r.weightLossPct!=null?r.weightLossPct:_hydraWeightLossPct(r.preWeight,r.postWeight);
    return`<div style="padding:7px 0;border-bottom:1px dotted ${printMode?'#eee':'var(--brd)'}">
      <div style="font-weight:700;font-size:12px;${printMode?'color:#111':''}">${g?escHtml(g.opp||'?')+' — '+fmtDate(g.date):'Jogo não identificado'}</div>
      <div style="font-size:11px;${printMode?'color:#555':'color:var(--t2)'};margin-top:2px">Pré: ${r.preWeight!=null?r.preWeight+'kg':'—'} · Pós: ${r.postWeight!=null?r.postWeight+'kg':'—'} · Perda: ${lossPct!=null&&!isNaN(lossPct)?lossPct.toFixed(1)+'%':'—'}${r.sweatRate!=null?' · Sudorese: '+(+r.sweatRate).toFixed(2)+' L/h':''}</div>
      ${r.notes?`<div style="font-size:10.5px;${printMode?'color:#777':'color:var(--t2)'};margin-top:2px">${escHtml(r.notes)}</div>`:''}
    </div>`;
  }).join('');
  return{count:list.length,html:rows};
}"""

new1 = """function _npHidratacaoHtml(athleteId,printMode){
  const list=(APP.hydrationRecords||[]).filter(r=>r.athleteId===athleteId).sort((a,b)=>{
    const sa=_hydraSessionById(a.eventId),sb=_hydraSessionById(b.eventId);
    return(sb?.date||'').localeCompare(sa?.date||'');
  });
  if(!list.length)return{count:0,html:`<div style="font-size:11.5px;color:${printMode?'#888':'var(--t2)'}">Sem registos de hidratação.</div>`};
  const rows=list.map(r=>{
    const s=_hydraSessionById(r.eventId);
    const lossPct=r.weightLossPct!=null?r.weightLossPct:_hydraWeightLossPct(r.preWeight,r.postWeight);
    return`<div style="padding:7px 0;border-bottom:1px dotted ${printMode?'#eee':'var(--brd)'}">
      <div style="font-weight:700;font-size:12px;${printMode?'color:#111':''}">${s?escHtml(s.label)+' — '+fmtDate(s.date):'Sessão não identificada'}</div>
      <div style="font-size:11px;${printMode?'color:#555':'color:var(--t2)'};margin-top:2px">Pré: ${r.preWeight!=null?r.preWeight+'kg':'—'} · Pós: ${r.postWeight!=null?r.postWeight+'kg':'—'} · Perda: ${lossPct!=null&&!isNaN(lossPct)?lossPct.toFixed(1)+'%':'—'}${r.sweatRate!=null?' · Sudorese: '+(+r.sweatRate).toFixed(2)+' L/h':''}</div>
      ${r.notes?`<div style="font-size:10.5px;${printMode?'color:#777':'color:var(--t2)'};margin-top:2px">${escHtml(r.notes)}</div>`:''}
    </div>`;
  }).join('');
  return{count:list.length,html:rows};
}"""

c1 = s.count(old1)
assert c1 == 1, f"old1 count={c1}"
s = s.replace(old1, new1, 1)

old2 = """  ${_naEvolutionCardHtml(avals)}
  ${_atPesoCardHtml(selfAvals)}
  ${plan?`<div class="card" style="margin-bottom:14px"><div class="ch"><span class="ct">${plan.name}</span></div><div class="cb" style="padding:12px">"""
new2 = """  ${_naEvolutionCardHtml(avals)}
  ${_atPesoCardHtml(selfAvals)}
  ${_atHidraCardHtml()}
  ${plan?`<div class="card" style="margin-bottom:14px"><div class="ch"><span class="ct">${plan.name}</span></div><div class="cb" style="padding:12px">"""
c2 = s.count(old2)
assert c2 == 1, f"old2 count={c2}"
s = s.replace(old2, new2, 1)

old3 = """    </div>`:''}
  </div>`;
}
// Anamnese Alimentar — lado atleta (sps-v195, mesmo espírito do Histórico Clínico do
"""
new3 = """    </div>`:''}
  </div>`;
}
// ─── Hidratação — lado atleta (generalizado, pedido do Roger 18/11/2026) ──────────────
// Pesagem pré/pós em treino e jogo. Pré-treino não é um novo registo: é o valor que a
// própria atleta já registou hoje no Registo de Peso (nutrition_records, source:'atleta')
// — pedido explícito do Roger para não a pesar duas vezes no mesmo dia. Pré-jogo continua
// a ser um registo manual próprio (momento diferente da pesagem matinal). registeredBy/
// registeredById em hydration_records vêm da sessão (getSession()) de quem grava — quando
// é a própria atleta, ficam automaticamente com o seu nome/id (ver setSession no login da
// atleta), por isso o histórico sabe distinguir autorregisto de correção da equipa técnica
// sem precisar de nenhuma coluna nova.
function _atHidraTodaySessions(){
  const at=APP.athletes.find(a=>a.id===AID);
  const td=today();
  const treino=(APP.schedule||[]).find(e=>e.date===td&&e.type==='Treino'&&(!e.teamId||!at||e.teamId===at.teamId));
  const jogo=(APP.games||[]).find(g=>g.date===td&&(!g.teamId||!at||g.teamId===at.teamId));
  return {treino,jogo};
}
let _atHidraSelType=null;
function _atHidraCardHtml(){
  const {treino,jogo}=_atHidraTodaySessions();
  if(!treino&&!jogo)return '';
  if(!_atHidraSelType)_atHidraSelType=jogo?'jogo':'treino';
  if(_atHidraSelType==='jogo'&&!jogo)_atHidraSelType='treino';
  if(_atHidraSelType==='treino'&&!treino)_atHidraSelType='jogo';
  const eventId=_atHidraSelType==='jogo'?jogo.id:treino.id;
  const sessionType=_atHidraSelType==='jogo'?'Jogo':'Treino';
  const rec=_hydraRecordFor(AID,eventId);
  const td=today();
  const selfToday=APP.nutritionAssessments.find(a=>a.athleteId===AID&&a.source==='atleta'&&a.date===td);
  const preWeight=_atHidraSelType==='treino'?(selfToday?+selfToday.weight:null):(rec&&rec.preWeight!=null?+rec.preWeight:null);
  const bands=_hydraBands(AID);
  const toggleHtml=(treino&&jogo)?`<div style="display:flex;gap:8px;margin-bottom:12px">
    <button class="btn btn-sm ${_atHidraSelType==='treino'?'btn-g':'btn-gh'}" onclick="_atHidraSelType='treino';renderAtNutri()">Treino</button>
    <button class="btn btn-sm ${_atHidraSelType==='jogo'?'btn-g':'btn-gh'}" onclick="_atHidraSelType='jogo';renderAtNutri()">Jogo</button>
  </div>`:'';
  const sessionLabel=_atHidraSelType==='jogo'?('Jogo vs '+(jogo.opp||'?')+' · '+fmtDate(jogo.date)):('Treino · '+fmtDate(treino.date));
  let preHtml;
  if(_atHidraSelType==='treino'){
    preHtml=selfToday?`<div class="card" style="margin-bottom:10px;padding:14px;border:1px dashed rgba(74,222,128,.35)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-size:13px;font-weight:700"><i class="ti ti-circle-check" style="color:#4ade80;margin-right:4px;vertical-align:-2px" aria-hidden="true"></i>Pesagem Pré-Treino</div>
        <span style="font-size:9.5px;font-weight:700;color:#4ade80;background:#4ade8022;padding:2px 8px;border-radius:999px">Registo diário</span>
      </div>
      <div style="font-size:24px;font-weight:800">${selfToday.weight} <span style="font-size:13px;color:var(--t2);font-weight:600">kg</span></div>
      <div style="font-size:11px;color:var(--t2);margin-top:4px">A partir do teu registo de peso de hoje.</div>
    </div>`:`<div class="card" style="margin-bottom:10px;padding:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:6px">Pesagem Pré-Treino</div>
      <div style="font-size:12px;color:var(--t2)">Regista primeiro o teu peso de hoje no card "Registo de Peso" acima — esse valor passa automaticamente a ser a tua pesagem pré-treino.</div>
    </div>`;
  } else {
    preHtml=`<div class="card" style="margin-bottom:10px;padding:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">Pesagem Pré-Jogo</div>
      <div style="display:flex;gap:8px">
        <input class="ctrl" id="at-hidra-pre" type="number" step="0.1" placeholder="0.0" value="${rec&&rec.preWeight!=null?rec.preWeight:''}" style="flex:1">
        <button class="btn btn-g" onclick="atSaveHidraPre()">Guardar</button>
      </div>
    </div>`;
  }
  const canPost=preWeight!=null;
  const postHtml=`<div class="card" style="margin-bottom:10px;padding:14px${canPost?'':';opacity:.55'}">
    <div style="font-size:13px;font-weight:700;margin-bottom:8px">Pesagem Pós</div>
    ${!canPost?`<div style="font-size:11px;color:var(--t2);margin-bottom:8px">Disponível depois de teres a pesagem pré.</div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div><label style="font-size:10.5px;color:var(--t2)">Peso pós (kg)</label><input class="ctrl" id="at-hidra-post" type="number" step="0.1" value="${rec&&rec.postWeight!=null?rec.postWeight:''}" ${canPost?'':'disabled'}></div>
      <div><label style="font-size:10.5px;color:var(--t2)">Líquidos (L)</label><input class="ctrl" id="at-hidra-fluids" type="number" step="0.05" value="${rec&&rec.fluidsL!=null?rec.fluidsL:''}" ${canPost?'':'disabled'}></div>
    </div>
    <button class="btn btn-g" style="width:100%" onclick="atSaveHidraPost()" ${canPost?'':'disabled'}>Guardar registo</button>
  </div>`;
  let resultHtml='';
  if(rec&&rec.postWeight!=null){
    const lossPct=rec.weightLossPct!=null?rec.weightLossPct:_hydraWeightLossPct(preWeight,+rec.postWeight);
    const colorInfo=_hydraWeightColor(lossPct,bands);
    const target=_hydraReplacementTarget(preWeight,+rec.postWeight,bands);
    resultHtml=`<div class="card" style="padding:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">Resultado</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12.5px"><span style="color:var(--t2)">Perda de peso</span><strong>${lossPct!=null&&!isNaN(lossPct)?(lossPct>=0?'-':'+')+Math.abs(lossPct).toFixed(1)+'%':'—'}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12.5px"><span style="color:var(--t2)">Taxa de sudação</span><strong>${rec.sweatRate!=null?(+rec.sweatRate).toFixed(2)+' L/h':'—'}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:12.5px"><span style="color:var(--t2)">Reposição recomendada</span><strong>${target!=null?target.toFixed(2)+' L':'—'}</strong></div>
      <span class="bdg ${colorInfo.cls}" style="font-size:11px">${escHtml(colorInfo.label||'—')}</span>
      <div style="font-size:10px;color:var(--t2);font-style:italic;margin-top:10px">Baseado no NATA Position Statement (2017) — orientativo, não substitui avaliação clínica.</div>
    </div>`;
  }
  return `<div class="card" style="margin-bottom:14px;padding:14px">
    <div style="font-size:13px;font-weight:800;margin-bottom:4px"><i class="ti ti-droplet" style="margin-right:6px;vertical-align:-2px;color:#38bdf8" aria-hidden="true"></i>Hidratação</div>
    <div style="font-size:11px;color:var(--t2);margin-bottom:10px">${escHtml(sessionLabel)}</div>
    ${toggleHtml}
    ${preHtml}
    ${postHtml}
    ${resultHtml}
  </div>`;
}
function atSaveHidraPre(){
  const {jogo}=_atHidraTodaySessions();
  if(!jogo)return;
  const val=document.getElementById('at-hidra-pre')?.value;
  const w=parseFloat((val||'').replace(',','.'));
  if(!w||w<=0)return toast('Introduz um peso válido','err');
  saveHydraRecord(AID,jogo.id,'Jogo',{preWeight:w});
  renderAtNutri();
}
function atSaveHidraPost(){
  const {treino,jogo}=_atHidraTodaySessions();
  const session=_atHidraSelType==='jogo'?jogo:treino;
  if(!session)return;
  const eventId=session.id,sessionType=_atHidraSelType==='jogo'?'Jogo':'Treino';
  const postVal=document.getElementById('at-hidra-post')?.value;
  const post=parseFloat((postVal||'').replace(',','.'));
  if(!post||post<=0)return toast('Introduz o peso pós','err');
  const fluidsVal=document.getElementById('at-hidra-fluids')?.value;
  const fluids=parseFloat((fluidsVal||'0').replace(',','.'))||0;
  let preWeight=null;
  if(sessionType==='Treino'){
    const td=today();
    const selfToday=APP.nutritionAssessments.find(a=>a.athleteId===AID&&a.source==='atleta'&&a.date===td);
    if(!selfToday)return toast('Regista primeiro o teu peso de hoje no Registo de Peso','err');
    preWeight=+selfToday.weight;
  } else {
    const rec=_hydraRecordFor(AID,eventId);
    if(!rec||rec.preWeight==null)return toast('Regista primeiro o peso pré-jogo','err');
    preWeight=+rec.preWeight;
  }
  const durH=session.djDurJogo?+(session.djDurJogo/60).toFixed(2):(session.dur?+(session.dur/60).toFixed(2):1.5);
  saveHydraRecord(AID,eventId,sessionType,{
    preWeight,postWeight:post,fluidsL:fluids,urineL:0,durationH:durH,
    sweatRate:_hydraSweatRate(preWeight,post,fluids,0,durH),
    weightLossPct:_hydraWeightLossPct(preWeight,post)
  });
  renderAtNutri();
}
// Anamnese Alimentar — lado atleta (sps-v195, mesmo espírito do Histórico Clínico do
"""
c3 = s.count(old3)
assert c3 == 1, f"old3 count={c3}"
s = s.replace(old3, new3, 1)

open(path, "w", encoding="utf-8").write(s)
print("SCRIPT_C_OK")
