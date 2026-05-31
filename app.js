/* app.js — Calculadora de Algebra v4 */
"use strict";

(function(){

  const inp      = document.getElementById('ctaInput');
  const hist     = document.getElementById('ctaHist');
  const calcBtn  = document.getElementById('ctaCalc');
  const xBtn     = document.getElementById('ctaXBtn');
  const delBtn   = document.getElementById('ctaDel');
  const acBtn    = document.getElementById('ctaAC');
  const signBtn  = document.getElementById('ctaSign');
  const varSel   = document.getElementById('ctaVarSel');
  const trigBtn  = document.getElementById('ctaTrig');
  const hypBtn   = document.getElementById('ctaHyp');
  const toastEl  = document.getElementById('ctaToast');
  const panel    = document.getElementById('ctaStepsPanel');

  let solving=false, trigMode=false, hypMode=false, toastT=null;
  const eqHist=[];
  let histIdx=-1, curSol=null;

  const sciDef =[['x²','^2'],['√','sqrt('],['EXP','exp('],['log','log('],['ln','ln(']];
  const trigN  =[['sin','sin('],['cos','cos('],['tan','tan('],['asin','asin('],['acos','acos(']];
  const trigH  =[['sinh','sinh('],['cosh','cosh('],['tanh','tanh('],['asinh','asinh('],['acosh','acosh(']];

  /* ── bind [data-i] buttons ── */
  document.querySelectorAll('[data-i]').forEach(b=>{
    b.addEventListener('click',()=>{ ins(b.dataset.i); inp.focus(); });
  });

  /* ── variable buttons ── */
  document.querySelectorAll('.cta-vbtn').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('.cta-vbtn').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      syncSel(b.dataset.v);
      ins(b.dataset.v);
      inp.focus();
    });
  });

  /* ── example buttons ── */
  document.querySelectorAll('.cta-ex').forEach(b=>{
    b.addEventListener('click',()=>{ inp.value=b.dataset.eq; go(); });
  });

  /* ── Del / AC / X / Sign ── */
  delBtn.addEventListener('click',()=>{
    const s=inp.selectionStart,e=inp.selectionEnd;
    if(s!==e){ setv(inp.value.slice(0,s)+inp.value.slice(e)); setpos(s); }
    else if(s>0){ setv(inp.value.slice(0,s-1)+inp.value.slice(s)); setpos(s-1); }
    inp.focus();
  });
  acBtn.addEventListener('click',()=>{ inp.value=''; hist.textContent='Escribe una ecuación y presiona Calcular'; panel.style.display='none'; inp.focus(); });
  xBtn.addEventListener('click',()=>{ inp.value=''; inp.focus(); });
  signBtn.addEventListener('click',()=>{ setv(inp.value.startsWith('-')?inp.value.slice(1):'-'+inp.value); inp.focus(); });

  /* ── History nav ── */
  document.getElementById('ctaPrev').addEventListener('click',()=>{
    if(!eqHist.length) return;
    histIdx=Math.min(histIdx+1,eqHist.length-1);
    inp.value=eqHist[histIdx]; inp.focus();
  });
  document.getElementById('ctaNext').addEventListener('click',()=>{
    if(histIdx<=0){histIdx=-1;inp.value='';return;}
    histIdx--; inp.value=eqHist[histIdx]; inp.focus();
  });

  /* ── Trig / Hyp toggles ── */
  trigBtn.addEventListener('click',()=>{ trigMode=!trigMode; if(trigMode)hypMode=false; syncToggles(); updateSci(); });
  hypBtn.addEventListener('click',()=>{ hypMode=!hypMode; if(hypMode)trigMode=false; syncToggles(); updateSci(); });

  function syncToggles(){
    trigBtn.setAttribute('aria-pressed',trigMode); trigBtn.classList.toggle('on',trigMode);
    hypBtn.setAttribute('aria-pressed',hypMode);   hypBtn.classList.toggle('on',hypMode);
  }

  function updateSci(){
    const btns=document.querySelectorAll('.cta-sci');
    const set=trigMode?trigN:hypMode?trigH:null;
    if(!set){ sciDef.forEach(([l,v],i)=>{btns[i].textContent=l;btns[i].dataset.i=v;}); }
    else     { set.forEach(([l,v],i) =>{btns[i].textContent=l;btns[i].dataset.i=v;}); }
  }

  /* ── Var select sync ── */
  varSel.addEventListener('change',()=>{
    document.querySelectorAll('.cta-vbtn').forEach(b=>b.classList.toggle('on',b.dataset.v===varSel.value));
  });

  /* ── Solve ── */
  calcBtn.addEventListener('click',go);
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter') go(); });
  inp.addEventListener('input',livePreview);

  function livePreview(){
    const v=inp.value.trim();
    if(!v){ hist.textContent='Escribe una ecuación y presiona Calcular'; return; }
    if(v.includes('=')){ hist.textContent=v; return; }
    try{
      const r=math.evaluate(prep(v));
      hist.textContent=typeof r==='number'&&isFinite(r)?`≈ ${parseFloat(r.toFixed(8))}`:v;
    }catch(e){ hist.textContent=v; }
  }

  /* ══════════════════════════════════
     MAIN SOLVE
  ══════════════════════════════════ */
  function go(){
    if(solving) return;
    const eq=inp.value.trim();
    if(!eq){ toast('Escribe una ecuación primero.','err'); shake(inp); return; }
    setLoading(true);
    setTimeout(()=>{
      try{
        const sol=AlgebraSolver.solve(prep(eq));
        curSol=sol;
        eqHist.unshift(eq); if(eqHist.length>20)eqHist.pop(); histIdx=-1;
        hist.textContent=`✓  ${sol.result}`;
        renderPanel(sol);
        setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),120);
      }catch(e){
        const msgs={EMPTY:'Escribe una ecuación primero.',NO_SOLUTION:'No tiene solución real.',INVALID:'Ecuación no válida. Revisa la sintaxis.'};
        toast(msgs[e.message]||'Error al procesar la ecuación.','err');
        shake(inp);
      }finally{ setLoading(false); }
    },480);
  }

  function setLoading(on){ solving=on; calcBtn.classList.toggle('loading',on); calcBtn.disabled=on; }

  /* ══════════════════════════════════
     RENDER STEP-BY-STEP PANEL
     Better than competitor in every way
  ══════════════════════════════════ */
  function renderPanel(sol){
    let activeTab='steps';

    function build(){
      panel.innerHTML=`
        <div class="cta-sp">

          <!-- Header -->
          <div class="cta-sp-hd">
            <div class="cta-sp-title">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 4h12M2 8h8M2 12h10" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
              Solución Paso a Paso
            </div>
            <button class="cta-sp-close" id="ctaSpClose" aria-label="Cerrar">✕</button>
          </div>

          <!-- Tabs -->
          <div class="cta-sp-tabs">
            <button class="cta-sp-tab ${activeTab==='steps'?'on':''}" data-t="steps">📝 Pasos</button>
            <button class="cta-sp-tab ${activeTab==='result'?'on':''}" data-t="result">✓ Resultado</button>
            <button class="cta-sp-tab ${activeTab==='explain'?'on':''}" data-t="explain">💡 Explicación</button>
          </div>

          <!-- Equation bar -->
          <div class="cta-sp-eq-bar">
            <span class="cta-sp-eq-lbl">Ecuación:</span>
            <span class="cta-sp-eq-val">${esc(sol.equation)}</span>
          </div>

          <!-- Body -->
          <div class="cta-sp-body" id="ctaSpBody"></div>

          <!-- Answer box -->
          <div class="cta-sp-ans">
            <div>
              <div class="cta-sp-ans-lbl">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M6.5 1l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4L4 9.2l.5-3L2.2 4.1l3-.4L6.5 1z" fill="currentColor"/>
                </svg>
                Solución
              </div>
              <div class="cta-sp-ans-val">${esc(sol.result)}</div>
            </div>
            <button class="cta-sp-copy-btn" id="ctaSpCopy">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M1 9V1h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
              Copiar
            </button>
          </div>

        </div>
      `;

      /* Tab click */
      panel.querySelectorAll('.cta-sp-tab').forEach(t=>{
        t.addEventListener('click',()=>{
          activeTab=t.dataset.t;
          panel.querySelectorAll('.cta-sp-tab').forEach(x=>x.classList.remove('on'));
          t.classList.add('on');
          renderBody();
        });
      });

      /* Close */
      document.getElementById('ctaSpClose').addEventListener('click',()=>{
        panel.style.display='none';
      });

      /* Copy */
      document.getElementById('ctaSpCopy').addEventListener('click',()=>{
        navigator.clipboard.writeText(`${sol.equation} → ${sol.result}`)
          .then(()=>toast('¡Copiado al portapapeles!','ok'))
          .catch(()=>toast('No se pudo copiar.','err'));
      });

      renderBody();
    }

    function renderBody(){
      const body=document.getElementById('ctaSpBody');
      if(!body) return;
      body.innerHTML='';

      /* ── STEPS TAB ── */
      if(activeTab==='steps'){
        sol.steps.forEach((step,i)=>{
          const isFinal=!!step.isFinal;
          const isLast=i===sol.steps.length-1;
          const div=document.createElement('div');
          div.className='cta-sp-step'+(isFinal?' cta-sp-final':'');
          div.style.animationDelay=`${i*0.08}s`;
          div.innerHTML=`
            <div class="cta-sp-left">
              <div class="cta-sp-num">${i+1}</div>
              ${!isLast?'<div class="cta-sp-line"></div>':''}
            </div>
            <div class="cta-sp-content">
              <div class="cta-sp-step-title">${esc(step.title)}</div>
              <div class="cta-sp-eq-box">${esc(step.eq)}</div>
              ${step.note?`<div class="cta-sp-note">${esc(step.note)}</div>`:''}
            </div>
          `;
          body.appendChild(div);
        });

      /* ── RESULT TAB ── */
      }else if(activeTab==='result'){
        body.innerHTML=`
          <div class="cta-res-center">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:10px">Respuesta</div>
            <div class="cta-res-big">${esc(sol.result)}</div>
            <span class="cta-res-badge">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
              ${typeLabel(sol.type)}
            </span>
          </div>
        `;

      /* ── EXPLAIN TAB ── */
      }else{
        const cols=['','c2','c3','c4'];
        (sol.explanation||[]).forEach((b,i)=>{
          const div=document.createElement('div');
          div.className=`cta-exp-blk ${cols[i]||''}`;
          div.innerHTML=`<div class="cta-exp-t">${esc(b.title)}</div><p class="cta-exp-p">${esc(b.text)}</p>`;
          body.appendChild(div);
        });
      }
    }

    panel.style.display='block';
    build();
  }

  /* ── Helpers ── */
  function prep(s){
    return s.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-')
      .replace(/π/g,'pi').replace(/(\d)\s*([a-zA-Z])/g,'$1*$2')
      .replace(/([a-zA-Z])\s*\(/g,'$1*(').replace(/\)\s*\(/g,')*('). replace(/\)\s*([0-9])/g,')*$1').trim();
  }
  function ins(t){ const s=inp.selectionStart,e=inp.selectionEnd; setv(inp.value.slice(0,s)+t+inp.value.slice(e)); setpos(s+t.length); }
  function setv(v){ inp.value=v; }
  function setpos(p){ requestAnimationFrame(()=>inp.setSelectionRange(p,p)); }
  function syncSel(v){ for(let i=0;i<varSel.options.length;i++){if(varSel.options[i].value===v){varSel.selectedIndex=i;break;}} }
  function typeLabel(t){ return{linear:'Ecuación Lineal',quadratic:'Ecuación Cuadrática',expression:'Expresión'}[t]||'Álgebra'; }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function toast(msg,type=''){
    clearTimeout(toastT); toastEl.textContent=msg;
    toastEl.className=`cta-toast show ${type}`;
    toastT=setTimeout(()=>{toastEl.className='cta-toast';},3200);
  }
  function shake(el){
    el.style.animation='none'; el.offsetHeight;
    el.style.animation='ctaShake .38s ease';
    setTimeout(()=>{el.style.animation='';},400);
  }

  /* Inject keyframe */
  const st=document.createElement('style');
  st.textContent=`@keyframes ctaShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-5px)}30%{transform:translateX(5px)}45%{transform:translateX(-3px)}60%{transform:translateX(3px)}75%{transform:translateX(-2px)}90%{transform:translateX(2px)}}`;
  document.head.appendChild(st);

  inp.focus();
})();
