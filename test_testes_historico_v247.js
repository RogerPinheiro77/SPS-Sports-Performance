// Verificação visual (Playwright) do sps-v247: separador "Histórico" em Testes Físicos
// (staff) + PDF "Comparativo (últimos 3)" — pedido do Roger: "preciso de ter um registo de
// histórico dos testes e possibilidade de impressão com comparativo dos últimos 3 de forma a
// ver se há evolução".
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
    <style>body{padding:20px;background:var(--bg0)}#pg-testes-fisicos{max-width:900px}</style>
    </head><body>
    <div id="pg-testes-fisicos" class="pg" style="display:block"></div>
    <script>
      ${script}
      function athlete(id,name,num,dob){return {id,name,alcunha:name.split(' ')[0],num,teamId:'T1',pos:'MC',dob:dob||'2005-06-10'};}
      const athletes=[
        athlete('a1','Mariana Teixeira',4,'2004-05-02'),
        athlete('a2','Beatriz Nogueira',7,'2006-01-15'),
      ];
      // a1: 3 resultados de Yo-Yo IR1, a evoluir (1200 -> 1600 -> 2000) — caso central do pedido.
      // a2: só 1 resultado — serve para confirmar que o botão de PDF fica desativado.
      const physicalTestResults=[
        {id:'r1',testId:'yoyo_ir1',athleteId:'a1',teamId:'T1',date:'2026-08-01',levelRaw:'13.1',distance:1200,vo2max:+(1200*0.0084+36.4).toFixed(1)},
        {id:'r2',testId:'yoyo_ir1',athleteId:'a1',teamId:'T1',date:'2026-09-15',levelRaw:'15.5',distance:1600,vo2max:+(1600*0.0084+36.4).toFixed(1)},
        {id:'r3',testId:'yoyo_ir1',athleteId:'a1',teamId:'T1',date:'2026-10-29',levelRaw:'17.3',distance:2000,vo2max:+(2000*0.0084+36.4).toFixed(1)},
        {id:'r4',testId:'yoyo_ir1',athleteId:'a2',teamId:'T1',date:'2026-10-29',levelRaw:'12.2',distance:1080,vo2max:+(1080*0.0084+36.4).toFixed(1)},
      ];
      APP={teams:[{id:'T1',name:'Seniores Fem.'}],athletes,physicalTestResults,config:{physicalTestBands:null,clubName:'Moreirense FC',season:'2026/27'}};
      ROLE='treinador';_sync=false;AID='a1';
      ${setupJs}
    </script>
    </body></html>`;
  }

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let failed = false;

  // ── 1) Separador "Histórico" — existe, e mostra as 3 datas de a1 com setas de evolução ──
  {
    const pageHtml = buildPage(
      `try{ _tfTab='hist'; _tfHistAthlete='a1'; renderTestesFisicos(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_tf_hist_visual.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    pg.on('console', (msg) => console.log('[hist]', msg.text()));
    await pg.goto('file://' + path.join(__dirname, '_tf_hist_visual.html'));
    await pg.waitForTimeout(300);
    const title = await pg.title();
    console.log('Render status:', title);
    if (title !== 'rendered-ok') { console.log('FAIL: renderTestesFisicos() (aba Histórico) threw'); failed = true; }
    else {
      const bodyText = await pg.locator('#pg-testes-fisicos').innerText();
      const hasTabLabel = /Histórico/.test(bodyText);
      const has3Dates = ['01/08/2026', '15/09/2026', '29/10/2026'].every(d => bodyText.includes(d));
      console.log('Separador "Histórico" presente:', hasTabLabel, '| as 3 datas de a1 aparecem:', has3Dates);
      if (!hasTabLabel) { console.log('FAIL: separador Histórico não aparece'); failed = true; }
      if (!has3Dates) { console.log('FAIL: não mostra as 3 datas do histórico completo de a1'); failed = true; }
      // evolução positiva em todas as transições (1200->1600->2000) — espera setas ↑ (2x, entre as 3 datas)
      const upArrows = (bodyText.match(/↑/g) || []).length;
      console.log('Setas de evolução positiva (↑) encontradas:', upArrows);
      if (upArrows < 2) { console.log('FAIL: esperava pelo menos 2 setas ↑ (distância e VO2max a subir entre os 3 testes)'); failed = true; }
      // botão de PDF deve estar ativo (a1 tem 3 resultados, ≥2)
      const printBtn = pg.locator('button:has-text("PDF Comparativo")');
      const isDisabled = await printBtn.isDisabled();
      console.log('Botão "PDF Comparativo" ativo para a1 (3 resultados):', !isDisabled);
      if (isDisabled) { console.log('FAIL: botão de PDF devia estar ativo com 3 resultados'); failed = true; }
    }
    await pg.screenshot({ path: path.join(__dirname, '_tf_hist_visual_full.png'), fullPage: true });
    await pg.close();
  }

  // ── 2) Trocar para a2 (só 1 resultado) — botão de PDF fica desativado, aviso aparece ──
  {
    const pageHtml = buildPage(
      `try{ _tfTab='hist'; _tfHistAthlete='a2'; renderTestesFisicos(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }`
    );
    fs.writeFileSync(path.join(__dirname, '_tf_hist_a2_visual.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await pg.goto('file://' + path.join(__dirname, '_tf_hist_a2_visual.html'));
    await pg.waitForTimeout(300);
    const bodyText = await pg.locator('#pg-testes-fisicos').innerText();
    const hasWarning = /pelo menos 2 resultados/i.test(bodyText);
    const printBtn = pg.locator('button:has-text("PDF Comparativo")');
    const isDisabled = await printBtn.isDisabled();
    console.log('a2 (só 1 resultado) — botão de PDF desativado:', isDisabled, '| aviso presente:', hasWarning);
    if (!isDisabled) { console.log('FAIL: botão de PDF devia estar desativado com só 1 resultado'); failed = true; }
    if (!hasWarning) { console.log('FAIL: devia explicar que precisa de ≥2 resultados'); failed = true; }
    await pg.close();
  }

  // ── 3) printTestHistoryPDF — popup (window.open stubado) com as 3 datas, nível, distância,
  //      VO2max, setas de tendência, classificação e nota de evolução ──
  {
    const pageHtml = buildPage(
      `try{ _tfTab='hist'; _tfHistAthlete='a1'; renderTestesFisicos(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; }`
    );
    fs.writeFileSync(path.join(__dirname, '_tf_hist_pdf_visual.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await pg.goto('file://' + path.join(__dirname, '_tf_hist_pdf_visual.html'));
    await pg.waitForTimeout(300);
    const popupHtml = await pg.evaluate(() => {
      let captured = null;
      const origOpen = window.open;
      window.open = function(){
        const w = { document: { write: (h) => { captured = h; }, close: () => {} }, focus: () => {} };
        return w;
      };
      printTestHistoryPDF('yoyo_ir1', 'a1');
      window.open = origOpen;
      return captured;
    });
    console.log('PDF Comparativo gerado:', !!popupHtml);
    // Nota: o gráfico (_naTrendB64, via Chart.js) não é verificado aqui — este harness mínimo
    // não carrega o Chart.js do CDN (mesma limitação de qualquer teste Node/Playwright deste
    // projeto que não sirva a página completa); _naTrendB64 já tem o seu próprio try/catch e
    // devolve '' em caso de erro, por isso a ausência do gráfico aqui não é falha de código.
    const checks = {
      'título "Comparativo"': popupHtml && /Comparativo de Evolução/.test(popupHtml),
      'nome da atleta': popupHtml && /Mariana Teixeira/.test(popupHtml),
      '3 datas das 3 colunas': popupHtml && ['01/08/2026', '15/09/2026', '29/10/2026'].every(d => popupHtml.includes(d)),
      'distâncias das 3 colunas': popupHtml && ['1200', '1600', '2000'].every(d => popupHtml.includes(d)),
      'nota de evolução positiva (+800 m)': popupHtml && /\+800 m/.test(popupHtml),
    };
    Object.entries(checks).forEach(([k, v]) => console.log(' -', k, ':', !!v));
    if (!popupHtml || Object.values(checks).some(v => !v)) { console.log('FAIL: PDF Comparativo incompleto/incorreto'); failed = true; }
    await pg.close();
  }

  // ── 4) printTestHistoryPDF com <2 resultados — não abre popup, mostra toast de erro ──
  {
    const pageHtml = buildPage(
      `try{ _tfTab='hist'; _tfHistAthlete='a2'; renderTestesFisicos(); document.title='rendered-ok'; }
       catch(e){ document.title='render-error'; }`
    );
    fs.writeFileSync(path.join(__dirname, '_tf_hist_pdf_blocked_visual.html'), pageHtml);
    const pg = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await pg.goto('file://' + path.join(__dirname, '_tf_hist_pdf_blocked_visual.html'));
    await pg.waitForTimeout(300);
    const result = await pg.evaluate(() => {
      let opened = false;
      const origOpen = window.open;
      window.open = function(){ opened = true; return { document: { write: () => {}, close: () => {} }, focus: () => {} }; };
      window.toast = () => {}; // harness mínimo não tem o elemento de toast da app real
      printTestHistoryPDF('yoyo_ir1', 'a2'); // a2 só tem 1 resultado
      window.open = origOpen;
      return opened;
    });
    console.log('a2 (1 resultado) — printTestHistoryPDF NÃO abriu popup:', !result);
    if (result) { console.log('FAIL: não devia gerar PDF com menos de 2 resultados'); failed = true; }
    await pg.close();
  }

  await browser.close();
  if (failed) { console.log('\nFALHOU'); process.exitCode = 1; }
  else console.log('\nTODAS AS VERIFICAÇÕES VISUAIS PASSARAM');
})();
