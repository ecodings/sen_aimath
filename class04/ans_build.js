// node ans_build.js  → answer.js (교사용 모범답안, 라운드별)
const fs=require('fs');eval(fs.readFileSync(__dirname+'/customers.js','utf8')+fs.readFileSync(__dirname+'/core.js','utf8')+`
const SEED=555, OUT={};
for(const rd of [0,1,2,3]){
  const ST=pastFor(rd).st, R=ROUNDS[rd];
  const val=d=>Math.round(playRound(rd,d,SEED).profit);
  const met=(a,b)=>({sup:ST.co[a][b]/ST.N,cab:ST.co[a][b]/Math.max(1,ST.cnt[a]),cba:ST.co[a][b]/Math.max(1,ST.cnt[b]),lift:ST.co[a][b]*ST.N/Math.max(1,ST.cnt[a]*ST.cnt[b]),n:ST.co[a][b]});
  const pv=[];for(let a=0;a<PN.length;a++)for(let b=a+1;b<PN.length;b++)pv.push({a,b,v:val({pairs:[[a,b]],checkout:null}),...met(a,b)});
  pv.sort((x,y)=>y.v-x.v);
  const o={pairs:pv.slice(0,10)};
  if(rd>0){
    const cv=PN.map((_,i)=>({i,v:val({pairs:[],checkout:i})})).sort((x,y)=>y.v-x.v);
    const top=pv.slice(0,12),cs=R.checkout?cv.slice(0,4):[{i:null}];let best=[];
    for(let i=0;i<12;i++)for(let j=i+1;j<12;j++)for(let k=j+1;k<12;k++)for(const c of cs){const d={pairs:[top[i],top[j],top[k]].map(p=>[p.a,p.b]),checkout:c.i};best.push({v:val(d),...d});}
    best.sort((x,y)=>y.v-x.v);
    const obv={pairs:[[PI["컵라면"],PI["삼각김밥"]],[PI["단팥빵"],PI["우유"]],[PI["커피"],PI["도시락"]]],checkout:R.checkout?PI["젤리·과자"]:null};
    o.best=best.slice(0,3);o.obvious=val(obv);if(R.checkout)o.checkout=cv.slice(0,5);
    const prev={pairs:[[PI["샌드위치"],PI["커피"]],[PI["젤리·과자"],PI["에너지음료"]],[PI["이온음료"],PI["샐러드"]]],checkout:R.checkout?PI["아이스크림"]:null};
    o.prevBest=val(prev);
    const traps=[["생수","컵라면"],["커피","도시락"],["컵라면","삼각김밥"],["즉석밥","냉동식품"]].map(([x,y])=>{const a=PI[x],b=PI[y];return {a,b,v:val({pairs:[[a,b]],checkout:null}),...met(a,b)};});
    o.traps=traps;
  }
  OUT[rd]=o;
  console.log(rd,o.best?o.best[0].v:'',o.best?o.best[0].pairs.map(p=>PN[p[0]]+'+'+PN[p[1]]).join(','):'',o.best&&o.best[0].checkout!=null?PN[o.best[0].checkout]:'','prev',o.prevBest,'obv',o.obvious);
}
fs.writeFileSync(__dirname+'/answer.js','// 자동 생성: node ans_build.js\\nconst ANSWER='+JSON.stringify(OUT)+';\\n');
`)
