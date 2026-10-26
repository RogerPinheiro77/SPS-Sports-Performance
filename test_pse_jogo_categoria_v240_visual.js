// Verificação visual (Playwright) do sps-v240: renderPSEWellness() REAL, com dados
// realistas que incluem sessões de Jogo distintas de Reabilitação/Ativação, para
// confirmar que a 4ª categoria "PSE Jogo" aparece na legenda, no gráfico e na
// tabela Individual, com a cor certa (vermelho, igual à de Jogo no resto da app).
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

  const page_html = `<!doctype html><html><head><meta charset="utf-8">
  ${globalCss}
  <style>body{padding:20px}#pg-pse-wellness{max-width:1400px}</style>
  </head><body>
  <div id="pg-pse-wellness" class="pg" style="display:block"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
  <script>
    ${script}
    function athlete(id,name,num){return {id,name,alcunha:name.split(' ')[0],num,teamId:'T1',pos:'MC',dob:'2005-01-01'};}
    const athletes=[athlete('a1','Diana Silva',9),athlete('a2','Ana Ribeiro',7),athlete('a3','Sofia Leite',10)];
    function dOffset(n){const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);}
    const pse=[];
    for(let i=0;i<14;i++){
      const d=dOffset(-i);
      athletes.forEach((at,idx)=>{
        let type='Treino';
        if(i%7===0)type='Jogo';
        else if(i%5===0)type='Ginásio';
        else if(i%6===0)type='Reabilitação';
        else if(i%4===0)type='Ativação';
        pse.push({id:'p'+i+'_'+at.id,athleteId:at.id,date:d,pse:5+((i+idx)%5),duration:type==='Jogo'?90:60,
          ua:(5+((i+idx)%5))*(type==='Jogo'?90:60),sessionType:type});
      });
    }
    APP={teams:[{id:'T1',name:'Seniores Fem.'}],athletes,pse,wellness:[],config:{}};
    ROLE='treinador';_pwTeam='T1';_pwTab='pse';_curPg='pse-wellness';
    try{ renderPSEWellness(); document.title='rendered-ok'; }
    catch(e){ document.title='render-error'; document.body.insertAdjacentHTML('beforeend','<pre style="color:#f87171;white-space:pre-wrap">'+e.stack+'</pre>'); }
  </script>
  </body></html>`;
  fs.writeFileSync(path.join(__dirname, '_pse_jogo_visual_test.html'), page_html);

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  pg.on('console', (msg) => console.log('[page]', msg.text()));
  await pg.goto('file://' + path.join(__dirname, '_pse_jogo_visual_test.html'));
  await pg.waitForTimeout(500);

  const title = await pg.title();
  console.log('Render status:', title);
  if (title !== 'rendered-ok') {
    console.log('FAIL: renderPSEWellness() threw');
    await pg.screenshot({ path: path.join(__dirname, '_pse_jogo_visual_error.png'), fullPage: true });
    await browser.close();
    process.exitCode = 1;
    return;
  }

  const legendText = await pg.locator('#pg-pse-wellness').innerText();
  const hasJogoLabel = legendText.includes('PSE Jogo');
  const hasOutrosNoJogo = legendText.includes('PSE Outros (Reabilitação · Ativação)');
  console.log('Legenda tem "PSE Jogo":', hasJogoLabel);
  console.log('Legenda "Outros" sem Jogo:', hasOutrosNoJogo);
  if (!hasJogoLabel || !hasOutrosNoJogo) { console.log('FAIL: legenda incorreta'); process.exitCode = 1; }

  const thCount = await pg.locator('.cb table thead th').count();
  console.log('Colunas no cabeçalho da tabela Individual:', thCount);
  if (thCount !== 9) { console.log('FAIL: esperadas 9 colunas'); process.exitCode = 1; }

  await pg.screenshot({ path: path.join(__dirname, '_pse_jogo_visual_full.png'), fullPage: true });
  console.log('Screenshot guardado: _pse_jogo_visual_full.png');

  await browser.close();
})();
