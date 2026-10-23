// Verificação visual (Playwright/Chromium) do sps-v238: renderiza a
// renderDashboard() REAL (extraída do index.html, mesmo padrão de
// test_ring_logo_v237_visual.js) dentro de uma página real que usa o
// MESMO <style> global da app (variáveis de cor, .card/.cb/.ch/.btn/.bdg),
// com dados realistas (6 atletas, jogos realizados, lesões, carga) —
// para confirmar visualmente o KPI em destaque, os 2 cartões separados
// (Risco de Lesão / Distribuição de Carga com paleta própria) e o novo
// cartão "Estatísticas da Época — Top 5", antes de publicar.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  // 1) CSS global real da app (variáveis + classes .card/.btn/.bdg/etc.)
  const styleMatch = html.match(/<style>\n:root\{[\s\S]*?\n<\/style>/);
  if (!styleMatch) throw new Error('global <style> block not found');
  const globalCss = styleMatch[0];

  // 2) Script real, até initPWA — mesmo corte do harness lógico
  const m = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/);
  const fullScript = m[1];
  const initIdx = fullScript.indexOf('(function initPWA()');
  const script = fullScript.slice(0, initIdx);

  const page_html = `<!doctype html><html><head><meta charset="utf-8">
  ${globalCss}
  <style>body{padding:20px}#pg-dashboard{max-width:1400px}</style>
  </head><body>
  <div id="pg-dashboard" class="pg" style="display:block"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
  <script>
    ${script}
    // --- dados realistas, mesmo espírito do seedApp() do harness lógico ---
    function athlete(id,name,num,extra){return Object.assign({id,name,alcunha:name.split(' ')[0],num,teamId:'T1',pos:'MC',dob:'2005-01-01'},extra||{});}
    const athletes=[
      athlete('a1','Diana Silva',9),
      athlete('a2','Ana Ribeiro',7),
      athlete('a3','Sofia Leite',10),
      athlete('a4','Bruna Costa',4),
      athlete('a5','Carla Nunes',14),
      athlete('a6','Mariana Moreira',11),
    ];
    const td=new Date().toISOString().slice(0,10);
    function dOffset(n){const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);}
    function pst(aid,goals,assists,mins){return{aid,goals,assists,mins,yellow:0,red:0};}
    const games=[
      {id:'g1',teamId:'T1',date:dOffset(-14),tipo:'campeonato',status:'realizado',opp:'Destreza Aventura',
        playerStats:[pst('a1',2,0,90),pst('a2',1,2,90),pst('a3',0,1,75),pst('a4',0,0,90),pst('a5',0,0,60),pst('a6',1,0,90)]},
      {id:'g2',teamId:'T1',date:dOffset(-7),tipo:'campeonato',status:'realizado',opp:'U.D.S. Roriz',
        playerStats:[pst('a1',1,0,85),pst('a2',0,1,90),pst('a3',1,1,80),pst('a6',0,1,70)]},
      {id:'g3',teamId:'T1',date:dOffset(5),tipo:'campeonato',status:'agendado',opp:'FC Tadim'},
    ];
    const pse=[];
    const wellness=[];
    for(let i=0;i<28;i++){
      const d=dOffset(-i);
      athletes.forEach((at,idx)=>{
        if((i+idx)%2===0) pse.push({athleteId:at.id,date:d,ua:40+((i*7+idx*13)%60),rpe:5,dur:70,
          sessionType:(i%7===0?'Jogo':i%5===0?'Ginásio':i%11===0?'Recuperação':'Treino')});
        if(i<7) wellness.push({athleteId:at.id,date:d,sleep:3+(idx%3),pain:idx===3?7:2,fatigue:3,stress:3,cycle:''});
      });
    }
    const injuries=[{id:'inj1',athleteId:'a4',status:'ativo',region:'Joelho'}];
    APP={
      teams:[{id:'T1',name:'Seniores Fem.'}],
      athletes, games, pse, wellness, injuries,
      schedule:[], attendance:[], extraTrainings:[], convocatorias:[],
      config:{classificacoes:{},competitions:[]},
    };
    ROLE='treinador'; _pwTeam='T1'; AID=null; _curPg='dashboard';
    // stubs mínimos de coisas que renderDashboard pode tocar e que não interessam ao visual
    navTo=function(){};
    try{ renderDashboard(); document.title='rendered-ok'; }
    catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }
  </script>
  </body></html>`;
  fs.writeFileSync(path.join(__dirname, '_dash_visual_test.html'), page_html);

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  pg.on('console', (msg) => console.log('[page]', msg.text()));
  await pg.goto('file://' + path.join(__dirname, '_dash_visual_test.html'));
  await pg.waitForTimeout(500);

  const title = await pg.title();
  console.log('Render status:', title);
  if (title !== 'rendered-ok') {
    console.log('FAIL: renderDashboard() threw — see page body above');
    await pg.screenshot({ path: path.join(__dirname, '_dash_visual_error.png'), fullPage: true });
    await browser.close();
    process.exitCode = 1;
    return;
  }

  // Checks estruturais básicos no DOM real renderizado
  const heroCount = await pg.locator('.db-kpi.db-kpi-hero').count();
  const kpiCount = await pg.locator('.db-kpi').count();
  console.log('KPI tiles:', kpiCount, '(hero:', heroCount, ')');
  if (kpiCount !== 6 || heroCount !== 1) { console.log('FAIL: esperado 6 KPIs, 1 hero'); process.exitCode = 1; }

  const bodyText = await pg.locator('#pg-dashboard').innerText();
  const hasEstatisticas = bodyText.includes('Estatísticas da Época');
  const hasDistCarga = bodyText.includes('DISTRIBUIÇÃO DE CARGA');
  console.log('Tem cartão Estatísticas da Época:', hasEstatisticas);
  console.log('Tem cartão Distribuição de Carga:', hasDistCarga);
  if (!hasEstatisticas || !hasDistCarga) { console.log('FAIL: cartão esperado não encontrado no texto'); process.exitCode = 1; }

  await pg.screenshot({ path: path.join(__dirname, '_dash_visual_full.png'), fullPage: true });
  const heroBox = await pg.locator('.db-kpi.db-kpi-hero').screenshot({ path: path.join(__dirname, '_dash_visual_hero.png') });
  console.log('Screenshots guardados: _dash_visual_full.png, _dash_visual_hero.png');

  await browser.close();
})();
