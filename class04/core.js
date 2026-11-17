// ===== SenMart core model =====
const PRODUCTS = [
  // name, price, fresh(유통기한 짧음), impulse(계산대 옆 기본 충동구매율), emoji
  ["삼각김밥",1200,1,.030,"🍙"],["컵라면",1500,0,.020,"🍜"],["단팥빵",1500,1,.030,"🍞"],["소시지",1800,0,.050,"🌭"],
  ["김밥",2000,1,.015,"🍱"],["샌드위치",2800,1,.020,"🥪"],["생수",800,0,.020,"💧"],["우유",1300,1,.020,"🥛"],
  ["이온음료",1500,0,.040,"🧃"],["탄산음료",1700,0,.050,"🥤"],["커피",1800,0,.040,"☕"],["도시락",4500,1,.010,"🍛"],
  ["젤리·과자",1500,0,.080,"🍬"],["아이스크림",1800,0,.070,"🍦"],["에너지음료",2000,0,.060,"⚡"],["샐러드",4500,1,.010,"🥗"],
  ["즉석 야식",3500,0,.020,"🌙"],["냉동식품",4000,0,.010,"🥟"],["즉석밥",1500,0,.010,"🍚"],["과일컵",3000,1,.030,"🍓"],["두부·계란",3500,1,.010,"🥚"]];
const PN = PRODUCTS.map(p=>p[0]); const PI = Object.fromEntries(PN.map((n,i)=>[n,i]));
const GROUPS = ["학원가 학생","점심 직장인","가끔 들르는 어르신","주말 장보기 1인 가구","심야 단골"];
const SLOTS = ["아침","점심","오후","저녁","심야"];
// 집단별 '장보기 목적(미션)': [확률, {상품: [포함확률, 최대수량]}]
const MISSIONS = [
 [[.34,{"컵라면":[.95,1],"삼각김밥":[.72,2],"탄산음료":[.25,1],"소시지":[.15,1]}],
  [.22,{"젤리·과자":[.85,2],"탄산음료":[.45,1],"아이스크림":[.30,1]}],
  [.16,{"에너지음료":[.92,1],"젤리·과자":[.62,1]}],
  [.16,{"이온음료":[.55,1],"탄산음료":[.45,1]}],
  [.12,{"김밥":[.9,1],"이온음료":[.3,1]}]],
 [[.36,{"도시락":[.92,1],"탄산음료":[.12,1]}],
  [.22,{"샌드위치":[.95,1],"커피":[.78,1]}],
  [.26,{"커피":[1,1]}],
  [.16,{"김밥":[.92,1],"컵라면":[.15,1]}]],
 [[.42,{"단팥빵":[.9,2],"우유":[.82,1]}],
  [.33,{"두부·계란":[.9,1],"우유":[.3,1]}],
  [.25,{"우유":[.7,1]}]],
 [[.55,{"즉석밥":[.92,3],"냉동식품":[.78,2],"두부·계란":[.35,1],"과일컵":[.2,1]}],
  [.25,{"과일컵":[.6,1],"샐러드":[.35,1],"우유":[.3,1]}],
  [.20,{"냉동식품":[.8,2],"즉석 야식":[.5,1],"탄산음료":[.4,1]}]],
 [[.34,{"즉석 야식":[.9,2],"탄산음료":[.4,1],"아이스크림":[.22,1]}],
  [.24,{"샐러드":[.9,1],"이온음료":[.76,1]}],
  [.22,{"에너지음료":[.85,1],"젤리·과자":[.62,1],"커피":[.25,1]}],
  [.20,{"커피":[.9,1]}]]];
const NOISE = .012, WATER = .3;   // 모든 영수증에 조금씩 섞이는 상품, 생수는 누구나 자주 삼
const IMP_SCALE=.5;
const IMP_AFF = [{"젤리·과자":2,"아이스크림":1.6,"에너지음료":1.6,"탄산음료":1.4},{"커피":2,"샌드위치":1.4,"소시지":1.3},
                 {"단팥빵":1.8,"우유":1.6,"두부·계란":1.4},{"과일컵":1.6,"아이스크림":1.3,"냉동식품":1.3},{"에너지음료":1.6,"아이스크림":1.5,"소시지":1.5,"젤리·과자":1.3}];

