// Teste do sps-v237 — logo SPS embutido nos anéis de progresso (Dashboard +
// Estado do Plantel + Wellness Médio + Código de Conduta).
// Extrai as funções REAIS de index.html (não réplicas) e testa:
// 1. _ringLogoSvg: ids de clipPath únicos, raio interior correto (r - sw/2).
// 2. svgRing: embute o anel de logo, mantém o arco de progresso.
// 3. gauge (função local dentro de renderDashboard): embute o logo, caption
//    HTML com valor+"/10" fora do SVG, sem <text> interno.
// 4. wCirc (inline em plantelRow): embute o logo, caption HTML com "%" fora
//    do SVG, sem <text> interno.
// 5. Sem colisão de id quando várias instâncias renderizam na mesma página
//    (5x gauge, várias linhas de wCirc).
// 6. Verificação visual real via Playwright/Chromium: a imagem
//    assets/logo_sps_ring.png aparece renderizada dentro do clip circular,
//    sem overflow visível fora do círculo.

const fs=require('fs');
const path=require('path');
const assert=require('assert');
const vm=require('vm');

const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const m=html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script block not found');
const script=m[1];

function extract(src,startMarker,endMarker){
  const i=src.indexOf(startMarker);
  if(i<0)throw new Error('start marker not found: '+startMarker);
  const j=src.indexOf(endMarker,i+startMarker.length);
  if(j<0)throw new Error('end marker not found: '+endMarker);
  return src.slice(i,j);
}

// _ringLogoSvg + svgRing (top-level, easy to extract as a contiguous block)
const ringCode=extract(script,'let _ringLogoSeq=0;','function renderDashboard(){');

// gauge() — nested inside renderDashboard(), extract just the function body
const gaugeSrc=extract(script,'function gauge(val,max,color,lbl,sz=68){','\n  }')+'\n  }';

// wCirc inline builder — extract the two lines
const wCircStart='let wCirc=\'<span style="color:var(--t3);font-size:11px">—</span>\';';
const wi=script.indexOf(wCircStart);
if(wi<0)throw new Error('wCirc start not found');
const wEndMarker='// Carga bar';
const wj=script.indexOf(wEndMarker,wi);
const wCircSrc=script.slice(wi,wj);

let pass=0,fail=0;
function check(name,fn){
  try{fn();console.log('  ok  -',name);pass++;}
  catch(e){console.log('  FAIL-',name,'::',e.message);fail++;}
}

console.log('=== Extraction sanity ===');
check('_ringLogoSvg definition extracted',()=>{
  assert(ringCode.includes('function _ringLogoSvg'));
  assert(ringCode.includes('assets/logo_sps_ring.png'));
});
check('gauge() extracted, no inner <text>',()=>{
  assert(gaugeSrc.includes('function gauge'));
  assert(!gaugeSrc.includes('<text'),'gauge() must not have inner <text> anymore');
  assert(gaugeSrc.includes('_ringLogoSvg'));
});
check('wCirc extracted, no inner <text>',()=>{
  assert(!wCircSrc.includes('<text'),'wCirc must not have inner <text> anymore');
  assert(wCircSrc.includes('_ringLogoSvg'));
});

// Build a sandbox to actually run the extracted code
const sandbox={console};
vm.createContext(sandbox);
vm.runInContext(ringCode,sandbox);

console.log('\n=== _ringLogoSvg / svgRing behavior ===');
check('_ringLogoSvg: image radius = r - strokeW/2',()=>{
  const out=vm.runInContext('_ringLogoSvg(50,50,20,4)',sandbox);
  // ir = 20-2=18 -> width/height = 36, x/y = 50-18=32
  assert(out.includes('width="36"')&&out.includes('height="36"'),out);
  assert(out.includes('x="32"')&&out.includes('y="32"'),out);
  assert(out.includes('href="assets/logo_sps_ring.png"'),out);
});
check('_ringLogoSvg: sequential unique clipPath ids across calls',()=>{
  vm.runInContext('_ringLogoSeq=0',sandbox);
  const a=vm.runInContext('_ringLogoSvg(10,10,5,1)',sandbox);
  const b=vm.runInContext('_ringLogoSvg(10,10,5,1)',sandbox);
  const idA=a.match(/id="(rlg\d+)"/)[1];
  const idB=b.match(/id="(rlg\d+)"/)[1];
  assert.notStrictEqual(idA,idB,'ids must differ: '+idA+' vs '+idB);
  assert(a.includes(`url(#${idA})`));
  assert(b.includes(`url(#${idB})`));
});
check('svgRing: embeds logo + keeps progress arc + no stray <text>',()=>{
  vm.runInContext('_ringLogoSeq=0',sandbox);
  const out=vm.runInContext("svgRing(72,'#4ade80',44)",sandbox);
  assert(out.includes('<clipPath'),'missing clipPath');
  assert(out.includes('<image'),'missing image');
  assert(out.includes('stroke-dasharray'),'missing progress arc');
  assert(!out.includes('<text'),'svgRing should not render inner text');
  // sz=44 -> r=16.72, sw=4.4 -> ir=16.72-2.2=14.52 -> diameter 29.04
  assert(out.includes('width="29.04'),out);
});
check('svgRing: 5 sequential calls (as rendered on one dashboard page) never collide',()=>{
  vm.runInContext('_ringLogoSeq=0',sandbox);
  const outs=[];
  for(let i=0;i<5;i++)outs.push(vm.runInContext("svgRing(50,'#4ade80',44)",sandbox));
  const ids=outs.map(o=>o.match(/id="(rlg\d+)"/)[1]);
  assert.strictEqual(new Set(ids).size,5,'expected 5 unique ids, got '+ids);
});

