// Offline commands: no third-party APIs or permissions required.
import crypto from 'node:crypto';
const choices = a => a[crypto.randomInt(a.length)];
const templates = {
  نصيحة:['💡 خصص وقتًا يوميًا لتعلم مهارة جديدة.','💡 راجع أهدافك أسبوعيًا وحدد خطوة واحدة قابلة للتنفيذ.','💡 خذ استراحة قصيرة عندما يقل تركيزك.'],
  تحفيز:['🚀 التقدم الصغير المستمر يصنع فرقًا كبيرًا.','🔥 ابدأ بما تستطيع، ثم طوره مع الوقت.','🌟 لا تنتظر الظروف المثالية لتبدأ.'],
  دعاء:['🤲 اللهم يسر لنا أمورنا وبارك لنا في أوقاتنا.','🤲 اللهم ارزقنا العلم النافع والعمل الصالح.','🤲 اللهم اشرح صدورنا واهدنا لما تحب وترضى.'],
  سؤال:['❓ ما الكوكب الأقرب إلى الشمس؟ (عطارد)','❓ كم عدد أيام الأسبوع؟ (سبعة)','❓ ما عاصمة اليمن؟ (صنعاء)'],
  لغز:['🧩 ما الشيء الذي كلما أخذت منه كبر؟ الحفرة.','🧩 له أسنان ولا يعض، ما هو؟ المشط.','🧩 شيء تراه في الليل ثلاث مرات وفي النهار مرة؟ حرف اللام.'],
  مثل:['📜 الصبر مفتاح الفرج.','📜 من جد وجد ومن زرع حصد.','📜 خير الكلام ما قل ودل.'],
  تهنئة:['🎉 ألف مبروك! أتمنى لك المزيد من النجاح والتوفيق.'],
  صباح:['☀️ صباح الخير! يوم جديد مليء بالفرص الجميلة.'],
  مساء:['🌙 مساء الخير! أتمنى لك ليلة هادئة وسعيدة.'],
};
export const offlineCommandNames=Object.keys(templates).concat(['قرعة','عد_تنازلي','اختصار_نص','تاريخ_هجري','كلمة_عشوائية','اختبار_رياضيات','فاصل','تنسيق_اسم']);
export async function runOfflineCommand(command,args,send){
  if(templates[command]){await send(choices(templates[command]));return true;}
  const text=args.join(' ').trim();
  if(command==='قرعة'){const items=text.split(/[,،|]/).map(x=>x.trim()).filter(Boolean);await send(items.length>1?`🎲 نتيجة القرعة: ${choices(items)}`:'🎲 الاستخدام: .قرعة أحمد، محمد، علي');return true;}
  if(command==='عد_تنازلي'){const n=Number(args[0]);await send(Number.isInteger(n)&&n>=1&&n<=30?`⏳ ${Array.from({length:n},(_,i)=>n-i).join(' ← ')} ← 🎉`:'⏳ الاستخدام: .عد_تنازلي 10 (من 1 إلى 30)');return true;}
  if(command==='اختصار_نص'){await send(text?`✂️ ${text.length>100?text.slice(0,100)+'…':text}`:'✂️ الاستخدام: .اختصار_نص نص طويل');return true;}
  if(command==='تاريخ_هجري'){await send(`🗓️ ${new Intl.DateTimeFormat('ar-SA-u-ca-islamic',{dateStyle:'full',timeZone:'Asia/Aden'}).format(new Date())}`);return true;}
  if(command==='كلمة_عشوائية'){await send(`🔤 ${choices(['إبداع','نجاح','أمل','تعاون','معرفة','إنجاز','ابتكار','تفاؤل'])}`);return true;}
  if(command==='اختبار_رياضيات'){const a=crypto.randomInt(1,30),b=crypto.randomInt(1,30);await send(`🧮 كم يساوي ${a} + ${b} ؟\n💡 الإجابة: ${a+b}`);return true;}
  if(command==='فاصل'){await send('━━━━━━━━━━━━━━━━━━');return true;}
  if(command==='تنسيق_اسم'){await send(text?`✨ 『 ${text.slice(0,70)} 』 ✨`:'✨ الاستخدام: .تنسيق_اسم اسمك');return true;}
  return false;
}
