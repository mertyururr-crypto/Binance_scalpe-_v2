
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

export default async function handler(req,res){
  try{
    const raw=await trSymbolsRaw();
    const symbols=raw
      .filter(x=>String(x?.quoteAsset||"").toUpperCase()==="TRY")
      .map(x=>{
        const rawSymbol=String(x?.symbol||"").toUpperCase();
        const symbol=rawSymbol.replace(/_/g,"");
        return {
          symbol,
          rawSymbol,
          baseAsset:String(x?.baseAsset||"").toUpperCase(),
          quoteAsset:String(x?.quoteAsset||"TRY").toUpperCase(),
          symbolType:Number(x?.type||1),
          basePrecision:Number(x?.basePrecision??0),
          quotePrecision:Number(x?.quotePrecision??0),
          filters:Array.isArray(x?.filters)?x.filters:[]
        };
      })
      .filter(x=>x.symbol&&x.baseAsset)
      .sort((a,b)=>a.baseAsset.localeCompare(b.baseAsset));
    if(!symbols.length)throw new Error("Binance TR cevabı geldi ancak TRY paritesi bulunamadı.");
    res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({exchange:"binancetr",quoteAsset:"TRY",symbols,count:symbols.length,timestamp:new Date().toISOString()});
  }catch(e){return res.status(500).json({error:e?.message||"Binance TR parite listesi alınamadı."})}
}