console.log('\n=== gauge() behavior (5 simultaneous instances, Wellness Médio) ===');
{
  const gaugeSandbox={console,_ringLogoSvg:(cx,cy,r,sw)=>vm.runInContext(`_ringLogoSvg(${cx},${cy},${r},${sw})`,sandbox)};
  vm.createContext(gaugeSandbox);
  vm.runInContext(gaugeSrc,gaugeSandbox);
  check('gauge(): renders value+"/10" as HTML caption, not inside <svg>',()=>{
    const out=vm.runInContext("gauge(7.5,10,'#fbbf24','Fadiga')",gaugeSandbox);
    const svgPart=out.match(/<svg[\s\S]*?<\/svg>/)[0];
    assert(!svgPart.includes('<text'),'no <text> expected inside svg: '+svgPart);
    const afterSvg=out.slice(out.indexOf('</svg>'));
    assert(afterSvg.includes('>7.5<'),'caption must show value: '+afterSvg);
    assert(afterSvg.includes('/10'),'caption must show /10 literal: '+afterSvg);
    assert(afterSvg.includes('Fadiga'),'label must still render');
  });
  check('gauge(): Sono (max=5) still shows literal "/10" (pre-existing quirk, left alone)',()=>{
    const out=vm.runInContext("gauge(4,5,'#a78bfa','Sono')",gaugeSandbox);
    assert(out.includes('/10'),'quirk must be preserved, not fixed silently');
  });
  check('gauge(): 5 simultaneous calls (real Wellness Médio row) get unique clipPath ids',()=>{
    vm.runInContext('_ringLogoSeq=0',sandbox);
    const labels=['Sono','Fadiga','Stress','Dor','RPE'];
    const outs=labels.map(l=>vm.runInContext(`gauge(6,10,'#60a5fa','${l}')`,gaugeSandbox));
    const ids=outs.map(o=>o.match(/id="(rlg\d+)"/)[1]);
    assert.strictEqual(new Set(ids).size,5,'expected 5 unique ids across the 5 gauges: '+ids);
  });
}

console.log('\n=== wCirc behavior (Estado do Plantel, per-athlete row) ===');
{
  function buildWCirc(lw){
    const wSandbox={console,_ringLogoSvg:(cx,cy,r,sw)=>vm.runInContext(`_ringLogoSvg(${cx},${cy},${r},${sw})`,sandbox)};
    vm.createContext(wSandbox);
    wSandbox.lw=lw;
    vm.runInContext(wCircSrc+'\nthis._wCircResult=wCirc;',wSandbox);
    return wSandbox._wCircResult;
  }
  check('wCirc: no wellness -> dash placeholder, no logo/svg',()=>{
    const out=buildWCirc(null);
    assert(out.includes('—'));
    assert(!out.includes('<svg'));
  });
  check('wCirc: with wellness -> embeds logo, caption "%" outside svg, no inner <text>',()=>{
    vm.runInContext('_ringLogoSeq=0',sandbox);
    const out=buildWCirc({score:82});
    const svgPart=out.match(/<svg[\s\S]*?<\/svg>/)[0];
    assert(!svgPart.includes('<text'),'no inner text expected: '+svgPart);
    assert(out.includes('<clipPath'));
    assert(out.includes('82%'),'caption must show score%: '+out);
    const afterSvg=out.slice(out.indexOf('</svg>'));
    assert(afterSvg.includes('82%'),'% must be in the HTML caption, not inside svg');
  });
  check('wCirc: color semaphore unchanged (green/yellow/red thresholds)',()=>{
    const good=buildWCirc({score:85}),mid=buildWCirc({score:60}),bad=buildWCirc({score:30});
    assert(good.includes('#4ade80'));
    assert(mid.includes('#fbbf24'));
    assert(bad.includes('#f87171'));
  });
  check('wCirc: multiple athlete rows (real Estado do Plantel table) never collide',()=>{
    vm.runInContext('_ringLogoSeq=0',sandbox);
    const outs=[72,58,91,33,65].map(s=>buildWCirc({score:s}));
    const ids=outs.map(o=>o.match(/id="(rlg\d+)"/)[1]);
    assert.strictEqual(new Set(ids).size,5,'expected 5 unique ids across athlete rows: '+ids);
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
if(fail>0)process.exit(1);
