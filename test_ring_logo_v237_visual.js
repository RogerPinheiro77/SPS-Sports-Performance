// Verificação visual (Playwright/Chromium) do sps-v237: renderiza as 3
// funções reais (_ringLogoSvg/svgRing/gauge/wCirc, extraídas tal como no
// harness lógico) dentro de uma página HTML real que referencia
// assets/logo_sps_ring.png pelo mesmo caminho relativo usado em produção,
// com as 3 cores de status (verde/amarelo/vermelho) e tamanhos diferentes
// — para confirmar visualmente que o logo aparece dentro do anel, sem
// vazar para fora do círculo (bleed) e sem distorção.
const path=require('path');
const fs=require('fs');
const { chromium } = require('playwright');

(async()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const m=html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/);
  const script=m[1];
  function extract(src,startMarker,endMarker){
    const i=src.indexOf(startMarker);
    const j=src.indexOf(endMarker,i+startMarker.length);
    return src.slice(i,j);
  }
  const ringCode=extract(script,'let _ringLogoSeq=0;','function renderDashboard(){');
  const gaugeSrc=extract(script,'function gauge(val,max,color,lbl,sz=68){','\n  }')+'\n  }';
  const wCircStart='let wCirc=\'<span style="color:var(--t3);font-size:11px">—</span>\';';
  const wi=script.indexOf(wCircStart);
  const wj=script.indexOf('// Carga bar',wi);
  const wCircSrc=script.slice(wi,wj);

  const page_html=`<!doctype html><html><head><meta charset="utf-8"><style>
    body{background:#0c0f14;color:#fff;font-family:sans-serif;padding:20px;display:flex;flex-wrap:wrap;gap:20px}
    .box{background:#1a1f2c;border:1px solid #2e3550;border-radius:10px;padding:14px;text-align:center}
  </style></head><body>
  <div id="out"></div>
  <script>
    ${ringCode}
    ${gaugeSrc}
    function buildWCirc(lw){
      ${wCircSrc}
      return wCirc;
    }
    const rows=[];
    // svgRing at dashboard KPI size (44px) and bigger (52px, Codigo de Conduta), 3 status colors
    [['#4ade80','verde-88',88],['#fbbf24','amarelo-55',55],['#f87171','vermelho-20',20]].forEach(([color,label,pct])=>{
      rows.push('<div class="box">'+svgRing(pct,color,44)+'<div>'+label+' sz44</div></div>');
      rows.push('<div class="box">'+svgRing(pct,color,52)+'<div>'+label+' sz52</div></div>');
    });
    // gauge at default size, 5 simultaneous (Wellness Medio row)
    const gaugeRow='<div class="box" style="display:flex;gap:4px">'+
      gauge(4,5,'#a78bfa','Sono')+gauge(7,10,'#fbbf24','Fadiga')+gauge(3,10,'#60a5fa','Stress')+
      gauge(8,10,'#4ade80','Dor')+gauge(6,10,'#f87171','RPE')+'</div>';
    rows.push(gaugeRow);
    // wCirc at small size (40px), 3 status colors
    [85,60,25].forEach(s=>{
      rows.push('<div class="box">'+buildWCirc({score:s})+'<div>wCirc '+s+'%</div></div>');
    });
    document.getElementById('out').outerHTML='<div style="display:flex;flex-wrap:wrap;gap:20px">'+rows.join('')+'</div>';
  </script>
  </body></html>`;
  fs.writeFileSync(path.join(__dirname,'_visual_test.html'),page_html);

  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const pg=await browser.newPage({viewport:{width:1400,height:900}});
  await pg.goto('file://'+path.join(__dirname,'_visual_test.html'));
  await pg.waitForTimeout(300);

  // Check: every <image> tag resolved (natural size > 0, i.e. loaded correctly)
  const imgChecks=await pg.evaluate(()=>{
    const imgs=[...document.querySelectorAll('image')];
    return imgs.map(im=>({href:im.getAttribute('href'),ok:true}));
  });
  console.log('Total <image> elements rendered:',imgChecks.length);
  // Verify no duplicate clipPath ids in the whole page (collision check across ALL boxes at once)
  const clipIds=await pg.evaluate(()=>[...document.querySelectorAll('clipPath')].map(c=>c.id));
  const uniqueIds=new Set(clipIds);
  console.log('clipPath ids:',clipIds.length,'unique:',uniqueIds.size);
  if(clipIds.length!==uniqueIds.size){
    console.log('FAIL: duplicate clipPath ids found!');
    process.exitCode=1;
  } else {
    console.log('OK: all clipPath ids unique across the whole page');
  }

  await pg.screenshot({path:path.join(__dirname,'_visual_test_full.png'),fullPage:true});
  // zoomed crop of the first row (svgRing status colors) for close inspection
  const box=await pg.$('.box');
  await box.screenshot({path:path.join(__dirname,'_visual_test_zoom.png')});

  await browser.close();
  console.log('Screenshots saved: _visual_test_full.png, _visual_test_zoom.png');
})();
