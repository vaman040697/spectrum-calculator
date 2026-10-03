/* Bounded, numeric math evaluation. User expressions are never JavaScript. */
(function (root) {
  'use strict';
  const math = typeof module !== 'undefined' && module.exports ? require('./math-ui.js') : root.SpectrumMath;
  const functions = {
    sin:Math.sin, cos:Math.cos, tan:Math.tan, sinc:x=>x===0?1:Math.sin(x)/x, asin:Math.asin, acos:Math.acos, atan:Math.atan,
    sinh:Math.sinh, cosh:Math.cosh, tanh:Math.tanh, sqrt:Math.sqrt, cbrt:Math.cbrt,
    abs:Math.abs, exp:Math.exp, ln:Math.log, log:Math.log10, log10:Math.log10,
    floor:Math.floor, ceil:Math.ceil, round:Math.round, sign:Math.sign,
    sec:x=>1/Math.cos(x), csc:x=>1/Math.sin(x), cot:x=>1/Math.tan(x),
    min:Math.min, max:Math.max, atan2:Math.atan2, pow:Math.pow
  };
  const constants = {pi:Math.PI, 'π':Math.PI, e:Math.E};
  const name = s => s.toLowerCase().replace('θ','theta');
  function parse(source) {
    return math.parse(String(source).replace(/²/g,'^2').replace(/³/g,'^3').replace(/≤/g,'<=').replace(/≥/g,'>='));
  }
  function evaluateTree(node, resolve = id => { throw new Error('Unknown variable: '+id); }) {
    if(node.type==='number') return Number(node.value);
    if(node.type==='group') return evaluateTree(node.value,resolve);
    if(node.type==='identifier') { const id=name(node.value); return Object.hasOwn(constants,id)?constants[id]:resolve(id); }
    if(node.type==='unary' && ['+','-'].includes(node.operator)) return (node.operator==='-'?-1:1)*evaluateTree(node.value,resolve);
    if(node.type==='binary') {
      const a=evaluateTree(node.left,resolve),b=evaluateTree(node.right,resolve);
      switch(node.operator){case '+':return a+b;case '-':return a-b;case '*':case 'implicit':return a*b;case '/':return a/b;case '^':return a**b;}
      throw new Error('Use an arithmetic expression, not a comparison.');
    }
    if(node.type==='function') {
      const id=name(node.name),fn=functions[id];
      if(!Object.hasOwn(functions,id)) throw new Error('Unknown function: '+node.name);
      const count=node.args.length;
      if((['min','max'].includes(id) && !count) || (!['min','max'].includes(id) && count!==(['atan2','pow'].includes(id)?2:1))) throw new Error('Check the number of arguments to '+id+'.');
      return fn(...node.args.map(n=>evaluateTree(n,resolve)));
    }
    throw new Error('Unsupported expression.');
  }
  function compile(source, args=['x']) {
    const tree=parse(source), allowed=args.map(name);
    // Validation visits every node, even expressions undefined at zero.
    evaluateTree(tree,id=> { if(!allowed.includes(id)) throw new Error('Unknown variable: '+id+'. Use '+(args.join(', ')||'numbers only')+'.'); return 1; });
    return (...values)=>evaluateTree(tree,id=>values[allowed.indexOf(id)]);
  }
  function finite(value, label='Value') {
    if(String(value).trim()==='' || !Number.isFinite(Number(value))) throw new Error(label+' must be a finite number.');
    return Number(value);
  }
  function interval(value, label='Range') {
    const parts=String(value).split(',');
    if(parts.length!==2) throw new Error(label+' needs two numbers, such as -10, 10.');
    const a=parts.map(v=>finite(v,label)),span=a[1]-a[0];
    if(span<=0 || Math.max(...a.map(Math.abs))>1e12 || span<1e-10 || span/Math.max(1,...a.map(Math.abs))<1e-12) throw new Error(label+' must increase and stay within ±10¹², with a usable span.');
    return a;
  }
  function roots(fn,min,max) {
    interval(min+','+max,'Search interval');
    const steps=1600,dx=(max-min)/steps,points=[];
    const value=x=>{try{return Number(fn(x));}catch{return NaN;}};
    for(let i=0;i<=steps;i++){const x=min+i*dx;points.push({x,y:value(x)});}
    const good=points.filter(p=>Number.isFinite(p.y));
    if(good.length===points.length && good.every(p=>p.y===0)) return {identity:true,roots:[]};
    const scale=Math.max(1e-300,...good.map(p=>Math.abs(p.y)));
    const tolerance=1e-10*scale,found=[];
    const add=x=>{const y=value(x);if(Number.isFinite(y)&&Math.abs(y)<=tolerance)found.push(x);};
    points.forEach(p=>{if(p.y===0)add(p.x);});
    for(let i=1;i<=steps;i++){
      const a=points[i-1],b=points[i];
      if(Number.isFinite(a.y)&&Number.isFinite(b.y)&&Math.sign(a.y)!==Math.sign(b.y)){
        let lo=a.x,hi=b.x,flo=a.y;
        for(let j=0;j<70;j++){const mid=lo+(hi-lo)/2,fm=value(mid);if(!Number.isFinite(fm))break;if(fm===0){lo=hi=mid;break;}if(Math.sign(fm)===Math.sign(flo)){lo=mid;flo=fm;}else hi=mid;}
        const candidate=lo+(hi-lo)/2;
        // A sign flip at a pole is not a root: require a small residual relative to its bracket.
        if(Math.abs(value(candidate))<=1e-8*Math.max(1e-300,Math.min(Math.abs(a.y),Math.abs(b.y))))add(candidate);
      }
      // Search minima of |f| to find repeated (even-multiplicity) roots as well.
      if(i<steps && Number.isFinite(b.y) && Math.abs(b.y)<Math.abs(a.y) && Math.abs(b.y)<Math.abs(points[i+1].y)){
        let lo=a.x,hi=points[i+1].x;
        for(let j=0;j<75;j++){const l=lo+(hi-lo)/3,r=hi-(hi-lo)/3;if(Math.abs(value(l))<Math.abs(value(r)))hi=r;else lo=l;}
        const candidate=(lo+hi)/2,local=Math.min(Math.abs(a.y),Math.abs(points[i+1].y));
        if(Math.abs(value(candidate))<=1e-10*Math.max(local,1e-300))add(candidate);
      }
    }
    found.sort((a,b)=>a-b);
    return {identity:false,roots:found.filter((x,i)=>!i||Math.abs(x-found[i-1])>Math.max(1e-8,(max-min)*1e-9))};
  }
  function sheetValue(ref, read, seen=[],memo=new Map()) {
    ref=ref.toUpperCase();
    if(!/^[A-F][1-6]$/.test(ref))throw new Error('#REF! Cell outside A1:F6');
    if(seen.includes(ref))throw new Error('#CYCLE! Circular reference at '+ref);
    if(memo.has(ref))return memo.get(ref);
    const raw=String(read(ref)||'').trim();
    if(!raw){memo.set(ref,0);return 0;}
    if(!raw.startsWith('=')){const value=finite(raw,ref);memo.set(ref,value);return value;}
    const next=[...seen,ref];
    function expand(n){
      if(n.type==='identifier' && /^[a-f]\d+$/i.test(n.value))return {type:'number',value:String(sheetValue(n.value,read,next,memo))};
      if(n.type==='function' && ['sum','average','min','max'].includes(name(n.name))){
        const vals=n.args.flatMap(arg=>{
          if(arg.type==='binary'&&arg.operator===':' && arg.left.type==='identifier' && arg.right.type==='identifier'){
            const a=arg.left.value.toUpperCase(),b=arg.right.value.toUpperCase();
            if(!/^[A-F][1-6]$/.test(a)||!/^[A-F][1-6]$/.test(b))throw new Error('#REF! Cell outside A1:F6');
            const vals=[];for(let col=Math.min(a.charCodeAt(0),b.charCodeAt(0));col<=Math.max(a.charCodeAt(0),b.charCodeAt(0));col++)for(let row=Math.min(+a[1],+b[1]);row<=Math.max(+a[1],+b[1]);row++)vals.push(sheetValue(String.fromCharCode(col)+row,read,next,memo));return vals;
          }
          return [evaluateTree(expand(arg))];
        });
        if(!vals.length)throw new Error('Add values or a cell range.');
        const id=name(n.name),v=id==='min'?Math.min(...vals):id==='max'?Math.max(...vals):vals.reduce((a,b)=>a+b,0)/(id==='average'?vals.length:1);
        return {type:'number',value:String(v)};
      }
      return {...n,...(n.left?{left:expand(n.left),right:expand(n.right)}:{}),...(n.value&&typeof n.value==='object'?{value:expand(n.value)}:{}),...(n.args?{args:n.args.map(expand)}:{})};
    }
    const result=evaluateTree(expand(parse(raw.slice(1))));
    if(!Number.isFinite(result))throw new Error('#NUM! Undefined result (check division and domains)');
    memo.set(ref,result);
    return result;
  }
  function dataPairs(text) {
    const lines=String(text).trim().split(/\n/).filter(line=>line.trim());
    if(lines.length<2||lines.length>5000)throw new Error('Enter 2 to 5000 x,y pairs.');
    return lines.map((line,i)=>{
      const tokens=line.includes(',')?line.split(',').map(t=>t.trim()):line.trim().split(/\s+/);
      if(tokens.length!==2||tokens.some(t=>!t.trim()))throw new Error('Line '+(i+1)+' needs exactly two numbers.');
      const [x,y]=tokens.map(t=>finite(t,'Line '+(i+1)));return {x,y};
    });
  }
  function symbolic(source, action) {
    compile(source,['x']); // Reject unknown syntax before producing any partial answer.
    const tree=parse(source),num=value=>({type:'number',value:String(value)}),id={type:'identifier',value:'x'};
    const unwrap=n=>n.type==='group'?unwrap(n.value):n;
    const val=n=>{try{const v=evaluateTree(n);return Number.isFinite(v)?v:null;}catch{return null;}};
    const bin=(operator,left,right)=>{
      const a=val(left),b=val(right);
      if(a!==null&&b!==null){const n=evaluateTree({type:'binary',operator,left,right});if(Number.isFinite(n))return num(n);}
      if(operator==='+'&&(a===0||b===0))return a===0?right:left;
      if(operator==='-'&&b===0)return left;
      if(operator==='*'&&(a===0||b===0))return num(0);
      if(operator==='*'&&(a===1||b===1))return a===1?right:left;
      if(operator==='^'&&b===0)return num(1);
      if((operator==='^'||operator==='/')&&b===1)return left;
      return {type:'binary',operator,left,right};
    };
    const fn=(name,arg)=>({type:'function',name,args:[arg]});
    function derivative(n){
      n=unwrap(n);
      if(n.type==='number'||(n.type==='identifier'&&name(n.value)!=='x'))return num(0);
      if(n.type==='identifier')return num(1);
      if(n.type==='unary')return bin('*',num(n.operator==='-'?-1:1),derivative(n.value));
      if(n.type==='binary'){
        const a=n.left,b=n.right,da=derivative(a),db=derivative(b),op=n.operator;
        if(op==='+'||op==='-')return bin(op,da,db);
        if(op==='*'||op==='implicit')return bin('+',bin('*',da,b),bin('*',a,db));
        if(op==='/')return bin('/',bin('-',bin('*',da,b),bin('*',a,db)),bin('^',b,num(2)));
        if(op==='^'&&val(b)!==null)return bin('*',bin('*',b,bin('^',a,num(val(b)-1))),da);
        if(op==='^')return bin('*',n,bin('+',bin('*',db,fn('ln',a)),bin('*',b,bin('/',da,a))));
      }
      if(n.type==='function'&&n.args.length===1){
        const a=n.args[0],d=derivative(a),f=name(n.name);
        const rules={sin:()=>fn('cos',a),cos:()=>bin('*',num(-1),fn('sin',a)),tan:()=>bin('^',fn('sec',a),num(2)),exp:()=>fn('exp',a),ln:()=>bin('/',num(1),a),log:()=>bin('/',num(1),bin('*',a,fn('ln',num(10)))),log10:()=>bin('/',num(1),bin('*',a,fn('ln',num(10)))),sqrt:()=>bin('/',num(1),bin('*',num(2),fn('sqrt',a)))};
        if(rules[f])return bin('*',rules[f](),d);
      }
      throw new Error('This derivative is not supported yet. No partial answer was returned.');
    }
    function polynomial(n){
      n=unwrap(n);
      if(n.type==='number')return [Number(n.value)];
      if(n.type==='identifier')return name(n.value)==='x'?[0,1]:[evaluateTree(n)];
      if(n.type==='unary')return polynomial(n.value).map(v=>n.operator==='-'?-v:v);
      if(n.type==='binary'){
        const a=polynomial(n.left),b=polynomial(n.right),op=n.operator;
        if(op==='+'||op==='-')return Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]||0)+(op==='-'?-1:1)*(b[i]||0));
        const multiply=(a,b)=>{if(a.length+b.length>102)throw new Error('Polynomial degree is limited to 100.');const c=Array(a.length+b.length-1).fill(0);a.forEach((v,i)=>b.forEach((w,j)=>c[i+j]+=v*w));return c;};
        if(op==='*'||op==='implicit')return multiply(a,b);
        if(op==='/'&&b.length===1&&b[0]!==0)return a.map(v=>v/b[0]);
        if(op==='^'&&b.length===1&&Number.isInteger(b[0])&&b[0]>=0&&b[0]<=100){let r=[1];for(let i=0;i<b[0];i++)r=multiply(r,a);return r;}
      }
      throw new Error('Integration supports polynomials and sums of sin(x), cos(x), exp(x), or 1/x. No partial answer was returned.');
    }
    function integral(n){
      n=unwrap(n);
      if(n.type==='binary'&&['+','-'].includes(n.operator))return bin(n.operator,integral(n.left),integral(n.right));
      if(n.type==='function'&&n.args.length===1&&unwrap(n.args[0]).type==='identifier'&&name(unwrap(n.args[0]).value)==='x'){
        if(name(n.name)==='sin')return bin('*',num(-1),fn('cos',id));
        if(name(n.name)==='cos')return fn('sin',id);
        if(name(n.name)==='exp')return fn('exp',id);
      }
      if(n.type==='binary'&&n.operator==='/'&&val(n.left)!==null&&unwrap(n.right).type==='identifier'&&name(unwrap(n.right).value)==='x')return bin('*',n.left,fn('ln',fn('abs',id)));
      const coeff=polynomial(n);return coeff.reduce((result,c,i)=>c===0?result:bin('+',result,bin('*',num(c/(i+1)),bin('^',id,num(i+1)))),num(0));
    }
    function text(n){
      n=unwrap(n);
      if(n.type==='number')return String(Number(Number(n.value).toPrecision(12)));
      if(n.type==='identifier')return n.value;
      if(n.type==='unary')return n.operator+'('+text(n.value)+')';
      if(n.type==='function')return n.name+'('+n.args.map(text).join(', ')+')';
      return '('+text(n.left)+' '+(n.operator==='implicit'?'*':n.operator)+' '+text(n.right)+')';
    }
    return text(action==='derivative'?derivative(tree):action==='integral'?integral(tree):tree)+(action==='integral'?' + C':'');
  }
  const api={parse,compile,evaluateTree,finite,interval,roots,sheetValue,dataPairs,symbolic};
  root.CalcEngine=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis==='undefined'?this:globalThis);