function rngFrom(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
function hash(...xs){let h=2166136261;for(const x of xs){h^=x;h=Math.imul(h,16777619);}return h>>>0;}
function poisson(r,l){const L=Math.exp(-l);let k=0,p=1;do{k++;p*=r();}while(p>L);return k-1;}
function pickW(r,arr){let u=r(),s=0;for(const a of arr){s+=a[0];if(u<s)return a;}return arr[arr.length-1];}

function basketFor(r,g){
  const q=new Array(PN.length).fill(0);
  const nm = r()<.22?2:1;
  for(let m=0;m<nm;m++){const mis=pickW(r,MISSIONS[g])[1];
    for(const [n,[p,mx]] of Object.entries(mis)) if(r()<p) q[PI[n]]+=1+Math.floor(r()*mx);}
  if(r()<WATER) q[PI["생수"]]=Math.max(q[PI["생수"]],1);
  for(let i=0;i<PN.length;i++) if(!q[i]&&r()<NOISE) q[i]=1;
  if(q.every(x=>!x)) q[PI["생수"]]=1;
  return q;
}
function slotFor(r,c){return r()<.7?c[4]:SLOTS[Math.floor(r()*5)];}
// 한 주(또는 기간)의 영수증 생성: 결정적(seed)
function genReceipts(seed,weeks,mult){
  const r=rngFrom(seed), out=[]; let id=1;
  for(const c of CUSTOMERS){const n=poisson(r,c[2]*weeks/4.3*(mult?mult[c[6]]:1));
    for(let k=0;k<n;k++){out.push({id:id++,cid:c[0],g:c[6],slot:slotFor(r,c),q:basketFor(r,c[6]),day:Math.floor(r()*7*weeks)});}}
  out.sort((a,b)=>a.day-b.day||a.id-b.id); out.forEach((x,i)=>x.id=i+1); return out;
}
function stats(recs,weeks){
  const qty=new Array(PN.length).fill(0);recs.forEach(x=>x.q.forEach((v,i)=>qty[i]+=v));
  const N=recs.length,cnt=new Array(PN.length).fill(0),co=PN.map(()=>new Array(PN.length).fill(0));
  for(const x of recs){const has=[];x.q.forEach((v,i)=>{if(v)has.push(i);});for(const i of has){cnt[i]++;for(const j of has)if(i!==j)co[i][j]++;}}
  return {N,cnt,co,qty,weeks:weeks||2};
}
const MARGIN=.30, COST=.70, K=.9;
// 진열 시뮬레이션. display={pairs:[[a,b],..], checkout:x, order:{name:qty}}, carry:{name:qty}
function simulateWeek(week,display,ST,seedBase,opt){
  // 진열 효과만 계산 (재고·발주 없음). opt={days, mult}
  opt=opt||{};
  const recs=genReceipts(hash(seedBase,week,77),(opt.days||7)/7,opt.mult);
  const P=i=>ST.cnt[i]/ST.N, C=(a,b)=>ST.co[a][b]/Math.max(1,ST.cnt[a]);
  const extra=new Array(PN.length).fill(0), base=new Array(PN.length).fill(0);
  const eff=display.pairs.map(()=>[0,0]); let coEff=0;
  for(const x of recs){x.q.forEach((v,i)=>base[i]+=v);
    const added=new Set();
    display.pairs.forEach(([a,b],k)=>{[[a,b],[b,a]].forEach(([s,t],d)=>{
      const ps=K*Math.max(0,C(s,t)-P(t));
      const u=rngFrom(hash(seedBase,week,x.id,s,t,313))(); if(x.q[s]&&!x.q[t]&&!added.has(t)&&u<ps){extra[t]++;eff[k][d]++;added.add(t);}});});
    if(display.checkout!=null){const t=display.checkout;const u=rngFrom(hash(seedBase,week,x.id,t,717))();
      const p=IMP_SCALE*PRODUCTS[t][3]*((IMP_AFF[x.g][PN[t]])||1);
      if(!x.q[t]&&!added.has(t)&&u<p){extra[t]++;coEff++;added.add(t);}}
  }
  const baseSales=base.map((v,i)=>v*PRODUCTS[i][1]);
  const extraSales=extra.map((v,i)=>v*PRODUCTS[i][1]);
  const pairRows=display.pairs.map(([a,b],k)=>{const sales=eff[k][0]*PRODUCTS[b][1]+eff[k][1]*PRODUCTS[a][1];return {a,b,ab:eff[k][0],ba:eff[k][1],sales,profit:sales*MARGIN};});
  const coRow=display.checkout!=null?{i:display.checkout,n:coEff,sales:coEff*PRODUCTS[display.checkout][1],profit:coEff*PRODUCTS[display.checkout][1]*MARGIN}:null;
  const sales=extraSales.reduce((x,y)=>x+y,0);
  return {nRec:recs.length,base,baseSales,extraSales,pairRows,coRow,sales,profit:sales*MARGIN};
}


// ===== 라운드 설정 =====
const ROUNDS=[
  {key:"practice",name:"연습 게임",pairs:1,checkout:false,week:99,days:7},
  {key:"r1",name:"1라운드",pairs:3,checkout:false,week:1,days:7},
  {key:"r2",name:"2라운드",pairs:3,checkout:true,week:1,days:7},
  {key:"r3",name:"3라운드",pairs:3,checkout:true,week:3,days:10,mult:[3,.5,1,1,1],past:{seed:20251201,days:10}}];
// 분석용 과거 영수증: 1~2라운드는 지난 2주, 3라운드는 작년 같은 시기 열흘(이벤트 손님 구성)
const PAST_BASE={seed:20261117,days:14};
const _pastCache={};
function pastFor(rd){const P=(ROUNDS[rd]&&ROUNDS[rd].past)||PAST_BASE;const k=P.seed+"_"+P.days;
  if(!_pastCache[k]){const recs=genReceipts(P.seed,P.days/7,P===PAST_BASE?null:ROUNDS[rd].mult);_pastCache[k]={recs,st:stats(recs,P.days/7),days:P.days};}return _pastCache[k];}
const PHASES=[["lobby","입장"],["practice","연습 게임"],["r1","1라운드 진열"],["r1x","1주차 결과"],["r2","2라운드 진열"],["r2x","2주차 결과"],["r3","3라운드 진열"],["r3x","최종 결과"]];
function playRound(rd,display,seed){const R=ROUNDS[rd];return simulateWeek(R.week,display,pastFor(rd).st,seed,{days:R.days,mult:R.mult});}
// 진열 코드: 상품 번호(0~20)를 A~U 한 글자로. 단짝 3쌍(6글자) + 계산대(없으면 '-')
const encD=d=>{let s="";for(let k=0;k<3;k++){const p=d.pairs[k];s+=p?String.fromCharCode(65+p[0])+String.fromCharCode(65+p[1]):"--";}return s+(d.checkout==null?"-":String.fromCharCode(65+d.checkout));};
const decD=s=>{s=String(s||"").toUpperCase().replace(/[^A-U-]/g,"");if(s.length!==7)return null;const v=c=>c==="-"?null:c.charCodeAt(0)-65;const pairs=[];
  for(let k=0;k<3;k++){const a=v(s[2*k]),b=v(s[2*k+1]);if(a!=null&&b!=null&&a!==b)pairs.push([a,b]);}return {pairs,checkout:v(s[6])};};
const EVENT3={title:"기말고사 + 연말 휴가철 열흘",lines:["학원가 학생 손님이 평소의 <b>3배</b>로 와요.","근처 회사들이 연말 휴가라 점심 직장인 손님은 <b>절반</b>이에요.","영업 기간은 일주일이 아니라 <b>열흘</b>이에요."],data:"작년 이맘때 열흘 영수증"};
