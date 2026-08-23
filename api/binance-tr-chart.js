
const TR_GENERAL="https://www.binance.tr";
const TR_MAIN="https://api.binance.me";
const TR_NEXT="https://cloudme-tr.2meta.app";

async function trFetchJson(url){
  const r=await fetch(url,{headers:{"accept":"application/json","user-agent":"Mozilla/5.0"}});
  const j=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(`Binance TR HTTP ${r.status}`);
  if(j&&typeof j==="object"&&"code" in j&&Number(j.code)!==0)throw new Error(j.msg||j.message||"Binance TR veri hatası");
  return j;
}
function unwrapTr(j){
  return j&&typeof j==="object"&&"data" in j?j.data:j;
}
async function trKlines(symbol,interval,limit=320){
  const clean=String(symbol).toUpperCase().replace(/[^A-Z0-9]/g,"");
  const urls=[
    `${TR_MAIN}/api/v1/klines?symbol=${encodeURIComponent(clean)}&interval=${encodeURIComponent(interval)}&limit=${Math.min(1000,limit)}`,
    `${TR_NEXT}/api/v1/klines?symbol=${encodeURIComponent(clean)}&interval=${encodeURIComponent(interval)}&limit=${Math.min(1000,limit)}`
  ];
  let lastErr=null;
  for(const url of urls){
    try{
      const x=unwrapTr(await trFetchJson(url));
      if(Array.isArray(x)&&x.length)return x;
    }catch(e){lastErr=e}
  }
  throw lastErr||new Error("Binance TR mum verisi alınamadı");
}
async function trSymbolsRaw(){
  const raw=await trFetchJson(`${TR_GENERAL}/open/v1/common/symbols`);
  const x=unwrapTr(raw);
  const list=Array.isArray(x?.list)?x.list:Array.isArray(x)?x:[];
  if(!list.length)throw new Error("Binance TR parite cevabı boş.");
  return list;
}

function ema(v,p){
  const k=2/(p+1),o=[v[0]];
  for(let i=1;i<v.length;i++)o.push(v[i]*k+o[i-1]*(1-k));
  return o;
}
export default async function handler(req,res){
  try{
    const symbol=String(req.query.symbol||"BTCTRY").toUpperCase().replace(/[^A-Z0-9]/g,"");
    const interval=String(req.query.interval||"5m");
    const limit=Math.min(500,Math.max(220,Number(req.query.limit)||300));
    const k=await trKlines(symbol,interval,limit);
    const closed=k.slice(0,-1);
    const c=closed.map(x=>+x[4]),e20=ema(c,20),e50=ema(c,50),e200=ema(c,200);
    const candles=closed.map((x,i)=>({
      time:Math.floor(+x[0]/1000),open:+x[1],high:+x[2],low:+x[3],close:+x[4],
      ema20:e20[i],ema50:e50[i],ema200:e200[i]
    }));
    res.setHeader("Cache-Control","no-store");
    return res.status(200).json({symbol,interval,exchange:"binancetr",candles,timestamp:new Date().toISOString()});
  }catch(e){return res.status(500).json({error:e?.message||"Binance TR grafik verisi alınamadı."})}
}
