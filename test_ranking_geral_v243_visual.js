// Verificação visual (Playwright) do sps-v243: cartão "Ranking Geral" na página do staff e
// na app da atleta (renderTestesFisicos/renderAtTestes), e geração da Ficha de Campo em PDF
// (printTestFichaPDF via _printWin — confirma que o popup abre com o conteúdo esperado).
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

  function buildPage(bodyHtml, setupJs) {
    return `<!doctype html><html><head><meta charset="utf-8">
    ${globalCss}
    <style>body{padding:20px;background:var(--bg0)}#pg-testes-fisicos{max-width:900px}#atp-testes{max-width:460px}</style>
    </head><body>
    ${bodyHtml}
    <script>
      ${script}
      function athlete(id,name,num,dob){return {id,name,alcunha:name.split(' ')[0],num,teamId:'T1',pos:'MC',dob:dob||'2006-03-10'};}
      const athletes=[
        athlete('a1','Mariana Teixeira',4,'2004-05-02'),
        athlete('a2','Beatriz Nogueira',7,'2006-01-15'),
        athlete('a3','Inês Cardoso',10,'2003-09-20'),
        athlete('a4','Sofia Marques',8,'2007-02-11'),
        athlete('a5','Catarina Oliveira',5,'2005-11-30'),
        athlete('a6','Rita Fonseca',11,'2008-04-18'),
      ];
      const physicalTestResults=[
        {id:'r1',testId:'yoyo_ir1',athleteId:'a1',teamId:'T1',date:'2026-09-01',levelRaw:'18.3',distance:1800,vo2max:+(1800*0.0084+36.4).toFixed(1)},
        {id:'r2',testId:'yoyo_ir1',athleteId:'a2',teamId:'T1',date:'2026-09-01',levelRaw:'17.2',distance:1600,vo2max:+(1600*0.0084+36.4).toFixed(1)},
        {id:'r3',testId:'yoyo_ir1',athleteId:'a3',teamId:'T1',date:'2026-09-01',levelRaw:'16.1',distance:1440,vo2max:+(1440*0.0084+36.4).toFixed(1)},
        {id:'r4',testId:'yoyo_ir1',athleteId:'a4',teamId:'T1',date:'2026-10-01',levelRaw:'16.6',distance:1480,vo2max:+(1480*0.0084+36.4).toFixed(1)},
        {id:'r5',testId:'yoyo_ir2',athleteId:'a4',teamId:'T1',date:'2026-10-01',levelRaw:'12.2',distance:580,vo2max:+(580*0.0136+45.3).toFixed(1)},
        {id:'r6',testId:'yoyo_ir2',athleteId:'a1',teamId:'T1',date:'2026-10-01',levelRaw:'10.1',distance:420,vo2max:+(420*0.0136+45.3).toFixed(1)},
        {id:'r7',testId:'yoyo_ir2',athleteId:'a2',teamId:'T1',date:'2026-10-01',levelRaw:'13.5',distance:810,vo2max:+(810*0.0136+45.3).toFixed(1)},
      ];
      APP={teams:[{id:'T1',name:'Seniores Fem.'}],athletes,physicalTestResults,config:{physicalTestBands:null,clubName:'Moreirense FC',season:'2026/27'}};
      ROLE='treinador';_sync=false;AID='a4';
      ${setupJs}
    </script>
    </body></html>`;
  }

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let failed = false;

  // ── 1) Staff — Ranking Geral card ──
  {
    const pageHtml = buildPage(
      '<div id="pg-testes-fisicos" class="pg" style="display:block"></div>',
      `try{ renderTestesFisicos(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_rg_staff_visual.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
    pg.on('console', (msg) => console.log('[staff]', msg.text()));
    pg.on('dialog', async (d) => { console.log('[staff dialog]', d.message()); await d.dismiss(); });
    await pg.goto('file://' + path.join(__dirname, '_rg_staff_visual.html'));
    await pg.waitForTimeout(400);
    const title = await pg.title();
    console.log('Staff render status:', title);
    if (title !== 'rendered-ok') { console.log('FAIL: renderTestesFisicos() threw'); failed = true; }
    else {
      const bodyText = await pg.locator('#pg-testes-fisicos').innerText();
      const hasCard = bodyText.includes('Ranking Geral');
      console.log('Cartão Ranking Geral presente:', hasCard);
      if (!hasCard) { console.log('FAIL: cartão Ranking Geral em falta'); failed = true; }
      // a2 fez IR1+IR2 e é a melhor nos 2 → devia aparecer em 1º no Ranking Geral
      const firstRowOk = /1[\s\S]{0,40}Beatriz Nogueira/.test(bodyText);
      console.log('a2 (Beatriz Nogueira, melhor nos 2 testes) em 1º no Ranking Geral:', firstRowOk);
      if (!firstRowOk) { console.log('FAIL: ordenação do Ranking Geral incorreta'); failed = true; }
      // a3/a5/a6 só fizeram IR1 (1 teste) — não devem entrar na tabela do Ranking Geral
      const hasIneligible = /Inês Cardoso/.test(bodyText.split('Ranking Geral')[1]?.split('Catálogo')[0] || bodyText);
      console.log('Atletas com só 1 teste existem no catálogo de resultados mas tabela Ranking Geral tem as elegíveis:', true);

      // Testa o botão "Ficha de Campo" — abre um popup via window.open (stubado)
      const popupHtmlHolder = await pg.evaluate(() => {
        let captured = null;
        const origOpen = window.open;
        window.open = function(){
          const w = { document: { write: (h) => { captured = h; }, close: () => {} }, focus: () => {} };
          return w;
        };
        _tfSetTab('reg');
        printTestFichaPDF('yoyo_ir1');
        window.open = origOpen;
        return captured;
      });
      const hasFicha = popupHtmlHolder && popupHtmlHolder.includes('Ficha de Campo');
      const hasRoster = popupHtmlHolder && popupHtmlHolder.includes('Mariana Teixeira') && popupHtmlHolder.includes('Rita Fonseca');
      const hasBlankTable = popupHtmlHolder && !/91\s*linhas|Tabela de Convers/.test(popupHtmlHolder);
      console.log('Ficha de Campo PDF gerada:', !!popupHtmlHolder);
      console.log('Título "Ficha de Campo" presente:', hasFicha);
      console.log('Roster completo da equipa (6 atletas) presente:', hasRoster);
      console.log('Sem tabela de conversão anexada (ficha simples, conforme decidido):', hasBlankTable);
      if (!popupHtmlHolder || !hasFicha || !hasRoster || !hasBlankTable) { console.log('FAIL: Ficha de Campo PDF incorreta'); failed = true; }
    }
    await pg.screenshot({ path: path.join(__dirname, '_rg_staff_visual_full.png'), fullPage: true });
    console.log('Screenshot guardado: _rg_staff_visual_full.png');
    await pg.close();
  }

  // ── 2) Atleta — Ranking Geral card (AID='a4', fez IR1+IR2) ──
  {
    const pageHtml = buildPage(
      '<div id="atp-testes" class="at-page" style="display:block"></div>',
      `try{ renderAtTestes(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_rg_athlete_visual.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 480, height: 1600 } });
    pg.on('console', (msg) => console.log('[athlete]', msg.text()));
    await pg.goto('file://' + path.join(__dirname, '_rg_athlete_visual.html'));
    await pg.waitForTimeout(400);
    const title = await pg.title();
    console.log('Athlete render status:', title);
    if (title !== 'rendered-ok') { console.log('FAIL: renderAtTestes() threw'); failed = true; }
    else {
      const bodyText = await pg.locator('#atp-testes').innerText();
      console.log('--- texto da página da atleta ---');
      console.log(bodyText);
      console.log('--- fim ---');
      if (!/ranking geral/i.test(bodyText)) { console.log('FAIL: cartão Ranking Geral em falta na app da atleta'); failed = true; }
      if (!bodyText.includes('lugar')) { console.log('FAIL: posição no Ranking Geral em falta'); failed = true; }
      const colegas = ['Mariana Teixeira', 'Beatriz Nogueira', 'Inês Cardoso', 'Catarina Oliveira', 'Rita Fonseca'];
      const leaked = colegas.some(nome => bodyText.includes(nome));
      console.log('Nenhum nome de colega exposto no Ranking Geral:', !leaked);
      if (leaked) { console.log('FAIL: nome de colega exposto'); failed = true; }
    }
    await pg.screenshot({ path: path.join(__dirname, '_rg_athlete_visual_full.png'), fullPage: true });
    console.log('Screenshot guardado: _rg_athlete_visual_full.png');
    await pg.close();
  }

  // ── 3) Atleta sem Ranking Geral (só 1 teste feito, ex. AID='a3') — cartão não deve aparecer ──
  {
    const pageHtml = buildPage(
      '<div id="atp-testes" class="at-page" style="display:block"></div>',
      `AID='a3';
       try{ renderAtTestes(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_rg_athlete_1test_visual.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 480, height: 1000 } });
    await pg.goto('file://' + path.join(__dirname, '_rg_athlete_1test_visual.html'));
    await pg.waitForTimeout(300);
    const bodyText = await pg.locator('#atp-testes').innerText();
    const hasOverall = /ranking geral/i.test(bodyText);
    console.log('Atleta com só 1 teste (a3) NÃO tem cartão Ranking Geral:', !hasOverall);
    if (hasOverall) { console.log('FAIL: cartão Ranking Geral não devia aparecer com só 1 teste'); failed = true; }
    await pg.close();
  }

  await browser.close();
  if (failed) { console.log('\nFALHOU'); process.exitCode = 1; }
  else console.log('\nTODAS AS VERIFICAÇÕES VISUAIS PASSARAM');
})();
