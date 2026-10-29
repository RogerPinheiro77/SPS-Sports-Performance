// Verificação visual (Playwright) do sps-v244: registo do Yo-Yo IR1 por "Etapa" em vez de
// "Nível.Patamar" — confirma que escrever só a etapa no campo de Registar já preenche
// distância/VO2max/nível corretamente, em direto, e que um registo existente reabre com a
// etapa certa (não o nível.patamar) no campo.
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
    <style>body{padding:20px;background:var(--bg0)}#pg-testes-fisicos{max-width:900px}</style>
    </head><body>
    ${bodyHtml}
    <script>
      ${script}
      function athlete(id,name,num,dob){return {id,name,alcunha:name.split(' ')[0],num,teamId:'T1',pos:'MC',dob:dob||'2006-03-10'};}
      const athletes=[
        athlete('a1','Mariana Teixeira',4,'2004-05-02'),
        athlete('a2','Beatriz Nogueira',7,'2006-01-15'),
      ];
      APP={teams:[{id:'T1',name:'Seniores Fem.'}],athletes,physicalTestResults:[],config:{physicalTestBands:null,clubName:'Moreirense FC',season:'2026/27'}};
      ROLE='treinador';_sync=false;AID='a1';_tfRegDate='2026-10-29';
      ${setupJs}
    </script>
    </body></html>`;
  }

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let failed = false;

  // ── 1) Escrever uma etapa no campo de registo calcula tudo em direto ──
  {
    const pageHtml = buildPage(
      '<div id="pg-testes-fisicos" class="pg" style="display:block"></div>',
      `_tfTab='reg';
       try{ renderTestesFisicos(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_etapa_reg_visual.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    pg.on('console', (msg) => console.log('[reg]', msg.text()));
    await pg.goto('file://' + path.join(__dirname, '_etapa_reg_visual.html'));
    await pg.waitForTimeout(300);
    const title = await pg.title();
    console.log('Render status:', title);
    if (title !== 'rendered-ok') { console.log('FAIL: renderTestesFisicos() threw'); failed = true; }
    else {
      // campo de registo da Mariana Teixeira (a1) — escreve etapa "12" (-> nível 14.1, 480m)
      const headerText = await pg.locator('.grid-row.hd').innerText();
      const hasEtapaHeader = /etapa/i.test(headerText);
      console.log('Cabeçalho da coluna mudou para "Etapa":', hasEtapaHeader, '| texto:', headerText.replace(/\n/g,' | '));
      if (!hasEtapaHeader) { console.log('FAIL: cabeçalho ainda diz Nível.Patamar'); failed = true; }

      const input = pg.locator('#tfr-a1 input[data-aid="a1"]');
      await input.fill('12');
      await input.dispatchEvent('input');
      await pg.waitForTimeout(150);
      const distText = await pg.locator('#tfr-dist-a1').innerText();
      console.log('Distância calculada a partir da etapa 12:', distText);
      const distOk = /480\s*m/.test(distText) && /14\.1/.test(distText);
      if (!distOk) { console.log('FAIL: distância/nível errados para etapa 12 (esperado 480 m, Nível 14.1)'); failed = true; }

      const vo2Text = await pg.locator('#tfr-vo2-a1').innerText();
      console.log('VO2max calculado:', vo2Text);
      const expectedVo2 = (480*0.0084+36.4).toFixed(1);
      if (vo2Text.trim() !== expectedVo2) { console.log(`FAIL: VO2max esperado ${expectedVo2}, obtido ${vo2Text}`); failed = true; }

      // etapa inválida (além do máximo da tabela, 107) -> mensagem clara, sem crash
      const input2 = pg.locator('#tfr-a2 input[data-aid="a2"]');
      await input2.fill('500');
      await input2.dispatchEvent('input');
      await pg.waitForTimeout(150);
      const distText2 = await pg.locator('#tfr-dist-a2').innerText();
      console.log('Etapa inválida (500) mostra:', distText2);
      if (!/etapa inválida/i.test(distText2)) { console.log('FAIL: etapa inválida devia mostrar "etapa inválida"'); failed = true; }

      // guarda e confirma que fica persistido corretamente (toast stubado — este harness
      // mínimo não tem o elemento de toast da app real)
      await pg.evaluate(() => { window.toast = () => {}; _tfSaveAll('yoyo_ir1'); });
      await pg.waitForTimeout(150);
      const saved = await pg.evaluate(() => APP.physicalTestResults.find(r => r.athleteId === 'a1'));
      console.log('Registo guardado:', JSON.stringify(saved));
      const savedOk = saved && saved.levelRaw === '14.1' && saved.etapaRaw === '12' && saved.distance === 480;
      if (!savedOk) { console.log('FAIL: registo guardado incorreto (esperado levelRaw=14.1, etapaRaw=12, distance=480)'); failed = true; }
    }
    await pg.screenshot({ path: path.join(__dirname, '_etapa_reg_visual_full.png'), fullPage: true });
    console.log('Screenshot guardado: _etapa_reg_visual_full.png');
    await pg.close();
  }

  // ── 2) Reabrir o registo (já guardado) mostra a ETAPA no campo, não o nível.patamar ──
  {
    const pageHtml = buildPage(
      '<div id="pg-testes-fisicos" class="pg" style="display:block"></div>',
      `_tfTab='reg';
       APP.physicalTestResults=[{id:'tf1',testId:'yoyo_ir1',athleteId:'a1',teamId:'T1',date:'2026-10-29',levelRaw:'14.1',etapaRaw:'12',distance:480,vo2max:+(480*0.0084+36.4).toFixed(1)}];
       try{ renderTestesFisicos(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_etapa_reopen_visual.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await pg.goto('file://' + path.join(__dirname, '_etapa_reopen_visual.html'));
    await pg.waitForTimeout(300);
    const val = await pg.locator('#tfr-a1 input[data-aid="a1"]').inputValue();
    console.log('Valor no campo ao reabrir registo existente (etapaRaw=12, levelRaw=14.1):', val);
    if (val !== '12') { console.log('FAIL: devia mostrar "12" (a etapa), mostrou "' + val + '"'); failed = true; }
    await pg.close();
  }

  // ── 3) Registo ANTIGO (de antes desta alteração, só com levelRaw, sem etapaRaw) reabre
  //      reconstruindo a etapa a partir do nível.patamar — não fica em branco ──
  {
    const pageHtml = buildPage(
      '<div id="pg-testes-fisicos" class="pg" style="display:block"></div>',
      `_tfTab='reg';
       APP.physicalTestResults=[{id:'tf-old',testId:'yoyo_ir1',athleteId:'a1',teamId:'T1',date:'2026-10-29',levelRaw:'19.4',distance:2200,vo2max:+(2200*0.0084+36.4).toFixed(1)}];
       try{ renderTestesFisicos(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_etapa_legacy_visual.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await pg.goto('file://' + path.join(__dirname, '_etapa_legacy_visual.html'));
    await pg.waitForTimeout(300);
    const val = await pg.locator('#tfr-a1 input[data-aid="a1"]').inputValue();
    console.log('Registo antigo (só levelRaw=19.4, sem etapaRaw) reabre com etapa reconstruída:', val);
    if (val !== '55') { console.log('FAIL: devia reconstruir etapa 55 a partir de 19.4, mostrou "' + val + '"'); failed = true; }
    await pg.close();
  }

  await browser.close();
  if (failed) { console.log('\nFALHOU'); process.exitCode = 1; }
  else console.log('\nTODAS AS VERIFICAÇÕES VISUAIS PASSARAM');
})();
