import OpenAI from 'openai';

function clean(s){return String(s||'').trim().slice(0,12000);}

export async function askAI({provider, model, prompt, system, previousResponseId}){
  provider=(provider||process.env.AI_PROVIDER||'gemini').toLowerCase();
  prompt=clean(prompt); system=clean(system);
  if(!prompt) return '';
  if(provider==='openai'){
    const key=process.env.OPENAI_API_KEY;
    if(!key) throw new Error('OPENAI_API_KEY is not configured');
    const client=new OpenAI({apiKey:key});
    const response=await client.responses.create({
      model:model||process.env.OPENAI_MODEL||'gpt-5.5',
      instructions:system,
      input:prompt,
      ...(previousResponseId?{previous_response_id:previousResponseId}:{}),
      max_output_tokens:600
    });
    return {text:response.output_text||'',responseId:response.id};
  }
  if(provider==='gemini'){
    const key=process.env.GEMINI_API_KEY;
    if(!key) throw new Error('GEMINI_API_KEY is not configured');
    const mdl=model||process.env.GEMINI_MODEL||'gemini-3.8-flash';
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mdl)}:generateContent?key=${encodeURIComponent(key)}`;
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      system_instruction:{parts:[{text:system||'You are a helpful assistant.'}]},
      contents:[{role:'user',parts:[{text:prompt}]}],
      generationConfig:{temperature:.7,maxOutputTokens:600}
    })});
    const data=await r.json();
    if(!r.ok) throw new Error(data?.error?.message||`Gemini HTTP ${r.status}`);
    const text=(data.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||'').join('').trim();
    return {text,responseId:null};
  }
  throw new Error(`Unsupported AI provider: ${provider}`);
}
