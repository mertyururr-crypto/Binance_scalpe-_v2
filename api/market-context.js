function ema(v,p){const k=2/(p+1),o=[v[0]];for(let i=1;i<v.length;i++)o.push(v[i]*k+o[i-1]*(1-k));return o}
function rsi(v,p=14){const g=[],l=[];for(let i=1;i<v.length;i++){const d=v[i]-v[i-1];g.push(Math.max(d,0));l.push(Math.max(-d,0))}let ag=g.slice(0,p).reduce((a,b)=>a+b,0)/p,al=l.slice(0,p).reduce((a,b)=>a+b,0)/p;const o=Array(v.length).fill(null);o[p]=al===0?100:100-100/(1+ag/al);for(let i=p+1;i<v.length;i++){ag=(ag*(p-1)+g[i-1])/p;al=(al*(p-1)+l[i-1])/p;o[i]=al===0?100:100-100/(1+ag/al)}return o}
async function j(url){const r=await fetch(url);if(!r.ok)throw Error(`Binance ${r.status}`);return r.json()}
function trend(k,interval){const c=k.slice(0,-1).map(x=>+x[4]);const n=c.length-1,e20=ema(c,20),e50=ema(c,50),e200=ema(c,200),rr=rsi(c);let score=50;if(e20[n]>e50[n]&&e50[n]>e200[n])score+=30;else if(e20[n]<e50[n]&&e50[n]<e200[n])score-=30;else if(c[n]>e50[n])score+=12;else score-=12;if(rr[n]>=55&&rr[n]<=72)score+=10;else if(rr[n]<=45&&rr[n]>=28)score-=10;if(c[n]>c[n-3])score+=10;else if(c[n]<c[n-3])score-=10;score=Math.max(0,Math.min(100,Math.round(score)));return {interval,score,direction:score>=65?'LONG':score<=35?'SHORT':'NEUTRAL'}}
export default async function handler(req,res){
 try{
  const symbol=String(req.query.symbol||'BTCUSDT').toUpperCase();if(!/^[A-Z0-9]{5,20}$/.test(symbol))return res.status(400).json({error:'Geçersiz sembol'});
  const b='https://fapi.binance.com';
  const [k15,k1h,premium,oi,oiHist,btcK,ethK]=await Promise.all([
   j(`${b}/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=220`),j(`${b}/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=220`),j(`${b}/fapi/v1/premiumIndex?symbol=${symbol}`),j(`${b}/fapi/v1/openInterest?symbol=${symbol}`),j(`${b}/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=12`),j(`${b}/fapi/v1/klines?symbol=BTCUSDT&interval=5m&limit=220`),j(`${b}/fapi/v1/klines?symbol=ETHUSDT&interval=5m&limit=220`)
  ]);
  const first=oiHist?.[0]?+oiHist[0].sumOpenInterestValue:null,last=oiHist?.length?+oiHist[oiHist.length-1].sumOpenInterestValue:null;const changePct=first&&last?(last-first)/first*100:0;
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  return res.status(200).json({symbol,mtf:{m15:trend(k15,'15m'),h1:trend(k1h,'1h')},funding:{rate:+premium.lastFundingRate,ratePct:+premium.lastFundingRate*100,nextFundingTime:+premium.nextFundingTime,markPrice:+premium.markPrice},openInterest:{current:+oi.openInterest,changePct},market:{btc:trend(btcK,'5m'),eth:trend(ethK,'5m')},timestamp:new Date().toISOString()});
 }catch(e){return res.status(500).json({error:e?.message||'Piyasa bağlamı hatası'})}
}