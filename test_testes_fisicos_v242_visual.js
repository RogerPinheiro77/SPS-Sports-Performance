// Verificação visual (Playwright) do sps-v242: "Testes Físicos" (Yo-Yo IR1 + IR2) —
// confirma que renderTestesFisicos() (staff) e renderAtTestes() (atleta) renderizam sem
// excepções, com dados realistas de um plantel com vários resultados, bandas automáticas
// (IR1, por idade) e bandas ainda por definir (IR2) — e que o ranking da atleta nunca expõe
// nomes/valores de colegas.
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
        {id:'r4',testId:'yoyo_ir1',athleteId:'a4',teamId:'T1',date:'2026-06-01',levelRaw:'15.5',distance:1240,vo2max:+(1240*0.0084+36.4).toFixed(1)},
        {id:'r5',testId:'yoyo_ir1',athleteId:'a4',teamId:'T1',date:'2026-10-01',levelRaw:'16.6',distance:1480,vo2max:+(1480*0.0084+36.4).toFixed(1)},
        {id:'r6',testId:'yoyo_ir1',athleteId:'a5',teamId:'T1',date:'2026-09-01',levelRaw:'14.3',distance:990,vo2max:+(990*0.0084+36.4).toFixed(1)},
        {id:'r7',testId:'yoyo_ir1',athleteId:'a6',teamId:'T1',date:'2026-09-01',levelRaw:'13.2',distance:770,vo2max:+(770*0.0084+36.4).toFixed(1)},
        {id:'r8',testId:'yoyo_ir2',athleteId:'a4',teamId:'T1',date:'2026-10-01',levelRaw:'12.2',distance:580,vo2max:+(580*0.0136+45.3).toFixed(1)},
      ];
      APP={teams:[{id:'T1',name:'Seniores Fem.'}],athletes,physicalTestResults,config:{physicalTestBands:null}};
      ROLE='treinador';_sync=false;AID='a4';
      ${setupJs}
    </script>
    </body></html>`;
  }

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let failed = false;

  // ── 1) Vista Staff ──
  {
    const pageHtml = buildPage(
      '<div id="pg-testes-fisicos" class="pg" style="display:block"></div>',
      `try{ renderTestesFisicos(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_tf_staff_visual.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
    pg.on('console', (msg) => console.log('[staff]', msg.text()));
    await pg.goto('file://' + path.join(__dirname, '_tf_staff_visual.html'));
    await pg.waitForTimeout(400);
    const title = await pg.title();
    console.log('Staff render status:', title);
    if (title !== 'rendered-ok') { console.log('FAIL: renderTestesFisicos() threw'); failed = true; }
    else {
      const bodyText = await pg.locator('#pg-testes-fisicos').innerText();
      const hasCatalog = bodyText.includes('Yo-Yo Intermittent Recovery Test');
      const hasResultsTab = bodyText.includes('Resultados');
      console.log('Catálogo com os 2 testes:', hasCatalog);
      console.log('Tab Resultados presente:', hasResultsTab);
      if (!hasCatalog || !hasResultsTab) { console.log('FAIL: conteúdo esperado em falta'); failed = true; }

      // Vai a Registar — grid com inputs para cada atleta
      await pg.evaluate(() => { _tfSetTab('reg'); });
      await pg.waitForTimeout(150);
      const inputCount = await pg.locator('#pg-testes-fisicos input[data-aid]').count();
      console.log('Inputs de registo (1 por atleta):', inputCount);
      if (inputCount !== 6) { console.log('FAIL: esperados 6 inputs de registo'); failed = true; }

      // Live calc ao escrever um nível novo
      const firstInput = pg.locator('#pg-testes-fisicos input[data-aid]').first();
      const aid = await firstInput.getAttribute('data-aid');
      await firstInput.fill('19.4');
      await pg.waitForTimeout(150);
      const distTxt = await pg.locator('#tfr-dist-' + aid).innerText();
      console.log('Live calc da distância (19.4):', distTxt);
      if (!distTxt.includes('2200')) { console.log('FAIL: live calc incorreto (esperado 2200 m)'); failed = true; }

      // Vai a Bandas — IR1 deve ter toggle auto/manual; muda para IR2 e verifica nota sem ciência
      await pg.evaluate(() => { _tfSetTab('band'); });
      await pg.waitForTimeout(150);
      const bandsIr1 = await pg.locator('#pg-testes-fisicos').innerText();
      const hasAutoBtn = bandsIr1.includes('Automático (por idade)');
      console.log('IR1 tem opção de bandas automáticas:', hasAutoBtn);
      if (!hasAutoBtn) { console.log('FAIL: IR1 devia oferecer bandas automáticas'); failed = true; }

      await pg.evaluate(() => { _tfSelectTest('yoyo_ir2'); _tfSetTab('band'); });
      await pg.waitForTimeout(150);
      const bandsIr2 = await pg.locator('#pg-testes-fisicos').innerText();
      const hasManualNote = bandsIr2.includes('Sem referência científica publicada');
      console.log('IR2 avisa falta de referência científica:', hasManualNote);
      if (!hasManualNote) { console.log('FAIL: IR2 devia avisar falta de bandas científicas'); failed = true; }
    }
    await pg.screenshot({ path: path.join(__dirname, '_tf_staff_visual_full.png'), fullPage: true });
    console.log('Screenshot guardado: _tf_staff_visual_full.png');
    await pg.close();
  }

  // ── 2) Vista Atleta (AID='a4', Sofia Marques — tem IR1 com evolução e IR2 sem bandas) ──
  {
    const pageHtml = buildPage(
      '<div id="atp-testes" class="at-page" style="display:block"></div>',
      `try{ renderAtTestes(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_tf_athlete_visual.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 480, height: 1400 } });
    pg.on('console', (msg) => console.log('[athlete]', msg.text()));
    await pg.goto('file://' + path.join(__dirname, '_tf_athlete_visual.html'));
    await pg.waitForTimeout(400);
    const title = await pg.title();
    console.log('Athlete render status:', title);
    if (title !== 'rendered-ok') { console.log('FAIL: renderAtTestes() threw'); failed = true; }
    else {
      const bodyText = await pg.locator('#atp-testes').innerText();
      console.log('--- texto da página da atleta ---');
      console.log(bodyText);
      console.log('--- fim ---');

      // a4 (Sofia Marques) tem 2 resultados IR1 (1240 depois 1480) — deve mostrar o mais recente,
      // evolução vs. anterior, e ranking sem nomes de colegas.
      if (!bodyText.includes('1480 m')) { console.log('FAIL: devia mostrar o resultado mais recente (1480 m)'); failed = true; }
      if (!bodyText.includes('lugar')) { console.log('FAIL: devia mostrar posição no ranking'); failed = true; }
      if (!bodyText.includes('Nunca vês os nomes')) { console.log('FAIL: nota de não-exposição em falta'); failed = true; }
      // nomes de colegas NUNCA devem aparecer na página da atleta
      const colegas = ['Mariana Teixeira', 'Beatriz Nogueira', 'Inês Cardoso', 'Catarina Oliveira', 'Rita Fonseca'];
      colegas.forEach(nome => {
        if (bodyText.includes(nome)) { console.log('FAIL: nome de colega exposto na app da atleta:', nome); failed = true; }
      });
      console.log('Nenhum nome de colega exposto: ' + !colegas.some(n => bodyText.includes(n)));
      // IR2 (sem bandas definidas) deve mostrar a nota neutra, não uma cor inventada
      if (!bodyText.includes('Bandas de referência por definir pelo staff')) { console.log('FAIL: IR2 devia mostrar nota neutra (sem bandas)'); failed = true; }
    }
    await pg.screenshot({ path: path.join(__dirname, '_tf_athlete_visual_full.png'), fullPage: true });
    console.log('Screenshot guardado: _tf_athlete_visual_full.png');
    await pg.close();
  }

  await browser.close();
  if (failed) { console.log('\nFALHOU'); process.exitCode = 1; }
  else console.log('\nTODAS AS VERIFICAÇÕES VISUAIS PASSARAM');
})();
