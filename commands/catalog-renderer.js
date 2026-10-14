// Display-only command catalog. Does not modify WhatsApp connection or message handling.
export async function sendCommandCatalog(jid,settings,m=null,{reply,LUXURY_COMMANDS}){
  const prefix=settings.prefix||'.';
  const total=LUXURY_COMMANDS.reduce((n,[,items])=>n+items.length,0);
  const emoji={
    'الأساسيات':'⚡','الحساب والملف':'👤','المجموعة':'👥','الحماية':'🛡️','الرسائل':'💬','الأدوات':'🧰','الترفيه':'🎮','الحالات':'❤️','الذكاء الاصطناعي':'🧠','النظام والقناة':'🌐','النظام المتقدم':'⚙️','النصوص المتقدمة':'📝','الحسابات المتقدمة':'🧮','العشوائيات':'🎲','الرسائل المتقدمة':'📨','المجموعة المتقدمة':'🔧','المساعدة السريعة':'❓'
  };
  await reply(jid,`╭━━〔 FLOWTECH • ${total} أمرًا 〕━━╮\n📚 أرسل رقم القسم من القائمة الرئيسية لعرضه فقط.\n📌 لعرض هذه القائمة الكاملة استخدم ${prefix}كل_الأوامر_الكاملة\n╰━━━━━━━━━━━━━━━━━━╯`,m?{quoted:m}:{});
  for(const [cat,items] of LUXURY_COMMANDS){
    const lines=items.map((x,i)=>`${emoji[cat]||'🔹'} ${i+1}. ${prefix}${x}`);
    for(let i=0;i<lines.length;i+=14){
      const part=lines.slice(i,i+14).join('\n');
      await reply(jid,`【${emoji[cat]||'🔹'} ${cat}】\n${part}`,m?{quoted:m}:{});
    }
  }
  return true;
}

