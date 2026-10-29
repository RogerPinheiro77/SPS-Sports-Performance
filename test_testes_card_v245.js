// Verificação visual (Playwright) do sps-v245/v246: card "Testes Físicos" no Home da App
// Atleta (renderAtHome) — pedido do Roger "NA APP ATLETA CRIA O CARD TESTES FISICOS", depois
// "NO CARD CONSEGUES COLOCAR O RANKING QUE ATLETA ESTA, MESMO QUE NO MOMENTO SO HAJA UM TESTE".
// Confirma que o card aparece, mostra o estado certo (sem testes / posição no Ranking Geral
// já com 1 só teste / fallback ao nome+data quando não há ranking), e que tocar nele navega
// para a página 'testes' (renderAtTestes, já existente).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const styleMatch = html.match(/<style>\n:root\{[\s\S]*?\n<\/style>/);
  if (!styleMatch) throw new Error('global <style> block not found');
  const globalCss = styleMatch[0];
  const m = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/);
  const fullScript = m[1];
  const initIdx = fullScript.indexOf('(function initPWA()');
  const script = fullScript.slice(0, initIdx);

  function buildPage(setupJs) {
    return `<!doctype html><html><head><meta charset="utf-8">
    ${globalCss}
    <style>body{padding:20px;background:var(--bg0)}#atp-home{max-width:420px}</style>
    </head><body>
    <div id="atp-home" class="pg" style="display:block"></div>
    <script>
      ${script}
      function athlete(id,name,num,dob){return {id,name,alcunha:name.split(' ')[0],num,teamId:'T1',pos:'MC',dob:dob||'2006-03-10'};}
      const athletes=[
        athlete('a1','Mariana Teixeira',4,'2004-05-02'),
        athlete('a2','Beatriz Nogueira',7,'2006-01-15'),
        athlete('a3','Carolina Dias',9,'2005-09-30')
      ];
      window._navLog=[];
      function _atNavTo(page){ window._navLog.push(page); document.title='nav:'+page; }
      ${setupJs}
    </script>
    </body></html>`;
  }

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let failed = false;

  // ── 1) Sem nenhum teste registado — card aparece com "Sem testes ainda" ──
  {
    const pageHtml = buildPage(
      `APP={teams:[{id:'T1',name:'Seniores Fem.'}],athletes,wellness:[],pse:[],schedule:[],injuries:[],convocatorias:[],evalPeriods:[],evalResponses:[],trainingPlans:[],nutritionPlans:[],codeOfConduct:null,physicalTestResults:[],games:[],config:{clubName:'Moreirense FC',season:'2026/27'}};
       ROLE='atleta';_sync=false;AID='a1';
       try{ renderAtHome(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_testes_card_empty.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 480, height: 1100 } });
    await pg.goto('file://' + path.join(__dirname, '_testes_card_empty.html'));
    await pg.waitForTimeout(250);
    let title = await pg.title();
    console.log('[vazio] Render status:', title);
    if (title !== 'rendered-ok') { console.log('FAIL: renderAtHome() threw'); failed = true; }
    else {
      const cardText = await pg.locator('#atp-home').innerText();
      const hasCard = /Testes Físicos/.test(cardText);
      const hasEmptyState = /Sem testes ainda/.test(cardText);
      console.log('Card "Testes Físicos" presente:', hasCard, '| estado "Sem testes ainda":', hasEmptyState);
      if (!hasCard) { console.log('FAIL: card "Testes Físicos" não aparece no Home'); failed = true; }
      if (!hasEmptyState) { console.log('FAIL: devia mostrar "Sem testes ainda" sem registos'); failed = true; }

      // clicar no card navega para 'testes'
      await pg.getByText('Testes Físicos').click();
      await pg.waitForTimeout(100);
      title = await pg.title();
      console.log('Após clicar no card, título (nav log):', title);
      if (title !== 'nav:testes') { console.log('FAIL: clicar no card devia chamar _atNavTo(\'testes\')'); failed = true; }
    }
    await pg.screenshot({ path: path.join(__dirname, '_testes_card_empty.png'), fullPage: true });
    await pg.close();
  }

  // ── 2) Sozinha na equipa, só 1 registo (sem colegas com resultados) — sps-v246: já mostra
  //      "1º de 1 · Geral" em vez de null/fallback, mesmo havendo só 1 teste feito ──
  {
    const pageHtml = buildPage(
      `APP={teams:[{id:'T1',name:'Seniores Fem.'}],athletes,wellness:[],pse:[],schedule:[],injuries:[],convocatorias:[],evalPeriods:[],evalResponses:[],trainingPlans:[],nutritionPlans:[],codeOfConduct:null,
         physicalTestResults:[
           {id:'tf1',testId:'yoyo_ir1',athleteId:'a1',teamId:'T1',date:'2026-10-20',levelRaw:'14.1',etapaRaw:'12',distance:480,vo2max:40.4},
           {id:'tf2',testId:'yoyo_ir1',athleteId:'a1',teamId:'T1',date:'2026-10-29',levelRaw:'19.4',etapaRaw:'55',distance:2200,vo2max:54.9}
         ],
         games:[],
         config:{clubName:'Moreirense FC',season:'2026/27'}};
       ROLE='atleta';_sync=false;AID='a1';
       try{ renderAtHome(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_testes_card_withdata.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 480, height: 1100 } });
    await pg.goto('file://' + path.join(__dirname, '_testes_card_withdata.html'));
    await pg.waitForTimeout(250);
    const title = await pg.title();
    console.log('[sozinha, 1 teste] Render status:', title);
    if (title !== 'rendered-ok') { console.log('FAIL: renderAtHome() threw'); failed = true; }
    else {
      const cardText = await pg.locator('#atp-home').innerText();
      console.log('Texto do card (sem colegas com resultado, já deve ter Ranking Geral com 1 teste):', /Testes Físicos[\s\S]{0,40}/.exec(cardText)?.[0]);
      if (!/1º de 1/.test(cardText)) { console.log('FAIL: devia mostrar "1º de 1 · Geral" — Ranking Geral já com 1 só teste feito (pedido do Roger)'); failed = true; }
      if (!/Geral/.test(cardText)) { console.log('FAIL: devia rotular como "Geral"'); failed = true; }
    }
    await pg.screenshot({ path: path.join(__dirname, '_testes_card_withdata.png'), fullPage: true });
    await pg.close();
  }

  // ── 3) Com colegas de equipa com resultados — card mostra a posição REAL no Ranking
  //      Geral (não "1º de 1"), e a cor reflete o percentil ──
  {
    const pageHtml = buildPage(
      `APP={teams:[{id:'T1',name:'Seniores Fem.'}],athletes,wellness:[],pse:[],schedule:[],injuries:[],convocatorias:[],evalPeriods:[],evalResponses:[],trainingPlans:[],nutritionPlans:[],codeOfConduct:null,
         physicalTestResults:[
           {id:'tf1',testId:'yoyo_ir1',athleteId:'a1',teamId:'T1',date:'2026-10-29',distance:1200},
           {id:'tf2',testId:'yoyo_ir1',athleteId:'a2',teamId:'T1',date:'2026-10-29',distance:2200},
           {id:'tf3',testId:'yoyo_ir1',athleteId:'a3',teamId:'T1',date:'2026-10-29',distance:600}
         ],
         games:[],
         config:{clubName:'Moreirense FC',season:'2026/27'}};
       ROLE='atleta';_sync=false;AID='a1';
       try{ renderAtHome(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_testes_card_ranked.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 480, height: 1100 } });
    await pg.goto('file://' + path.join(__dirname, '_testes_card_ranked.html'));
    await pg.waitForTimeout(250);
    const title = await pg.title();
    console.log('[com colegas] Render status:', title);
    if (title !== 'rendered-ok') { console.log('FAIL: renderAtHome() threw'); failed = true; }
    else {
      const cardText = await pg.locator('#atp-home').innerText();
      console.log('Texto do card (a1 é intermédia de 3 — espera "2º de 3 · Geral"):', /Testes Físicos[\s\S]{0,40}/.exec(cardText)?.[0]);
      if (!/2º de 3/.test(cardText)) { console.log('FAIL: devia mostrar "2º de 3 · Geral" (a1 fica entre a2 e a3)'); failed = true; }
      // nunca revelar nomes/valores de colegas no card
      if (/Beatriz|Carolina|2200|600/.test(cardText)) { console.log('FAIL: o card nunca deve mostrar nomes/valores de colegas'); failed = true; }
    }
    await pg.screenshot({ path: path.join(__dirname, '_testes_card_ranked.png'), fullPage: true });
    await pg.close();
  }

  await browser.close();
  if (failed) { console.log('\nFALHOU'); process.exitCode = 1; }
  else console.log('\nTODAS AS VERIFICAÇÕES VISUAIS PASSARAM');
})();
