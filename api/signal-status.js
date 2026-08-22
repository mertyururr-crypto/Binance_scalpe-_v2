async function getJson(url){const r=await fetch(url);if(!r.ok)throw Error("Binance veri hatası");return r.json()}
export default async function handler(req,res){
  try{
    const symbol=String(req.query.symbol||"").toUpperCase(),interval=String(req.query.interval||"5m"),direction=String(req.query.direction||"").toUpperCase();
    const start=new Date(String(req.query.time||"")).getTime();
    const entryLow=+req.query.entryLow,entryHigh=+req.query.entryHigh,stop=+req.query.stop,tp1=+req.query.tp1,tp2=+req.query.tp2;
    if(!/^[A-Z0-9]{5,20}$/.test(symbol)||!["1m","3m","5m","15m","1h"].includes(interval)||!Number.isFinite(start))return res.status(400).json({error:"Geçersiz parametre"});
    const url=`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${Math.max(0,start-60000)}&limit=1000`;
    const k=await getJson(url);
    let entered=false,entryTime=null,outcome="GİRİŞ BEKLİYOR",outcomeTime=null,tp1Hit=false;
    for(const x of k){
      const t=+x[0],h=+x[2],l=+x[3];
      if(!entered){
        if(h>=Math.min(entryLow,entryHigh)&&l<=Math.max(entryLow,entryHigh)){entered=true;entryTime=new Date(t).toISOString();outcome="AÇIK"}else continue;
      }
      if(direction==="LONG"){
        const sl=l<=stop,one=h>=tp1,two=Number.isFinite(tp2)&&h>=tp2;
        if(sl&&one){outcome="SL";outcomeTime=new Date(t).toISOString();break}
        if(sl){outcome="SL";outcomeTime=new Date(t).toISOString();break}
        if(two){outcome="TP2";outcomeTime=new Date(t).toISOString();break}
        if(one)tp1Hit=true;
      }else{
        const sl=h>=stop,one=l<=tp1,two=Number.isFinite(tp2)&&l<=tp2;
        if(sl&&one){outcome="SL";outcomeTime=new Date(t).toISOString();break}
        if(sl){outcome="SL";outcomeTime=new Date(t).toISOString();break}
        if(two){outcome="TP2";outcomeTime=new Date(t).toISOString();break}
        if(one)tp1Hit=true;
      }
    }
    if(entered&&outcome==="AÇIK"&&tp1Hit)outcome="TP1";
    return res.status(200).json({symbol,outcome,entryTime,outcomeTime});
  }catch(e){return res.status(500).json({error:e?.message||"Takip hatası"})}
}