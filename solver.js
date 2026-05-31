/* solver.js — Algebra engine v4 with rich Spanish steps */
"use strict";

const AlgebraSolver = (() => {

  function solve(raw) {
    const input = raw.trim();
    if (!input) throw new Error('EMPTY');
    if (!input.includes('=')) return evalExpression(input);
    const parts = input.split('=');
    if (parts.length !== 2) throw new Error('INVALID');
    const lhs = parts[0].trim(), rhs = parts[1].trim();
    if (/\^2|\*\*2/.test(lhs + rhs)) return solveQuadratic(lhs, rhs, input);
    return solveLinear(lhs, rhs, input);
  }

  function evalExpression(expr) {
    try {
      const val = math.evaluate(expr);
      const d = fmt(val);
      return {
        type: 'expression', equation: expr, result: d,
        steps: [
          { title: 'Expresión original', eq: expr, note: 'Vamos a calcular el valor de esta expresión matemática aplicando el orden de operaciones.', isFinal: false },
          { title: 'Aplicar orden de operaciones', eq: expr, note: 'Seguimos PEMDAS: Paréntesis → Potencias → Multiplicación/División → Suma/Resta.', isFinal: false },
          { title: 'Resultado final', eq: `= ${d}`, note: `El valor calculado de la expresión es ${d}.`, isFinal: true }
        ],
        explanation: [
          { title: '¿Qué estamos calculando?', text: `Evaluamos "${expr}" aplicando las reglas matemáticas en el orden correcto.` },
          { title: 'Orden de operaciones', text: 'Primero paréntesis, luego potencias, después multiplicación y división (de izquierda a derecha), y finalmente suma y resta.' },
          { title: 'Resultado', text: `El valor final de la expresión es ${d}.` }
        ]
      };
    } catch(e) { throw new Error('INVALID'); }
  }

  function solveLinear(lhs, rhs, original) {
    const steps = [];
    steps.push({ title: 'Ecuación original', eq: `${lhs} = ${rhs}`, note: 'Esta es la ecuación lineal (grado 1) que vamos a resolver paso a paso.', isFinal: false });

    const vars = findVars(lhs + rhs);
    if (!vars.length) {
      const diff = math.evaluate(`(${lhs})-(${rhs})`);
      const ok = Math.abs(diff) < 1e-10;
      return {
        type: 'linear', equation: original,
        result: ok ? 'Infinitas soluciones' : 'Sin solución',
        steps: [
          { title: 'Ecuación original', eq: `${lhs} = ${rhs}`, note: 'Verificamos la ecuación.', isFinal: false },
          { title: ok ? 'Identidad' : 'Contradicción', eq: ok ? '∞ soluciones' : 'Sin solución', note: ok ? 'Siempre verdadero — infinitas soluciones.' : 'Nunca verdadero — sin solución.', isFinal: true }
        ],
        explanation: []
      };
    }

    const varName = vars[0];
    const combined = `(${lhs})-(${rhs})`;
    let solVal;
    try { solVal = math.evaluate(`solve(${combined},${varName})`); }
    catch(e) { solVal = numSolve(combined, varName); }
    if (Array.isArray(solVal)) solVal = solVal[0];
    if (solVal === null || solVal === undefined) throw new Error('NO_SOLUTION');
    const solStr = fmt(solVal);

    let slope = 1, intercept = 0;
    try {
      const s0 = {}, s1 = {};
      s0[varName] = 0; s1[varName] = 1;
      const f0 = math.evaluate(lhs, s0) - math.evaluate(rhs, s0);
      const f1 = math.evaluate(lhs, s1) - math.evaluate(rhs, s1);
      slope = f1 - f0; intercept = f0;
    } catch(e) {}

    steps.push({
      title: `Identificar la variable "${varName}"`,
      eq: `${lhs} = ${rhs}`,
      note: `La variable "${varName}" es la incógnita que queremos despejar. Nuestro objetivo es dejarla sola en un lado.`,
      isFinal: false
    });

    if (Math.abs(intercept) > 1e-10) {
      const op = intercept > 0 ? 'Restamos' : 'Sumamos';
      const val = fmt(Math.abs(intercept));
      steps.push({
        title: 'Mover términos constantes',
        eq: `${fmt(slope)}${varName} = ${fmt(-intercept)}`,
        note: `${op} ${val} en ambos lados de la ecuación. Lo que hacemos a un lado, lo hacemos al otro lado.`,
        isFinal: false
      });
    }

    if (Math.abs(slope) > 1e-10 && Math.abs(Math.abs(slope) - 1) > 1e-10) {
      steps.push({
        title: `Dividir entre el coeficiente ${fmt(slope)}`,
        eq: `${varName} = ${fmt(-intercept)} ÷ ${fmt(slope)}`,
        note: `Dividimos ambos lados entre ${fmt(slope)} para que "${varName}" quede completamente sola.`,
        isFinal: false
      });
    }

    steps.push({
      title: 'Verificación',
      eq: `${lhs.replace(new RegExp(varName, 'g'), `(${solStr})`)} = ${rhs}`,
      note: `Sustituimos ${varName} = ${solStr} en la ecuación original. Si ambos lados son iguales, ¡la solución es correcta!`,
      isFinal: false
    });

    steps.push({
      title: 'Solución final',
      eq: `${varName} = ${solStr}`,
      note: `¡Resuelto! El valor de "${varName}" que satisface la ecuación es ${solStr}.`,
      isFinal: true
    });

    return {
      type: 'linear', equation: original, result: `${varName} = ${solStr}`, steps,
      explanation: [
        { title: '¿Qué es una ecuación lineal?', text: `Una ecuación lineal tiene la variable "${varName}" con exponente 1. Al graficarla, forma una línea recta.` },
        { title: 'Estrategia: despejar la variable', text: `Usamos operaciones inversas en ambos lados: si hay suma restamos, si hay multiplicación dividimos. El objetivo es aislar "${varName}".` },
        { title: 'Principio de igualdad', text: 'Cualquier operación que hagamos a un lado de la ecuación, DEBEMOS hacerla al otro lado también para mantener el equilibrio.' },
        { title: 'Resultado', text: `${varName} = ${solStr}. Este es el único valor que hace que la ecuación sea verdadera.` }
      ]
    };
  }

  function solveQuadratic(lhs, rhs, original) {
    const steps = [];
    steps.push({ title: 'Ecuación cuadrática (grado 2)', eq: original, note: 'Identificamos que tiene la forma ax² + bx + c = 0. Usaremos la fórmula cuadrática para resolverla.', isFinal: false });

    const vars = findVars(lhs + rhs);
    const vn = vars.length ? vars[0] : 'x';
    const combined = `(${lhs})-(${rhs})`;

    let a, b, c;
    try {
      const s0={}, s1={}, sn1={};
      s0[vn]=0; s1[vn]=1; sn1[vn]=-1;
      const f0=math.evaluate(combined,s0), f1=math.evaluate(combined,s1), fn1=math.evaluate(combined,sn1);
      c=f0; b=(f1-fn1)/2; a=f1-b-c;
      if (Math.abs(a) < 1e-10) return solveLinear(lhs, rhs, original);
    } catch(e) { throw new Error('INVALID'); }

    const aS=fmt(a), bS=fmt(b), cS=fmt(c);

    steps.push({
      title: 'Forma estándar: ax² + bx + c = 0',
      eq: `${aS}${vn}² ${b>=0?'+ ':''}${bS}${vn} ${c>=0?'+ ':''}${cS} = 0`,
      note: `Identificamos los coeficientes: a = ${aS}, b = ${bS}, c = ${cS}. Los necesitamos para la fórmula.`,
      isFinal: false
    });

    const disc = b*b - 4*a*c;
    steps.push({
      title: 'Calcular el discriminante: Δ = b² − 4ac',
      eq: `Δ = (${bS})² − 4·(${aS})·(${cS}) = ${fmt(disc)}`,
      note: disc>0 ? `Δ = ${fmt(disc)} > 0: Hay DOS soluciones reales distintas.` : disc===0 ? `Δ = 0: Hay UNA solución (raíz doble).` : `Δ = ${fmt(disc)} < 0: No hay soluciones reales (raíces complejas).`,
      isFinal: false
    });

    steps.push({
      title: `Fórmula cuadrática: ${vn} = (−b ± √Δ) / 2a`,
      eq: `${vn} = (−(${bS}) ± √${fmt(disc)}) / (2·${aS})`,
      note: 'Sustituimos a, b y el discriminante en la fórmula general que siempre funciona.',
      isFinal: false
    });

    let result;
    if (disc < 0) {
      const re=-b/(2*a), im=Math.sqrt(-disc)/(2*a);
      result = `${vn}₁ = ${fmt(re)}+${fmt(im)}i,  ${vn}₂ = ${fmt(re)}−${fmt(im)}i`;
      steps.push({ title: 'Soluciones complejas', eq: result, note: 'Las raíces son números complejos (contienen la unidad imaginaria i).', isFinal: true });
    } else {
      const x1=(-b+Math.sqrt(disc))/(2*a), x2=(-b-Math.sqrt(disc))/(2*a);
      if (Math.abs(x1-x2) < 1e-10) {
        result = `${vn} = ${fmt(x1)}`;
        steps.push({ title: 'Raíz doble (solución única)', eq: result, note: `Como Δ = 0, hay exactamente una solución: ${vn} = ${fmt(x1)}.`, isFinal: true });
      } else {
        steps.push({
          title: 'Calcular las dos soluciones',
          eq: `${vn}₁ = ${fmt(x1)}     ${vn}₂ = ${fmt(x2)}`,
          note: `Con +√Δ: ${vn}₁ = ${fmt(x1)}.  Con −√Δ: ${vn}₂ = ${fmt(x2)}.`,
          isFinal: false
        });
        result = `${vn}₁ = ${fmt(x1)},  ${vn}₂ = ${fmt(x2)}`;
        steps.push({ title: 'Dos soluciones reales', eq: result, note: `Ambos valores hacen que la ecuación sea verdadera.`, isFinal: true });
      }
    }

    return {
      type: 'quadratic', equation: original, result, steps,
      explanation: [
        { title: '¿Qué es una ecuación cuadrática?', text: `Tiene la forma ax² + bx + c = 0 con a ≠ 0. Su gráfica es una parábola que puede tocar el eje x en 0, 1 o 2 puntos.` },
        { title: 'El discriminante (Δ = b² − 4ac)', text: `Δ = ${fmt(disc)}. ${disc>0?'Dos raíces reales distintas.':disc===0?'Una raíz doble.':'Sin raíces reales.'} El discriminante nos dice cuántas soluciones tiene sin resolverla.` },
        { title: 'La fórmula cuadrática', text: `x = (−b ± √Δ) / 2a. Funciona para CUALQUIER ecuación cuadrática. Con a=${aS}, b=${bS}, c=${cS}.` },
        { title: 'Interpretación geométrica', text: `Las soluciones son los puntos donde la parábola f(x) = ${aS}x² ${b>=0?'+ ':''}${bS}x ${c>=0?'+ ':''}${cS} cruza el eje horizontal (eje x).` }
      ]
    };
  }

  function findVars(expr) {
    const reserved = new Set(['e','i','pi','sin','cos','tan','log','ln','sqrt','abs','exp']);
    const found = new Set();
    (expr.match(/\b([a-z])\b/g)||[]).forEach(v=>{ if(!reserved.has(v)) found.add(v); });
    for(const p of ['x','y','z','a','b','c','n','m','s','t','u','v','w']){
      if(found.has(p)) return [p,...Array.from(found).filter(v=>v!==p)];
    }
    return Array.from(found);
  }

  function fmt(val) {
    if(typeof val==='number'){
      if(!isFinite(val)) return '∞';
      if(Math.abs(val-Math.round(val))<1e-10) return String(Math.round(val));
      const fr=toFrac(val);
      if(fr) return fr;
      return parseFloat(val.toFixed(6)).toString();
    }
    return String(val);
  }

  function toFrac(x,tol=1e-8,maxD=1000){
    if(Math.abs(x)>1e6) return null;
    let h1=1,h2=0,k1=0,k2=1,b=x;
    do{const a=Math.floor(b),ax=h1;h1=a*h1+h2;h2=ax;const ak=k1;k1=a*k1+k2;k2=ak;b=1/(b-a);}
    while(Math.abs(x-h1/k1)>x*tol&&k1<=maxD);
    if(k1>1&&k1<=maxD&&Math.abs(x-h1/k1)<tol) return `${h1}/${k1}`;
    return null;
  }

  function numSolve(expr,vn,x0=0,tol=1e-10,max=100){
    let x=x0;
    for(let i=0;i<max;i++){
      const s={},sd={};s[vn]=x;sd[vn]=x+1e-7;
      try{
        const fx=math.evaluate(expr,s),fdx=math.evaluate(expr,sd),d=(fdx-fx)/1e-7;
        if(Math.abs(d)<1e-15) break;
        const xn=x-fx/d;
        if(Math.abs(xn-x)<tol) return xn;
        x=xn;
      }catch(e){break;}
    }
    return x;
  }

  return { solve };
})();
