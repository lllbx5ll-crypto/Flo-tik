import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState, jidNormalizedUser, isJidGroup, fetchLatestWaWebVersion, downloadMediaMessage, generateWAMessageContent, generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';
import P from 'pino';
import QRCode from 'qrcode';
import fs from 'node:fs';
import { getSettings, saveSettings } from './store.js';
import { labels, tr, normalizeLang } from './i18n.js';
import { askAI } from './ai.js';

const logger=P({level:process.env.LOG_LEVEL||'warn'});
let sock=null, qrData=null, pairingCode=null, state='disconnected', starting=false, currentAuthState=null, lastDisconnect=null, pairingReadyPromise=null, pairingReadyResolve=null, pairingInProgress=false, credsSavePromise=Promise.resolve();
const events=new Set();
const floodState=new Map();
const spamState=new Map();
const aiQueues=new Map();
export function onBotEvent(fn){events.add(fn);return()=>events.delete(fn)}
function emit(payload){for(const fn of events){try{fn(payload)}catch{}}}
export function getBotState(){return{state,qrData,pairingCode,connected:state==='connected',phone:sock?.user?.id||null,lastDisconnect}}
export function getSocket(){return sock}

const aliases={};
for(const [lang,map] of Object.entries(labels))for(const [key,word] of Object.entries(map))aliases[word.toLowerCase()]=key;
Object.assign(aliases,{
  'مساعدة':'help','اوامر':'help','أوامر':'help','أوامر_البوت':'help','اوامر_البوت':'help','commands':'help','مساعده':'help','قائمة':'menu','القائمة':'menu','بينغ':'ping','حالة':'status','المطور':'owner','مطور':'owner','معلومات':'info','معرف':'id','ايدي':'id',
  'معلومات_المجموعة':'groupinfo','معلومات-المجموعة':'groupinfo','المجموعة':'groupinfo','مشرفين':'admins','المشرفين':'admins','اعضاء':'members','الأعضاء':'members','الاعضاء':'members','منشن':'tagall','تاج':'tagall',
  'طرد':'kick','ترقية':'promote','تنزيل':'demote','اضافة':'add','إضافة':'add','ازالة':'remove','إزالة':'remove','حذف_عضو':'remove',
  'تحذير':'warn','تحذيرات':'warnings','مسح_تحذير':'clearwarn','مسح-تحذير':'clearwarn','كتم':'mute','فك_كتم':'unmute','فك-كتم':'unmute',
  'قفل':'lock','فتح':'unlock','اسم':'setname','وصف':'setdesc','رابط':'linkgroup','الرابط':'linkgroup','تغيير_الرابط':'revoke','تغيير-الرابط':'revoke',
  'حماية':'protect','الغاء_الحماية':'unprotect','إلغاء_الحماية':'unprotect','منع_الروابط':'antilink','منع-الروابط':'antilink','منع_الكلمات':'antibadword','منع-الكلمات':'antibadword','ترحيب':'welcome',
  'حالات':'statusview','مشاهدة_الحالات':'statusview','تفاعل':'statusreact','تفاعل_الحالات':'statusreact','ذكاء':'ai','ذكاء_اصطناعي':'ai','الذكاء':'ai',
  'رد':'react','رد_تلقائي':'ai','حذف_رسالة':'delete','حذف-رسالة':'delete','ايقاف':'stop','إيقاف':'stop',
  'مساعدة':'help','بوت':'menu','حي':'alive','متصل':'alive','وقت_التشغيل':'runtime','تشغيل':'start','اعادة_تشغيل':'restart','إعادة_تشغيل':'restart','ban':'kick','everyone':'tagall','grouplink':'linkgroup','groupinfo':'groupinfo','members':'members','admins':'admins','warn':'warn','warnings':'warnings','clearwarn':'clearwarn','unmute':'unmute','mute':'mute',
  'قفل_المجموعة':'lock','فتح_المجموعة':'unlock','فتح':'unlock','قفل':'lock','رابط_المجموعة':'linkgroup','تغيير_الرابط':'revoke','جروب':'groupinfo','مجموعتي':'groupinfo','معرف_المجموعة':'groupid','ايدي_المجموعة':'groupid','عنوان_المجموعة':'groupinfo','اسم_المجموعة':'setname','وصف_المجموعة':'setdesc','اضف':'add','احذف':'remove','طرد_عضو':'kick','رفع':'promote','خفض':'demote',
  'المشرفين':'admins','الادمن':'admins','الاعضاء':'members','الأعضاء':'members','منشن_الكل':'tagall','الكل':'tagall',
  'باند':'kick','حظر':'kick','طرد_عضو':'remove','ترقية_عضو':'promote','تنزيل_عضو':'demote',
  'تحذير_عضو':'warn','كتم_عضو':'mute','فك_الكتم':'unmute','الغاء_الكتم':'unmute',
  'مضاد_الروابط':'antilink','مضاد_الكلمات':'antibadword','الترحيب':'welcome','حماية_المجموعة':'protect',
  'مضاد_التكرار':'antiflood','منع_التكرار':'antiflood','مضاد_السبام':'antispam','منع_السبام':'antispam','مضاد_المنشن':'antitag','منع_المنشن':'antitag','كلمات_ممنوعة':'badwords','اضافة_كلمة':'setbadword','إضافة_كلمة':'setbadword','حذف_كلمة':'delbadword','مسح_كلمة':'delbadword','حد_التحذير':'setwarnlimit','تصفير_التحذيرات':'clearwarn','فتح_المجموعة':'unlock','قفل_المجموعة':'lock',
  'تفاعل_تلقائي':'statusreact','مشاهدة_تلقائية':'statusview','ايدي':'id','معرف_المجموعة':'groupid','كل_الأوامر':'allcommands','اوامر_المجموعة':'groupcommands','أوامر_المجموعة':'groupcommands','أوامر_الحماية':'protectioncommands',
  'نكتة':'joke','نكته':'joke','حكمة':'quote','اقتباس':'quote','حظ':'luck','نرد':'dice','عملة':'coin','اختيار':'choose','عشوائي':'random','حجر_ورق_مقص':'rps','حجر_ورق_مقص':'rps','حجر':'rps','ورق':'rps','مقص':'rps','نسبة_الحب':'love','حب':'love','8ball':'eightball','سؤال_نعم_لا':'eightball','تحدي':'challenge','هل_تعلم':'fact','معلومة':'fact','معلومات_عامة':'fact','مزاج':'mood','رقم_عشوائي':'random','قصة':'story','مدح':'compliment','ذم':'roast','اسم_عشوائي':'randomname','اسم_عشوائي':'randomname','نعم_لا':'yesno','تخمين':'guess','ترفيه':'fun','العاب':'fun','ألعاب':'fun','العاب_البوت':'fun'
});
function parseCommand(text,prefix){if(!text?.startsWith('.'))return null;const raw=text.slice(1).trim();if(!raw)return null;const [command,...args]=raw.split(/\s+/);const normalized=command.toLowerCase().replace(/^\./,'');return{command:aliases[normalized]||normalized,args,raw}}
function textOf(m){return m.message?.conversation||m.message?.extendedTextMessage?.text||m.message?.imageMessage?.caption||m.message?.videoMessage?.caption||m.message?.documentMessage?.caption||''}
function unwrapInteractiveMessage(message){
  let msg=message||{};
  for(let i=0;i<6;i++){
    const next=msg?.viewOnceMessage?.message||msg?.viewOnceMessageV2?.message||msg?.ephemeralMessage?.message||msg?.documentWithCaptionMessage?.message||msg?.editedMessage?.message;
    if(!next||next===msg)break;
    msg=next;
  }
  return msg||{};
}
function interactiveId(m){
  const msg=unwrapInteractiveMessage(m?.message);
  const candidates=[
    msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson,
    msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJsonString,
    msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJsonBytes,
    msg.interactiveResponseMessage?.nativeFlowResponseMessage?.selectedButtonId,
    msg.interactiveResponseMessage?.paramsJson,
    msg.interactiveResponseMessage?.selectedId,
    msg.interactiveResponseMessage?.buttonReply?.id,
    msg.interactiveResponseMessage?.buttonReply?.buttonId,
    msg.templateButtonReplyMessage?.selectedId,
    msg.buttonsResponseMessage?.selectedButtonId,
    msg.buttonsResponseMessage?.selectedDisplayText,
    msg.listResponseMessage?.singleSelectReply?.selectedRowId
  ];
  for(const raw of candidates){
    if(!raw)continue;
    try{
      let value=raw;
      if(typeof Buffer!=='undefined' && Buffer.isBuffer(value))value=value.toString('utf8');
      else if(value instanceof Uint8Array)value=new TextDecoder().decode(value);
      const p=typeof value==='string'?JSON.parse(value):value;
      const id=p?.id||p?.selected_row_id||p?.button_id||p?.selectedId||p?.selected_button_id||p?.buttonReply?.id||p?.display_text;
      if(id)return String(id);
    }catch{}
  }
  return '';
}
function normalizeMenuText(text){
  return String(text||'')
    .replace(/[\u200B-\u200D\uFEFF]/g,'')
    .replace(/[ًٌٍَُِّْـ]/g,'')
    .trim().toLowerCase()
    .replace(/^[.!#\s]+/,'')
    .replace(/[.!؟?،,؛;:]+$/g,'')
    .trim();
}
function isMenuTrigger(text){
  const v=normalizeMenuText(text);
  return ['اوامر','أوامر','menu','قائمة','القائمة','بوت','مساعدة','help','commands','menus'].includes(v);
}
function isStatusMessage(m){const jid=m.key?.remoteJid||'';return jid==='status@broadcast'||jid.endsWith('@broadcast')||Boolean(m.message?.statusMentionMessage)}
function statusKey(m){return `${m.key?.remoteJid||''}:${m.key?.id||''}:${m.key?.participant||m.key?.remoteJidAlt||''}`}
function participantIds(value){
  if(!value)return [];
  const out=[];
  for(const v of [value,value.id,value.jid,value.lid,value.phoneNumber]){
    if(typeof v==='string'&&v)out.push(v);
  }
  return [...new Set(out.map(v=>jidNormalizedUser(v)))];
}
function bareJid(v){return String(v||'').trim().toLowerCase().split(':')[0].split('@')[0]}
function sameJid(a,b){
  const A=participantIds(a),B=participantIds(b);
  if(A.some(x=>B.includes(x)))return true;
  const ab=new Set(A.map(bareJid)),bb=new Set(B.map(bareJid));
  for(const x of ab)for(const y of bb){
    if(x===y)return true;
    // Phone-number JIDs can be represented as PN while newer accounts/groups
    // may expose LID alongside phoneNumber. Match phone aliases when present.
    if(/^\d{7,15}$/.test(x)&&/^\d{7,15}$/.test(y)&&x===y)return true;
  }
  return false;
}
function senderCandidates(m,sender){
  return [sender,m?.key?.participant,m?.key?.participantAlt,m?.key?.remoteJidAlt].filter(Boolean);
}
function isAdmin(meta,jidOrCandidates){
  const wanted=Array.isArray(jidOrCandidates)?jidOrCandidates:[jidOrCandidates];
  return meta.participants.some(p=>['admin','superadmin'].includes(p.admin)&&wanted.some(id=>sameJid(p,id)));
}
function botIdentityCandidates(){
  const u=sock?.user||{};
  return [u.id,u.lid,u.jid,u.phoneNumber,u?.id?.split(':')[0]].filter(Boolean);
}
async function groupContext(jid){
  const meta=await sock.groupMetadata(jid);
  const me=botIdentityCandidates();
  const participant=meta.participants.find(p=>['admin','superadmin'].includes(p.admin)&&me.some(id=>sameJid(p,id)));
  const isBotAdmin=Boolean(participant);
  return{meta,isBotAdmin,botParticipant:participant};
}

function groupConfig(settings,jid){
  settings.groups=settings.groups||{};
  const saved=settings.groups[jid]||{};
  return {
    antilink:saved.antilink!==undefined?saved.antilink:Boolean(settings.antilink),
    antibadword:saved.antibadword!==undefined?saved.antibadword:Boolean(settings.antibadword),
    welcome:saved.welcome!==undefined?saved.welcome:Boolean(settings.welcome),
    antiflood:Boolean(saved.antiflood),
    antispam:Boolean(saved.antispam),
    antitag:Boolean(saved.antitag),
    warnLimit:Number(saved.warnLimit||3),
    welcomeText:String(saved.welcomeText||'👋 أهلاً بك في المجموعة! مرحبًا بك مع FlowTech.')
  };
}
function setGroupConfig(settings,jid,patch){
  settings.groups=settings.groups||{};
  settings.groups[jid]={...(settings.groups[jid]||{}),...patch};
  saveSettings(settings);
  return groupConfig(settings,jid);
}
function floodHit(jid,sender,text){
  const now=Date.now();const key=`${jid}:${sender}`;const arr=(floodState.get(key)||[]).filter(x=>now-x.time<8000);arr.push({time:now,text:String(text||'').slice(0,300)});floodState.set(key,arr);return arr.length>=5;}
function spamHit(jid,sender,text){
  const now=Date.now();const key=`${jid}:${sender}`;const normalized=String(text||'').trim().toLowerCase();if(!normalized)return false;const arr=(spamState.get(key)||[]).filter(x=>now-x.time<10000);arr.push({time:now,text:normalized});spamState.set(key,arr);return arr.filter(x=>x.text===normalized).length>=3;}
function commandError(e){
  const msg=String(e?.message||e||'').toLowerCase();
  if(/not authorized|forbidden|permission|not allowed|unauthorized|admin/i.test(msg))return '❌ واتساب رفض العملية. تأكد أن البوت مشرف وأن الحساب المستهدف ليس أعلى من البوت في الصلاحيات.';
  return `❌ تعذر تنفيذ الأمر: ${String(e?.message||e||'خطأ').slice(0,240)}`;
}
function targetFromMessage(m,args){const ctx=m.message?.extendedTextMessage?.contextInfo;const list=ctx?.mentionedJid||[];if(list[0])return jidNormalizedUser(list[0]);if(ctx?.participant)return jidNormalizedUser(ctx.participant);const num=args.find(a=>/^\d{7,15}$/.test(a.replace(/\D/g,'')));return num?`${num.replace(/\D/g,'')}@s.whatsapp.net`:null}
async function reply(jid,text,opts={}){return sock.sendMessage(jid,{text:String(text)},opts)}

function menuRows(lang){
  const ar=lang==='ar';
  return [
    {header:'👑',title:ar?'المالك والمجموعات':'Owner & Groups',description:ar?'إدارة المجموعة والأعضاء':'Group and member management',id:'cat_owner'},
    {header:'🛡️',title:ar?'الحماية والأمان':'Protection & Security',description:ar?'الروابط والكلمات والسبام':'Links, words and spam protection',id:'cat_security'},
    {header:'🧰',title:ar?'الأدوات والخدمات':'Tools & Services',description:ar?'الأوامر الأساسية':'Useful bot tools',id:'cat_tools'},
    {header:'❤️',title:ar?'الحالات والتفاعل':'Status & Reactions',description:ar?'مشاهدة الحالات والتفاعل':'Status viewing and reactions',id:'cat_status'},
    {header:'🧠',title:ar?'الذكاء الاصطناعي':'AI',description:ar?'أسئلة وردود ذكية':'Smart AI replies',id:'cat_ai'},
    {header:'🎮',title:ar?'الترفيه والألعاب':'Fun & Games',description:ar?'ألعاب وأوامر ترفيهية':'Games and entertainment',id:'cat_fun'},
    {header:'ℹ️',title:ar?'المساعدة ومعلومات البوت':'Help & Info',description:ar?'المساعدة والأوامر العامة':'Help and bot info',id:'cat_help'}
  ];
}
function menuCaption(lang,prefix){
  const ar=lang==='ar';
  return `╭━━━〔 FLOWTECH 〕━━━╮\n`+
    `${ar?'✦ قائمة البوت ✦':'✦ BOT MENU ✦'}\n`+
    `${ar?'👤 المستخدم:':'👤 User:'} @${jidNormalizedUser(sock?.user?.id||'').split('@')[0]||'FlowTech'}\n`+
    `${ar?'🕒 الوقت:':'🕒 Time:'} ${new Date().toLocaleTimeString('ar-YE')}\n`+
    `╰━━━━━━━━━━━━━━━━━━╯\n\n`+
    `${ar?'✨ اختر القسم من الأزرار أسفل هذه الرسالة.':'✨ Choose a category using the buttons below.'}`;
}
function quickButtonPayload(rows){
  return rows.map(r=>({
    name:'quick_reply',
    buttonParamsJson:JSON.stringify({display_text:r.title,id:r.id})
  }));
}
async function sendQuickButtons(jid,rows,title,quoted){
  const buttons=quickButtonPayload(rows);
  const body=title||'اختر القسم الذي تريده:';
  const candidates=[
    {interactiveMessage:{header:{title:'FlowTech',hasMediaAttachment:false},body:{text:body},footer:{text:'FlowTech • WhatsApp'},nativeFlowMessage:{buttons,messageParamsJson:''}}},
    {interactiveMessage:{body:{text:body},footer:{text:'FlowTech • WhatsApp'},nativeFlowMessage:{buttons,messageParamsJson:''}}}
  ];
  let lastError=null;
  for(const content of candidates){
    try{await sock.sendMessage(jid,content,{quoted});return true;}catch(e){lastError=e;}
  }
  try{
    const generated=generateWAMessageFromContent(jid,{viewOnceMessage:{message:{messageContextInfo:{deviceListMetadata:{},deviceListMetadataVersion:2},interactiveMessage:proto.Message.InteractiveMessage.fromObject({body:{text:body},footer:{text:'FlowTech • WhatsApp'},nativeFlowMessage:{buttons,messageParamsJson:''}})}}},{quoted});
    await sock.relayMessage(jid,generated.message,{messageId:generated.key.id});
    return true;
  }catch(e){lastError=e;}
  emit({type:'menu_button_error',message:lastError?.message||String(lastError||'تعذر إرسال الأزرار')});
  return false;
}
function menuButtonRows(lang){
  const ar=lang==='ar';
  return menuRows(lang).map(r=>({id:r.id,title:`${r.header} ${r.title}`}));
}
async function sendMenu(jid,lang,prefix,quoted){
  const ar=lang==='ar';
  const imagePath='./public/assets/flowtech-banner.png';
  const caption=`╭━〔 ${ar?'القائمة الرئيسية'} 〕━╮\n\n`+
    `${ar?'✨ اختر القسم بإرسال رقم واحد فقط:':'✨ Send one number to open a category:'}\n\n`+
    `1️⃣ 👑 ${ar?'المالك والمجموعات':'Owner & Groups'}\n`+
    `2️⃣ 🛡️ ${ar?'الحماية والأمان':'Protection & Security'}\n`+
    `3️⃣ 🧰 ${ar?'الأدوات والخدمات':'Tools & Services'}\n`+
    `4️⃣ ❤️ ${ar?'الحالات والتفاعل':'Status & Reactions'}\n`+
    `5️⃣ 🧠 ${ar?'الذكاء الاصطناعي':'Artificial Intelligence'}\n`+
    `6️⃣ 🎮 ${ar?'الترفيه والألعاب':'Fun & Games'}\n`+
    `7️⃣ ℹ️ ${ar?'المساعدة ومعلومات البوت':'Help & Bot Info'}\n\n`+
    `${ar?'📌 مثال: أرسل 6 لعرض جميع أوامر الترفيه.':'📌 Example: send 6 to view all fun commands.'}\n`+
    `╰━━━━━━━━━━━━━━╯`;

  // V26 reliability is preserved: the text menu always works even when native UI is unavailable.
  // The wide banner is sent with the menu caption so the root menu is visually clear.
  if(fs.existsSync(imagePath)){
    try{
      const buffer=fs.readFileSync(imagePath);
      await sock.sendMessage(jid,{image:buffer,caption},{quoted});
    }catch(e){
      emit({type:'menu_banner_error',message:e?.message||String(e)});
      await reply(jid,caption,{quoted}).catch(()=>{});
    }
  }else{
    await reply(jid,caption,{quoted}).catch(()=>{});
  }

  // Optional native buttons. They are only an enhancement; they never replace the numbered menu.
  try{
    const rows=menuRows(lang).map((r,i)=>({id:r.id,title:`${i+1}️⃣ ${r.title}`}));
    await sendQuickButtons(jid,rows.slice(0,3),'📋 اختر القسم:',quoted);
    await sendQuickButtons(jid,rows.slice(3,6),'🎮 المزيد:',quoted);
    await sendQuickButtons(jid,[rows[6]],'ℹ️ المساعدة:',quoted);
  }catch(e){emit({type:'menu_buttons_error',message:e?.message||String(e)});}
  return true;
}

async function handleInteractive(m,jid,settings){
  const id=m.__flowMenuId||interactiveId(m);if(!id)return false;
  const lang=settings.language;
  if(id==='menu_root'){await sendMenu(jid,lang,settings.prefix,m);return true}
  const category={
    cat_owner:[
      '👑 المالك والمجموعات',
      '📌 .معلومات_المجموعة — معلومات المجموعة',
      '🆔 .معرف_المجموعة — معرف المجموعة',
      '👮 .المشرفين — قائمة المشرفين',
      '👥 .الاعضاء — عدد الأعضاء',
      '📢 .منشن_الكل — منشن جميع الأعضاء',
      '🔗 .رابط — رابط الدعوة',
      '♻️ .تغيير_الرابط — إنشاء رابط دعوة جديد',
      '✏️ .اسم <الاسم> — تغيير اسم المجموعة',
      '📝 .وصف <الوصف> — تغيير وصف المجموعة',
      '➕ .اضافة <رقم> — إضافة عضو',
      '➖ .ازالة @عضو — إزالة عضو',
      '🚪 .طرد @عضو — طرد عضو',
      '⬆️ .ترقية @عضو — ترقية مشرف',
      '⬇️ .تنزيل @عضو — إزالة الإشراف',
      '🔒 .قفل — قفل المجموعة',
      '🔓 .فتح — فتح المجموعة'
    ],
    cat_security:[
      '🛡️ الحماية والأمان',
      '🛡️ .حماية — تفعيل حزمة الحماية',
      '🔓 .الغاء_الحماية — إيقاف حزمة الحماية',
      '🚫 .منع_الروابط تشغيل|إيقاف — مضاد الروابط',
      '🤬 .منع_الكلمات تشغيل|إيقاف — مضاد الكلمات',
      '🔁 .منع_التكرار تشغيل|إيقاف — مضاد التكرار',
      '🚨 .منع_السبام تشغيل|إيقاف — مضاد السبام',
      '🎯 .منع_المنشن تشغيل|إيقاف — منع المنشن الجماعي',
      '👋 .ترحيب تشغيل|إيقاف — الترحيب بالأعضاء',
      '➕ .اضافة_كلمة كلمة1,كلمة2 — إضافة كلمات ممنوعة',
      '➖ .حذف_كلمة كلمة — حذف كلمة ممنوعة',
      '📋 .كلمات_ممنوعة — عرض الكلمات الممنوعة',
      '⚠️ .حد_التحذير 3 — تحديد حد التحذيرات',
      '⚠️ .تحذير @عضو — إضافة تحذير',
      '📊 .تحذيرات — عرض تحذيرات العضو',
      '🧹 .مسح_تحذير @عضو — تصفير تحذيراته',
      '🔇 .كتم @عضو — كتم عضو',
      '🔊 .فك_كتم @عضو — فك الكتم',
      '🗑️ .حذف_رسالة — حذف رسالة بالرد عليها'
    ],
    cat_tools:[
      '🧰 الأدوات والخدمات',
      '🏓 .بينغ — اختبار استجابة البوت',
      '⚡ .حي — هل البوت يعمل؟',
      '📡 .حالة — حالة الاتصال والإعدادات',
      '⏱️ .وقت_التشغيل — مدة التشغيل',
      '👨‍💻 .المطور — معلومات المطور',
      '🤖 .معلومات — معلومات FlowTech',
      '🆔 .معرف — معرفك',
      '🆔 .معرف_المجموعة — معرف المجموعة',
      '⚙️ .بادئة — معرفة البادئة الحالية',
      '🌐 .لغة — لغة البوت'
    ],
    cat_status:[
      '❤️ الحالات والتفاعل',
      '👁️ .مشاهدة_الحالات تشغيل|إيقاف — مشاهدة الحالات تلقائيًا',
      '💚 .تفاعل_الحالات تشغيل|إيقاف — التفاعل التلقائي',
      '🎨 .تفاعل_الحالات ❤️ — اختيار إيموجي التفاعل',
      '💬 .رد ❤️ — التفاعل مع رسالة بالرد عليها'
    ],
    cat_ai:[
      '🧠 الذكاء الاصطناعي',
      '🧠 .ذكاء تشغيل — تشغيل AI',
      '⛔ .ذكاء إيقاف — إيقاف AI',
      '💬 .ذكاء <سؤالك> — سؤال الذكاء الاصطناعي',
      '⚙️ .ذكاء_حسابي — إعدادات AI لحسابك',
      '🔄 .ذكاء مزود gemini|openai — اختيار المزود'
    ],
    cat_fun:[
      '🎮 الترفيه والألعاب',
      '😂 .نكتة — نكتة عشوائية',
      '💡 .حكمة — حكمة عشوائية',
      '📚 .اقتباس — اقتباس قصير',
      '🍀 .حظ — نسبة حظ عشوائية',
      '🎲 .نرد — رمية نرد',
      '🪙 .عملة — صورة أو كتابة',
      '🎯 .اختيار خيار1 | خيار2 | خيار3 — اختيار عشوائي',
      '🔢 .رقم_عشوائي 1 100 — رقم عشوائي',
      '✊ .حجر_ورق_مقص حجر|ورق|مقص — لعب',
      '❤️ .نسبة_الحب @عضو — نسبة حب عشوائية',
      '🎱 .8ball سؤالك — إجابة نعم/لا عشوائية',
      '🎯 .تخمين — رقم سري عشوائي من 1 إلى 10',
      '🔥 .تحدي — تحدي عشوائي',
      '🧠 .هل_تعلم — معلومة عشوائية',
      '😊 .مزاج — مزاج عشوائي',
      '📖 .قصة — قصة قصيرة',
      '👏 .مدح — مدح عشوائي',
      '🌶️ .ذم — مزحة خفيفة',
      '🪪 .اسم_عشوائي — اسم عشوائي',
      '✅ .نعم_لا — نعم أو لا'
    ],
    cat_help:[
      'ℹ️ المساعدة ومعلومات البوت',
      '📋 .قائمة — فتح القائمة الرئيسية',
      '❓ .مساعدة — فتح القائمة الرئيسية',
      '📚 .كل_الأوامر — جميع الأوامر',
      '👑 .اوامر_المجموعة — أوامر الإدارة والمجموعات',
      '🛡️ .أوامر_الحماية — أوامر الحماية',
      '🎮 .ترفيه — أوامر الترفيه',
      '🏓 .بينغ — اختبار البوت',
      '📡 .حالة — حالة الاتصال'
    ]
  };
  if(category[id]){
    const body=`╭━〔 FLOWTECH • ${category[id][0]} 〕━╮\n\n${category[id].slice(1).join('\n')}\n\n╰━━━━━━━━━━━━━━━━━╯`;
    await reply(jid,body,{quoted:m});
    try{await sendQuickButtons(jid,[{id:'menu_root',title:'↩️ القائمة الرئيسية'}],'↩️ العودة للقائمة:',m);}catch{}
    return true;
  }
  return false;
}

async function handleMenuNumber(m,jid,text,settings){
  const value=String(text||'').trim();
  const ids=['cat_owner','cat_security','cat_tools','cat_status','cat_ai','cat_fun','cat_help'];
  if(!/^[1-7]$/.test(value))return false;
  return handleInteractive({message:{conversation:value},key:m.key,__flowMenuId:ids[Number(value)-1]},jid,settings);
}

function senderPhone(jid){
  const raw=String(jidNormalizedUser(jid)||'');
  const digits=raw.split('@')[0].replace(/\D/g,'');
  return digits.length>=7&&digits.length<=15?digits:'';
}
function normalizeIdentity(v){
  const raw=String(v||'').trim();
  if(!raw)return '';
  const base=raw.split('@')[0].split(':')[0];
  const digits=base.replace(/\D/g,'');
  return digits.length>=7&&digits.length<=15?digits:'';
}
async function resolvePhoneJid(v){
  const raw=String(v||'');
  if(!raw)return '';
  if(raw.includes('@lid')){
    try{
      const pn=await sock?.signalRepository?.lidMapping?.getPNForLID?.(jidNormalizedUser(raw));
      if(pn)return jidNormalizedUser(pn);
    }catch{}
  }
  return jidNormalizedUser(raw);
}
async function aiIdentityKeys(m,jid,sender){
  const values=[sender,m?.key?.participant,m?.key?.participantAlt,m?.key?.remoteJidAlt,jid];
  if(isJidGroup(jid)){
    try{
      const meta=await sock.groupMetadata(jid);
      for(const p of meta.participants||[]){
        if(values.some(v=>sameJid(p,v))) values.push(p.phoneNumber,p.id,p.jid,p.lid);
      }
    }catch{}
  }
  const resolved=[];
  for(const value of values){
    const pn=await resolvePhoneJid(value);
    const key=normalizeIdentity(pn)||normalizeIdentity(value);
    if(key)resolved.push(key);
  }
  return [...new Set(resolved)];
}
async function getAIUserForMessage(settings,m,jid,sender){
  settings.aiUsers=settings.aiUsers||{};
  const keys=await aiIdentityKeys(m,jid,sender);
  for(const key of keys){
    const u=settings.aiUsers[key];
    if(u)return {user:u,key,keys,source:'sender'};
  }
  // Also support the bot/account number saved in the dashboard. This is the
  // normal setup when one API key should power replies for everyone who chats
  // with the connected WhatsApp account.
  const botValues=[sock?.user?.id,sock?.user?.lid,sock?.user?.phoneNumber];
  for(const value of botValues){
    const pn=await resolvePhoneJid(value);
    const key=normalizeIdentity(pn)||normalizeIdentity(value);
    if(key&&settings.aiUsers[key])return {user:settings.aiUsers[key],key,keys,source:'bot'};
  }
  const configured=Object.entries(settings.aiUsers).filter(([,u])=>u?.apiKey&&u?.enabled);
  if(configured.length===1){
    const [key,user]=configured[0];
    return {user,key,keys,source:'single-config-fallback'};
  }
  return {user:null,key:keys[0]||'',keys,source:null};
}
function aiConfigFor(settings,jid){
  const key=senderPhone(jid);const u=settings.aiUsers?.[key];
  if(u?.enabled&&u.apiKey)return {...u,enabled:true};
  if(settings.aiEnabled){
    const apiKey=settings.aiProvider==='openai'?process.env.OPENAI_API_KEY:process.env.GEMINI_API_KEY;
    if(apiKey)return {enabled:true,provider:settings.aiProvider,model:settings.aiModel,systemPrompt:settings.aiSystemPrompt,apiKey,groupMode:settings.aiGroupMode,privateEnabled:settings.aiPrivate};
  }
  return null;
}
async function resolveAIIdentity(jid,sender){
  if(!isJidGroup(jid))return sender;
  try{
    const meta=await sock.groupMetadata(jid);
    const p=meta.participants.find(x=>sameJid(x,sender));
    return p?.phoneNumber||p?.id||p?.lid||sender;
  }catch{return sender;}
}
function mediaMessageInfo(message){
  if(!message)return null;
  if(message.imageMessage&&!message.imageMessage.viewOnce)return {type:'image',content:message.imageMessage};
  if(message.videoMessage&&!message.videoMessage.viewOnce)return {type:'video',content:message.videoMessage};
  if(message.documentMessage&&!message.documentMessage.viewOnce)return {type:'document',content:message.documentMessage};
  return null;
}
function getQuotedMessage(m){
  return m.message?.extendedTextMessage?.contextInfo?.quotedMessage||m.message?.imageMessage?.contextInfo?.quotedMessage||m.message?.videoMessage?.contextInfo?.quotedMessage||null;
}
async function saveQuotedRegularMediaToSelf(m,jid){
  const quoted=getQuotedMessage(m);
  const info=mediaMessageInfo(quoted);
  if(!info)return false;
  if(!sock?.user?.id)return false;
  try{
    const fake={key:{remoteJid:jid,id:m.message?.extendedTextMessage?.contextInfo?.stanzaId||m.key.id,fromMe:false,participant:m.key.participant},message:{[`${info.type}Message`]:info.content}};
    const buffer=await downloadMediaMessage(fake,'buffer',{}, {logger});
    const self=jidNormalizedUser(sock.user.id);
    if(info.type==='image')await sock.sendMessage(self,{image:buffer,caption:'📥 تم حفظ الصورة التي رددت عليها.'});
    else if(info.type==='video')await sock.sendMessage(self,{video:buffer,caption:'📥 تم حفظ الفيديو الذي رددت عليه.'});
    else await sock.sendMessage(self,{document:buffer,mimetype:info.content.mimetype||'application/octet-stream',fileName:info.content.fileName||'media',caption:'📥 تم حفظ الملف الذي رددت عليه.'});
    await reply(jid,'📥 تم حفظ الوسائط المرسلة بشكل عادي في رسائلك الخاصة.');
    return true;
  }catch(e){emit({type:'media_save_error',message:e?.message||String(e)});return false;}
}

async function handleCommand(m,jid,sender,text,settings){
  const parsed=parseCommand(text,settings.prefix);if(!parsed)return false;const{command,args}=parsed;const lang=settings.language;const group=isJidGroup(jid);const send=x=>reply(jid,x,{quoted:m});
  if(command==='menu'||command==='help'){await sendMenu(jid,lang,settings.prefix,m);return true}
  if(command==='ping'){await send(`🏓 ${tr(lang,'ping')}`);return true}
  if(command==='alive'){await send(`⚡ FlowTech يعمل الآن.\n📡 ${state}\n🕒 ${new Date().toLocaleTimeString('ar-YE')}`);return true}
  if(command==='runtime'){const uptime=Math.floor(process.uptime());const h=Math.floor(uptime/3600),m=Math.floor((uptime%3600)/60),sec=uptime%60;await send(`⏱️ مدة التشغيل: ${h}س ${m}د ${sec}ث`);return true}
  if(command==='start'||command==='restart'){await startBot();await send('♻️ تم طلب إعادة الاتصال.');return true}
  if(command==='status'){await send(`📡 ${tr(lang,'status')}\n${tr(lang,'prefix')}: ${settings.prefix}\n${tr(lang,'language')}: ${lang}\n👁️ Status view: ${settings.statusAutoView?'ON':'OFF'}\n❤️ Status reaction: ${settings.statusAutoReact?'ON':'OFF'}\n🧠 AI: ${settings.aiEnabled?'ON':'OFF'}`);return true}
  if(command==='owner'){await send(`👨‍💻 المطورون / Developers\n• أحمد العباسي — https://wa.me/${process.env.DEV2_PHONE||'967739020737'}\n• القميشي — https://wa.me/${process.env.CONTACT_PHONE||process.env.OWNER_PHONE||''}`);return true}
  if(command==='info'){await send(`🤖 FlowTech\n👨‍💻 المطورون / Developers: أحمد العباسي • القميشي\n🌐 ${process.env.PUBLIC_URL||'Local / private'}`);return true}
  if(command==='menu_basic'){await send(`${settings.prefix}ping\n${settings.prefix}status\n${settings.prefix}owner\n${settings.prefix}info`);return true}
  if(command==='menu_group'){await send(`${settings.prefix}kick @user\n${settings.prefix}promote @user\n${settings.prefix}demote @user\n${settings.prefix}warn @user\n${settings.prefix}tagall`);return true}
  if(command==='menu_protection'){await send(`${settings.prefix}antilink on|off\n${settings.prefix}antibadword on|off\n${settings.prefix}welcome on|off`);return true}
  if(command==='menu_status'){await send(`${settings.prefix}statusview on|off\n${settings.prefix}statusreact on|off\n${settings.prefix}statusreact ❤️|😂|🔥|😍|😮|😢|👏`);return true}
  if(command==='menu_ai'){await send(`${settings.prefix}ai on|off\n${settings.prefix}ai provider openai|gemini\n${settings.prefix}ai ask سؤالك`);return true}
  if(command==='menu_settings'){await send(`${settings.prefix}status\n${settings.prefix}prefix\n${settings.prefix}stop`);return true}
  if(command==='allcommands'){
    await send(`╭〔جميع الٲوامر 〕╮\n\n👑 المجموعة والإدارة\n${settings.prefix}معلومات_المجموعة • ${settings.prefix}معرف_المجموعة • ${settings.prefix}المشرفين • ${settings.prefix}الاعضاء • ${settings.prefix}منشن_الكل • ${settings.prefix}رابط • ${settings.prefix}تغيير_الرابط • ${settings.prefix}اسم • ${settings.prefix}وصف • ${settings.prefix}قفل • ${settings.prefix}فتح • ${settings.prefix}اضافة • ${settings.prefix}ازالة • ${settings.prefix}طرد • ${settings.prefix}ترقية • ${settings.prefix}تنزيل\n\n🛡️ الحماية\n${settings.prefix}حماية • ${settings.prefix}الغاء_الحماية • ${settings.prefix}منع_الروابط • ${settings.prefix}منع_الكلمات • ${settings.prefix}منع_التكرار • ${settings.prefix}منع_السبام • ${settings.prefix}منع_المنشن • ${settings.prefix}ترحيب • ${settings.prefix}اضافة_كلمة • ${settings.prefix}حذف_كلمة • ${settings.prefix}كلمات_ممنوعة • ${settings.prefix}حد_التحذير • ${settings.prefix}تحذير • ${settings.prefix}تحذيرات • ${settings.prefix}مسح_تحذير • ${settings.prefix}كتم • ${settings.prefix}فك_كتم • ${settings.prefix}حذف_رسالة\n\n❤️ الحالات\n${settings.prefix}مشاهدة_الحالات • ${settings.prefix}تفاعل_الحالات • ${settings.prefix}رد\n\n🧠 الذكاء\n${settings.prefix}ذكاء • ${settings.prefix}ذكاء_حسابي\n\n🤖 أساسية\n${settings.prefix}قائمة • ${settings.prefix}مساعدة • ${settings.prefix}بينغ • ${settings.prefix}حي • ${settings.prefix}حالة • ${settings.prefix}وقت_التشغيل • ${settings.prefix}المطور • ${settings.prefix}معلومات • ${settings.prefix}معرف • ${settings.prefix}تشغيل • ${settings.prefix}اعادة_تشغيل\n\n╰─────────────────╯`);
    return true;
  }
  if(command==='groupcommands'){
    await send(`╭─〔 أوامر المجموعات 〕─╮\n\n${settings.prefix}معلومات_المجموعة\n${settings.prefix}معرف_المجموعة\n${settings.prefix}المشرفين\n${settings.prefix}الاعضاء\n${settings.prefix}منشن_الكل\n${settings.prefix}رابط\n${settings.prefix}تغيير_الرابط\n${settings.prefix}اسم <الاسم>\n${settings.prefix}وصف <الوصف>\n${settings.prefix}قفل / ${settings.prefix}فتح\n${settings.prefix}اضافة <رقم>\n${settings.prefix}ازالة @عضو\n${settings.prefix}طرد @عضو\n${settings.prefix}ترقية @عضو\n${settings.prefix}تنزيل @عضو\n${settings.prefix}تحذير @عضو\n${settings.prefix}تحذيرات\n${settings.prefix}مسح_تحذير @عضو\n${settings.prefix}حد_التحذير 3\n${settings.prefix}كتم @عضو\n${settings.prefix}فك_كتم @عضو\n${settings.prefix}حماية / ${settings.prefix}الغاء_الحماية\n${settings.prefix}منع_الروابط تشغيل|إيقاف\n${settings.prefix}منع_الكلمات تشغيل|إيقاف\n${settings.prefix}منع_التكرار تشغيل|إيقاف\n${settings.prefix}منع_السبام تشغيل|إيقاف\n${settings.prefix}منع_المنشن تشغيل|إيقاف\n${settings.prefix}ترحيب تشغيل|إيقاف\n${settings.prefix}اضافة_كلمة كلمة1,كلمة2\n${settings.prefix}حذف_كلمة كلمة\n${settings.prefix}كلمات_ممنوعة\n${settings.prefix}حذف_رسالة بالرد\n\n╰────────────────────╯`);
    return true;
  }
  if(command==='protectioncommands'){await send(`🛡️ أوامر الحماية\n${settings.prefix}حماية\n${settings.prefix}الغاء_الحماية\n${settings.prefix}منع_الروابط تشغيل|إيقاف\n${settings.prefix}منع_الكلمات تشغيل|إيقاف\n${settings.prefix}منع_التكرار تشغيل|إيقاف\n${settings.prefix}منع_السبام تشغيل|إيقاف\n${settings.prefix}منع_المنشن تشغيل|إيقاف\n${settings.prefix}ترحيب تشغيل|إيقاف\n${settings.prefix}اضافة_كلمة كلمة1,كلمة2\n${settings.prefix}حذف_كلمة كلمة\n${settings.prefix}كلمات_ممنوعة\n${settings.prefix}حد_التحذير 3\n${settings.prefix}تحذير @عضو\n${settings.prefix}تحذيرات\n${settings.prefix}مسح_تحذير @عضو\n${settings.prefix}كتم @عضو\n${settings.prefix}فك_كتم @عضو`);return true}
  if(command==='groupid'){if(!group){await send(tr(lang,'groupOnly'));return true}await send(`🆔 معرف المجموعة:\n${jid}`);return true}
  if(command==='groupinfo'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);await send(`👥 ${meta.subject}\n🆔 ${jid}\n👤 الأعضاء: ${meta.participants.length}\n👮 المشرفون: ${meta.participants.filter(p=>['admin','superadmin'].includes(p.admin)).length}`);return true}
  if(command==='admins'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);const a=meta.participants.filter(p=>['admin','superadmin'].includes(p.admin));await sock.sendMessage(jid,{text:'👮 المشرفون:\n'+a.map(x=>'@'+x.id.split('@')[0]).join('\n'),mentions:a.map(x=>x.id)},{quoted:m});return true}
  if(command==='members'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);await send(`👥 عدد الأعضاء: ${meta.participants.length}`);return true}
  if(command==='linkgroup'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta,isBotAdmin}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}try{const code=await sock.groupInviteCode(jid);await send(`🔗 رابط المجموعة:\nhttps://chat.whatsapp.com/${code}`);}catch(e){await send(commandError(e));}return true}
  if(command==='revoke'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta,isBotAdmin}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}try{await sock.groupRevokeInvite(jid);await send('🔐 تم إبطال رابط الدعوة السابق وإنشاء رابط جديد.');}catch(e){await send(commandError(e));}return true}
  if(command==='setname'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta,isBotAdmin}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}const name=args.join(' ').trim();if(!name){await send(`${settings.prefix}اسم الاسم_الجديد`);return true}try{await sock.groupUpdateSubject(jid,name);await send('✅ تم تغيير اسم المجموعة.');}catch(e){await send(commandError(e));}return true}
  if(command==='setdesc'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta,isBotAdmin}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}const desc=args.join(' ').trim();if(!desc){await send(`${settings.prefix}وصف الوصف_الجديد`);return true}try{await sock.groupUpdateDescription(jid,desc);await send('✅ تم تحديث وصف المجموعة.');}catch(e){await send(commandError(e));}return true}
  if(command==='lock'||command==='unlock'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta,isBotAdmin}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}try{await sock.groupSettingUpdate(jid,command==='lock'?'announcement':'not_announcement');await send(command==='lock'?'🔒 تم قفل المجموعة للمشرفين.':'🔓 تم فتح المجموعة للأعضاء.');}catch(e){await send(commandError(e));}return true}
  if(command==='add'||command==='remove'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta,isBotAdmin}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}const target=targetFromMessage(m,args);if(!target){await send(`${settings.prefix}${command} 9677XXXXXXXX`);return true}try{await sock.groupParticipantsUpdate(jid,[target],command==='add'?'add':'remove');await send(command==='add'?'➕ تمت إضافة العضو بنجاح.':'❌ تمت إزالة العضو بنجاح.');}catch(e){await send(commandError(e));}return true}
  if(command==='promoteall'){await send('⚠️ هذا الأمر غير متاح جماعيًا حفاظًا على أمان المجموعة. استخدم الترقية لعضو محدد.');return true}
  if(command==='groupadmins'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);const a=meta.participants.filter(p=>['admin','superadmin'].includes(p.admin));await sock.sendMessage(jid,{text:'👮 المشرفون:\n'+a.map(x=>'• @'+String(x.id).split('@')[0]).join('\n'),mentions:a.map(x=>x.id)},{quoted:m});return true}
  if(command==='warnings'){const {meta}=group?await groupContext(jid):{meta:null};if(!group){await send(tr(lang,'groupOnly'));return true}const entries=Object.entries(settings.warnings||{}).filter(([k])=>k.startsWith(jid+':'));if(!entries.length){await send('✅ لا توجد تحذيرات مسجلة.');return true}await send('⚠️ التحذيرات:\n'+entries.map(([k,v])=>'@'+k.split(':').pop().split('@')[0]+' — '+v).join('\n'));return true}
  if(command==='clearwarn'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}const target=targetFromMessage(m,args);if(!target){await send(`${settings.prefix}clearwarn @user`);return true}delete settings.warnings[`${jid}:${target}`];saveSettings(settings);await send('✅ تم مسح تحذيرات العضو.');return true}
  if(command==='react'){const ctx=m.message?.extendedTextMessage?.contextInfo;const id=ctx?.stanzaId;if(!id){await send(`${settings.prefix}react ❤️ بالرد على رسالة`);return true}const emoji=(args[0]||'❤️').slice(0,8);await sock.sendMessage(jid,{react:{text:emoji,key:{remoteJid:jid,id,fromMe:false,participant:ctx.participant||sender}}});return true}
  if(command==='delete'){const ctx=m.message?.extendedTextMessage?.contextInfo;if(!ctx?.stanzaId){await send(`${settings.prefix}delete بالرد على الرسالة`);return true}const {isBotAdmin}=group?await groupContext(jid):{isBotAdmin:false};if(group&&!isBotAdmin){await send(tr(lang,'noPermission'));return true}await sock.sendMessage(jid,{delete:{remoteJid:jid,id:ctx.stanzaId,fromMe:false,participant:ctx.participant||sender}});return true}
  if(command==='mute'||command==='unmute'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta,isBotAdmin}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}const target=targetFromMessage(m,args);if(!target){await send(`${settings.prefix}${command} @user`);return true}settings.muted=settings.muted||{};const key=`${jid}:${target}`;if(command==='mute')settings.muted[key]=true;else delete settings.muted[key];saveSettings(settings);await send(command==='mute'?'🔇 تم كتم العضو. سيتم حذف رسائله تلقائيًا.':'🔊 تم إلغاء كتم العضو.');return true}
  if(command==='protect'||command==='unprotect'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}const on=command==='protect';setGroupConfig(settings,jid,{antilink:on,antibadword:on,welcome:on,antiflood:on,antispam:on,antitag:on});await send(on?'🛡️ تم تفعيل حزمة الحماية المتقدمة لهذه المجموعة.':'🛡️ تم إيقاف حزمة الحماية المتقدمة لهذه المجموعة.');return true}
  if(command==='language'){await send('🇸🇦 لغة البوت في لوحة التحكم والأوامر: العربية.\nEnglish command aliases are also supported.');return true}
  if(command==='prefix'){await send('⚙️ البادئة ثابتة: .\nمثال: .ping أو .بينغ');return true}
  if(command==='id'){await send(`🆔 المعرف: ${sender}`);return true}
  if(command==='stop'){if(!group){await send('هذا الأمر للمجموعات فقط.');return true}const {meta}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}settings.aiEnabled=false;saveSettings(settings);await send('⏹️ تم إيقاف الرد الذكي لهذه الإعدادات.');return true}
  if(command==='statusview'||command==='statusreact'){
    if(command==='statusview'){const on=['on','enable','1','تشغيل','تفعيل','نعم'].includes((args[0]||'').toLowerCase());settings.statusAutoView=on;saveSettings(settings);await send(on?'👁️ Auto status viewing enabled.':'👁️ Auto status viewing disabled.');return true}
    const first=(args[0]||'').toLowerCase();const toggles=['on','enable','1','تشغيل','تفعيل','نعم','off','disable','0','إيقاف','تعطيل','لا'];
    if(first&&!toggles.includes(first))settings.statusReaction=args.join('').trim();else settings.statusAutoReact=['on','enable','1','تشغيل','تفعيل','نعم'].includes(first);
    if(args[1]&&!toggles.includes(args[1].toLowerCase()))settings.statusReaction=args.slice(1).join('').trim();
    saveSettings(settings);await send(settings.statusAutoReact?`❤️ Auto status reaction enabled: ${settings.statusReaction}`:'❤️ Auto status reaction disabled.');return true;
  }
  if(command==='ai'){
    const identity=await getAIUserForMessage(settings,m,jid,sender);const userKey=identity.key;settings.aiUsers=settings.aiUsers||{};const currentUser=identity.user||{};
    const arg=(args[0]||'').toLowerCase();
    if(['حسابي','account','settings','إعداداتي'].includes(arg)){await send(`🧠 إعداد AI لحسابك: ${currentUser?.enabled?'مفعّل':'متوقف'}\nالمزود: ${currentUser?.provider||'غير محدد'}\nالنموذج: ${currentUser?.model||'غير محدد'}\n🔐 المفتاح: ${currentUser?.apiKey?'محفوظ':'غير محفوظ'}`);return true;}
    if(['provider','مزود','المزود'].includes(arg)){
      const provider=String(args[1]||'').toLowerCase();if(!['gemini','openai'].includes(provider)){await send('الاستخدام: .ذكاء مزود gemini أو .ذكاء مزود openai');return true;}
      if(!userKey){await send('⚠️ تعذر تحديد رقم الحساب.');return true;}
      const model=provider==='gemini'?(currentUser.model?.startsWith('gemini-')?currentUser.model:'gemini-3.8-flash'):(currentUser.model?.startsWith('gpt-')?currentUser.model:'gpt-5.5');
      settings.aiUsers[userKey]={...currentUser,provider,model};saveSettings(settings);await send(`✅ تم اختيار مزود ${provider} والنموذج ${model} لحسابك.`);return true;
    }
    if(['تشغيل','on','تفعيل'].includes(arg)){
      if(!userKey){await send('⚠️ تعذر تحديد رقم الحساب. أرسل الرسالة من حساب واتساب عادي ثم حاول مرة أخرى.');return true;}
      settings.aiUsers[userKey]={...currentUser,enabled:true};saveSettings(settings);await send('🧠 تم تشغيل الرد الذكي لحسابك.');return true;
    }
    if(['إيقاف','off','تعطيل'].includes(arg)){
      if(!userKey){await send('⚠️ تعذر تحديد رقم الحساب.');return true;}
      settings.aiUsers[userKey]={...currentUser,enabled:false};saveSettings(settings);await send('🧠 تم إيقاف الرد الذكي لحسابك.');return true;
    }
    if(['ask','سؤال'].includes(arg)||args.length){
      const prompt=(arg==='ask'||arg==='سؤال')?args.slice(1).join(' '):args.join(' ');
      const cfg=currentUser?.apiKey?{...currentUser,enabled:true}:null;
      if(!cfg?.apiKey){await send('⚠️ لا يوجد مفتاح API محفوظ لحسابك. أضف المفتاح من لوحة التحكم ثم اضغط «حفظ إعداد AI» و«اختبار المفتاح».');return true;}
      try{const out=await askAI({provider:cfg.provider,model:cfg.model,prompt,system:cfg.systemPrompt||settings.aiSystemPrompt,apiKey:cfg.apiKey});await send(`🧠 ${out.text||'لم يُرجع النموذج نصًا.'}`)}catch(e){await send(`❌ فشل الذكاء الاصطناعي: ${e.message}`)}return true;
    }
    await send(`🧠 إعداد AI لحسابك: ${currentUser?.enabled?'مفعّل':'متوقف'}\nالمزود: ${currentUser?.provider||'غير محدد'}\nالنموذج: ${currentUser?.model||'غير محدد'}\n🔐 المفتاح: ${currentUser?.apiKey?'محفوظ':'غير محفوظ'}`);return true;
  }
  if(['antilink','antibadword','welcome','antiflood','antispam','antitag'].includes(command)){
    const {meta}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}
    const raw=(args[0]||'').toLowerCase();const on=['on','enable','1','تشغيل','تفعيل','نعم'].includes(raw);setGroupConfig(settings,jid,{[command]:on});
    const names={antilink:'مضاد الروابط',antibadword:'مضاد الكلمات',welcome:'الترحيب',antiflood:'مضاد التكرار',antispam:'مضاد السبام',antitag:'مضاد المنشن'};
    await send(`${on?'✅ تم تفعيل':'⛔ تم إيقاف'} ${names[command]} لهذه المجموعة.`);return true;
  }
  if(command==='badwords'){
    if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}
    await send(settings.badwords?.length?`🚫 الكلمات الممنوعة:\n${settings.badwords.map((x,i)=>`${i+1}. ${x}`).join('\n')}`:'✅ لا توجد كلمات ممنوعة.');return true;
  }
  if(command==='setbadword'){
    if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}
    const words=args.join(' ').split(/[,،]/).map(x=>x.trim().toLowerCase()).filter(Boolean);if(!words.length){await send(`${settings.prefix}اضافة_كلمة كلمة1,كلمة2`);return true}
    settings.badwords=[...new Set([...(settings.badwords||[]),...words])].slice(0,200);saveSettings(settings);await send(`✅ تمت إضافة ${words.length} كلمة إلى قائمة المنع.`);return true;
  }
  if(command==='delbadword'){
    if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}
    const words=args.join(' ').split(/[,،]/).map(x=>x.trim().toLowerCase()).filter(Boolean);if(!words.length){await send(`${settings.prefix}حذف_كلمة كلمة`);return true}
    settings.badwords=(settings.badwords||[]).filter(x=>!words.includes(String(x).toLowerCase()));saveSettings(settings);await send('✅ تم تحديث قائمة الكلمات الممنوعة.');return true;
  }
  if(command==='setwarnlimit'){
    if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true}
    const n=Math.max(1,Math.min(10,Number(args[0]||3)));setGroupConfig(settings,jid,{warnLimit:n});await send(`⚠️ حد التحذيرات لهذه المجموعة: ${n}`);return true;
  }
  // Lightweight entertainment commands: deterministic/local, no external API required.
  const funReplies={
    joke:['😂 مرة واحد بخيل دخل مطعم، طلب قائمة الطعام وقال: عندكم قائمة مجانية؟','🤣 واحد سأل صاحبه: ليش جوالك ساكت؟ قال: لأنه مؤدب ما يقاطع أحد.','😄 مدرس سأل طالب: أين تقع لندن؟ قال: في الصفحة 45 يا أستاذ.'],
    quote:['✨ لا تؤجل خطوة صغيرة تستطيع أن تبدأ بها اليوم.','🌟 الهدوء أحيانًا أقوى من ألف كلمة.','💫 كل بداية بسيطة قد تقود إلى شيء كبير.'],
    fact:['🧠 هل تعلم؟ الأخطبوط لديه ثلاثة قلوب.','🧠 هل تعلم؟ العسل يمكن أن يبقى صالحًا لفترات طويلة جدًا عند حفظه جيدًا.','🧠 هل تعلم؟ الضوء من الشمس يحتاج نحو 8 دقائق و20 ثانية ليصل إلى الأرض.'],
    challenge:['🔥 تحديك: اكتب أول كلمة تخطر في بالك الآن بدون تفكير.','🎯 تحديك: أرسل رسالة من كلمة واحدة تصف مزاجك.','⚡ تحديك: اذكر 3 أشياء تحبها خلال 10 ثوانٍ.'],
    mood:['😊 مزاجك اليوم: هادئ ومميز.','😎 مزاجك اليوم: طاقة عالية.','🤩 مزاجك اليوم: وقت ممتاز للإنجاز.','😂 مزاجك اليوم: تحتاج نكتة!'],
    story:['📖 كان هناك شخص بدأ بخطوة صغيرة كل يوم، وبعد مدة اكتشف أن خطواته الصغيرة صنعت طريقًا كاملًا.','📖 في قرية هادئة، كان كل شخص ينتظر الفرصة، حتى قرر أحدهم أن يصنع فرصته بنفسه.'],
    compliment:['👏 أنت شخص يستحق التقدير، استمر ولا تقلل من قيمة خطواتك.','🌟 حضورك جميل وكلامك له أثر طيب.','💙 لديك أسلوب مميز، حافظ عليه.'],
    roast:['🌶️ مزحة خفيفة: أنت لا تتأخر… أنت تعطي الوقت فرصة ينتظرك. 😂','🌶️ يبدو أن الحماس عندك يحتاج زر تشغيل. 😂'],
    randomname:['ريان','آدم','ليان','سيف','تالا','يزن','جود','زين'],
    yesno:['✅ نعم.','❌ لا.','🤔 غالبًا نعم.','😅 ليس الآن.']
  };
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  if(command==='joke'||command==='quote'||command==='fact'||command==='challenge'||command==='mood'||command==='story'||command==='compliment'||command==='roast'||command==='randomname'||command==='yesno'){
    await send(pick(funReplies[command]));return true;
  }
  if(command==='luck'){await send(`🍀 نسبة حظك اليوم: ${Math.floor(Math.random()*101)}%`);return true;}
  if(command==='dice'){const n=Math.floor(Math.random()*6)+1;await send(`🎲 النرد: ${n}`);return true;}
  if(command==='coin'){await send(Math.random()<0.5?'🪙 النتيجة: كتابة':'🪙 النتيجة: صورة');return true;}
  if(command==='choose'){
    const options=args.join(' ').split(/[|،,]/).map(x=>x.trim()).filter(Boolean);
    if(options.length<2){await send(`🎯 الاستخدام: ${settings.prefix}اختيار بيتزا | برجر | شاورما`);return true;}
    await send(`🎯 الاختيار: ${pick(options)}`);return true;
  }
  if(command==='random'){
    const min=Number(args[0]||1),max=Number(args[1]||100);if(!Number.isFinite(min)||!Number.isFinite(max)||min>max){await send(`🔢 الاستخدام: ${settings.prefix}رقم_عشوائي 1 100`);return true;}await send(`🔢 الرقم العشوائي: ${Math.floor(Math.random()*(max-min+1))+min}`);return true;
  }
  if(command==='rps'){
    const choices=['حجر','ورق','مقص'];const user=(args[0]||pick(choices)).toLowerCase();const map={rock:'حجر',paper:'ورق',scissors:'مقص'};const u=map[user]||user;if(!choices.includes(u)){await send(`✊ الاستخدام: ${settings.prefix}حجر_ورق_مقص حجر|ورق|مقص`);return true;}const b=pick(choices);const win=(u==='حجر'&&b==='مقص')||(u==='ورق'&&b==='حجر')||(u==='مقص'&&b==='ورق');const result=u===b?'تعادل 🤝':win?'فوزك 🎉':'فوز البوت 🤖';await send(`✊ أنت: ${u}\n🤖 البوت: ${b}\n🏆 ${result}`);return true;
  }
  if(command==='love'){
    const n=Math.floor(Math.random()*101);const target=args.join(' ')||'الشخص المختار';await send(`❤️ نسبة التوافق بينك وبين ${target}: ${n}%`);return true;
  }
  if(command==='eightball'){
    const answers=['🎱 نعم بالتأكيد.','🎱 نعم، غالبًا.','🎱 لا.','🎱 الاحتمال ضعيف.','🎱 اسألني لاحقًا.','🎱 لا يمكن الجزم.'];if(!args.length){await send(`🎱 الاستخدام: ${settings.prefix}8ball هل سأربح؟`);return true;}await send(pick(answers));return true;
  }
  if(command==='guess'){
    const n=Math.floor(Math.random()*10)+1;await send(`🎯 رقم سري من 1 إلى 10: ${n}\nحاول تخمينه في رسالتك التالية باستخدام ${settings.prefix}تخمين 5.`);return true;
  }
  if(command==='prefix'){
    await send('⚙️ البادئة الحالية: .');return true;
  }
  if(command==='fun'||command==='entertainment'){
    await handleInteractive({key:m.key,__flowMenuId:'cat_fun'},jid,settings);return true;
  }
  const {meta,isBotAdmin}=await groupContext(jid);const admin=isAdmin(meta,senderCandidates(m,sender));
  if(['kick','promote','demote','warn','tagall'].includes(command)&&!admin){await send(tr(lang,'adminOnly'));return true}
  if(['kick','promote','demote'].includes(command)&&!isBotAdmin){await send(tr(lang,'noPermission'));return true}
  if(command==='kick'||command==='promote'||command==='demote'||command==='warn'){
    const target=targetFromMessage(m,args);if(!target){await send(tr(lang,'userMissing'));return true}
    try{
      if(command==='kick')await sock.groupParticipantsUpdate(jid,[target],'remove');
      if(command==='promote')await sock.groupParticipantsUpdate(jid,[target],'promote');
      if(command==='demote')await sock.groupParticipantsUpdate(jid,[target],'demote');
    }catch(e){await send(commandError(e));return true;}
    if(command==='warn'){const key=`${jid}:${target}`;settings.warnings[key]=(settings.warnings[key]||0)+1;const count=settings.warnings[key];const limit=groupConfig(settings,jid).warnLimit;saveSettings(settings);if(count>=limit&&isBotAdmin){await sock.groupParticipantsUpdate(jid,[target],'remove').catch(()=>{});delete settings.warnings[key];saveSettings(settings);await send(`🚫 تم بلوغ ${limit} تحذيرات، وتمت إزالة العضو.`)}else await send(`⚠️ ${tr(lang,'warned')} ${count}/${limit}`);return true}
    await send(tr(lang,command==='kick'?'kicked':command==='promote'?'promoted':'demoted'));return true;
  }
  if(command==='tagall'){const mentions=meta.participants.map(p=>p.id);const body=mentions.map(j=>`@${j.split('@')[0]}`).join(' ');await sock.sendMessage(jid,{text:`📢 ${tr(lang,'tagall')}\n${body}`,mentions},{quoted:m});return true}
  await send(tr(lang,'unknown'));return true;
}

async function reactToStatus(m,reaction){
  const base={...m.key};
  // WhatsApp status reactions are sent to status@broadcast with the original
  // status key and the author's JID in statusJidList. This is important for
  // both normal phone-number addressing and newer LID accounts.
  const sender=base.participant || base.participantAlt || base.remoteJidAlt || m.participant || null;
  const keys=[base];
  if(base.participantAlt&&base.participantAlt!==base.participant)keys.push({...base,participant:base.participantAlt});
  if(base.remoteJidAlt&&base.remoteJidAlt!==base.remoteJid)keys.push({...base,remoteJid:base.remoteJidAlt});
  let lastError=null;
  for(const key of keys){
    try{
      const options=sender?{statusJidList:[sender]}:{};
      await sock.sendMessage('status@broadcast',{react:{text:reaction,key}},options);
      return {ok:true,jid:'status@broadcast'};
    }catch(e){lastError=e;}
  }
  return {ok:false,error:lastError};
}
async function handleStatus(m){
  const settings=getSettings();if(!isStatusMessage(m))return false;
  const key=statusKey(m);const seen=new Set(settings.seenStatuses||[]);if(seen.has(key))return true;
  if(settings.statusAutoView){try{await sock.readMessages([m.key])}catch(e){emit({type:'status_error',message:`view: ${e.message}`})}}
  if(settings.statusAutoReact){
    const reaction=String(settings.statusReaction||'💚').trim().slice(0,8);
    const result=await reactToStatus(m,reaction);
    if(result.ok)emit({type:'status_reaction',reaction,key});
    else emit({type:'status_reaction_unavailable',reaction,key,message:result.error?.message||'WhatsApp rejected the status reaction'});
  }
  seen.add(key);settings.seenStatuses=[...seen].slice(-500);saveSettings(settings);emit({type:'status_seen',key,reaction:settings.statusAutoReact?settings.statusReaction:null});return true;
}

async function runAIQueued(queueKey,task){
  const previous=aiQueues.get(queueKey)||Promise.resolve();
  let release;
  const current=new Promise(resolve=>{release=resolve});
  aiQueues.set(queueKey,current);
  await previous.catch(()=>{});
  try{return await task();}
  finally{
    release();
    if(aiQueues.get(queueKey)===current)aiQueues.delete(queueKey);
  }
}

async function maybeAI(m,jid,sender,text,settings){
  if(!text||text.startsWith(settings.prefix)||isStatusMessage(m))return false;
  const identity=await getAIUserForMessage(settings,m,jid,sender);
  const user=identity.user;
  const cfg=user?.enabled&&user?.apiKey?{...user,enabled:true}:null;
  if(!cfg)return false;
  const group=isJidGroup(jid);
  const botIds=[sock?.user?.id,sock?.user?.lid].filter(Boolean);
  if(group&&cfg.groupMode==='mention'){
    const mentioned=m.message?.extendedTextMessage?.contextInfo?.mentionedJid||[];
    const mentionedBot=mentioned.some(x=>botIds.some(b=>sameJid(x,b)));
    const botNums=await Promise.all(botIds.map(resolvePhoneJid));
    const textMention=botNums.some(b=>{const n=normalizeIdentity(b);return n&&text.includes('@'+n)});
    if(!mentionedBot&&!textMention)return false;
  }
  if(!group&&cfg.privateEnabled===false)return false;
  const prompt=text.replace(/@\d+/g,'').trim();
  if(!prompt)return false;
  // لا ننتظر رسالة AI سابقة في نفس المحادثة؛ كل رسالة تحصل على طلبها فورًا.
  try{
      if(cfg.recordingPresence)await sock.sendPresenceUpdate('recording',jid).catch(()=>{});
      else if(cfg.typingPresence!==false)await sock.sendPresenceUpdate('composing',jid).catch(()=>{});
      const sessionKey=`${identity.key||senderPhone(sender)}:${jid}`;
      const prev=settings.aiSessions?.[sessionKey]||null;
      const out=await Promise.race([
        askAI({provider:cfg.provider,model:cfg.model,prompt,system:cfg.systemPrompt||settings.aiSystemPrompt,apiKey:cfg.apiKey,previousResponseId:prev}),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('انتهت مهلة الذكاء الاصطناعي.')),22000))
      ]);
      await sock.sendPresenceUpdate('paused',jid).catch(()=>{});
      const answer=String(out?.text||'').trim();
      if(answer)await reply(jid,`🧠 ${answer}`,{quoted:m});
      else await reply(jid,'🧠 تم الاتصال بالذكاء الاصطناعي لكن لم يُرجع نصًا. جرّب مرة أخرى.',{quoted:m});
      if(out?.responseId){settings.aiSessions=settings.aiSessions||{};settings.aiSessions[sessionKey]=out.responseId;saveSettings(settings);}
      return true;
    }catch(e){
      await sock.sendPresenceUpdate('paused',jid).catch(()=>{});
      const msg=String(e?.message||e||'خطأ في الذكاء الاصطناعي');
      emit({type:'ai_error',message:`${identity.key||senderPhone(sender)}: ${msg}`});
      await reply(jid,`❌ تعذر الرد من الذكاء الاصطناعي الآن.\n${msg.slice(0,500)}`,{quoted:m}).catch(()=>{});
      return true;
    }
}

export async function startBot(){
  if(starting || (sock && (state==='connected'||state==='connecting'))) return sock;
  starting=true; state='connecting'; pairingCode=null; qrData=null; lastDisconnect=null; pairingReadyPromise=new Promise(resolve=>{pairingReadyResolve=resolve}); emit({type:'state',...getBotState()});
  fs.mkdirSync('./session',{recursive:true});
  const {state:authState,saveCreds}=await useMultiFileAuthState('./session');
  currentAuthState=authState;
  let version;
  try{
    const live=await fetchLatestWaWebVersion({signal:AbortSignal.timeout(10000)});
    version=live.version;
    emit({type:'version',version:version.join('.'),latest:!!live.isLatest});
  }catch(e){
    emit({type:'version_error',message:`تعذر جلب إصدار WhatsApp Web الحالي، سيتم استخدام الإصدار المدمج: ${e.message}`});
  }
  sock=makeWASocket({auth:authState,logger,browser:Browsers.windows('Chrome'),version,countryCode:'YE',markOnlineOnConnect:false,syncFullHistory:false,generateHighQualityLinkPreview:false,connectTimeoutMs:60000,qrTimeout:60000});
  const thisSock=sock;
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',async({connection,lastDisconnect:ld,qr})=>{
    if(thisSock!==sock)return;
    if(qr){
      emit({type:'pairing_ready'});
      if(pairingReadyResolve){pairingReadyResolve();pairingReadyResolve=null;}
      qrData=await QRCode.toDataURL(qr,{width:320,margin:2});emit({type:'qr',...getBotState()})
    }
    if(connection==='connecting'){
      state='connecting';
      if(pairingReadyResolve){pairingReadyResolve();pairingReadyResolve=null;}
      emit({type:'state',...getBotState()})
    }
    if(connection==='open'){state='connected';qrData=null;pairingCode=null;starting=false;lastDisconnect=null;emit({type:'state',...getBotState()})}
    if(connection==='close'){
      const code=ld?.error?.output?.statusCode;
      lastDisconnect={code:code??null,message:ld?.error?.message||'Connection closed'};
      state='disconnected';starting=false;
      if(pairingReadyResolve){pairingReadyResolve();pairingReadyResolve=null;}
      emit({type:'state',...getBotState()});
      emit({type:'connection_error',message:`Connection closed${code?` (${code})`:''}: ${lastDisconnect.message}`});
      if(code!==DisconnectReason.loggedOut){
        sock=null;
        setTimeout(()=>startBot().catch(e=>emit({type:'error',message:e.message})),5000);
      }
    }
  });
  sock.ev.on('messages.upsert',async({messages,type})=>{
    if(type!=='notify')return;
    for(const m of messages){
      try{
        if(!m.message)continue;
        if(await handleStatus(m))continue;
        if(m.key.fromMe)continue;
        const jid=m.key.remoteJid;if(!jid)continue;const sender=m.key.participant||m.key.participantAlt||jid;const senderIds=senderCandidates(m,sender);const settings=getSettings();
        const iid=interactiveId(m);
        if(iid){await handleInteractive(m,jid,settings);continue}
        const text=textOf(m);
        if(m.message?.extendedTextMessage?.contextInfo?.quotedMessage){
          const q=m.message.extendedTextMessage.contextInfo.quotedMessage;
          const viewOnce=Boolean(q?.viewOnceMessage||q?.viewOnceMessageV2||q?.imageMessage?.viewOnce||q?.videoMessage?.viewOnce);
          if(viewOnce)await reply(jid,'🔒 هذه وسائط عرض مرة واحدة. لا أستطيع تجاوز إعداد العرض لمرة واحدة أو حفظها بعد اختفائها. اطلب من المرسل إرسالها كصورة/فيديو عادي إذا أراد حفظها.').catch(()=>{});
          else await saveQuotedRegularMediaToSelf(m,jid).catch(()=>{});
        }
        if(isJidGroup(jid)){
          const {meta,isBotAdmin}=await groupContext(jid);const senderAdmin=isAdmin(meta,senderIds);const gc=groupConfig(settings,jid);
          if(settings.muted?.[`${jid}:${sender}`]&&!senderAdmin){if(isBotAdmin)await sock.sendMessage(jid,{delete:m.key}).catch(()=>{});continue}
          if(!senderAdmin&&gc.antiflood&&floodHit(jid,sender,text)){if(isBotAdmin)await sock.sendMessage(jid,{delete:m.key}).catch(()=>{});await reply(jid,'🚨 تم حذف رسالة بسبب التكرار السريع.').catch(()=>{});continue}
          if(!senderAdmin&&gc.antispam&&spamHit(jid,sender,text)){if(isBotAdmin)await sock.sendMessage(jid,{delete:m.key}).catch(()=>{});await reply(jid,'🚫 تم حذف الرسالة بسبب السبام المتكرر.').catch(()=>{});continue}
          const mentioned=m.message?.extendedTextMessage?.contextInfo?.mentionedJid||[];
          if(!senderAdmin&&gc.antitag&&mentioned.length>=8){if(isBotAdmin)await sock.sendMessage(jid,{delete:m.key}).catch(()=>{});await reply(jid,'🚫 تم حذف الرسالة بسبب منشن جماعي.').catch(()=>{});continue}
          if(!senderAdmin&&gc.antilink&&/(?:https?:\/\/|www\.|chat\.whatsapp\.com\/)/i.test(text)){
            if(isBotAdmin){await sock.sendMessage(jid,{delete:m.key}).catch(()=>{});await reply(jid,settings.language==='ar'?'🚫 تم حذف الرابط.':'🚫 Link removed.',{quoted:m}).catch(()=>{})}continue;
          }
          if(!senderAdmin&&gc.antibadword&&(settings.badwords||[]).some(w=>w&&text.toLowerCase().includes(w.toLowerCase()))){if(isBotAdmin)await sock.sendMessage(jid,{delete:m.key}).catch(()=>{});continue}
        }
        if(isMenuTrigger(text)){await sendMenu(jid,settings.language,settings.prefix,m);continue;}
        if(await handleMenuNumber(m,jid,text,settings))continue;
        if(await handleCommand(m,jid,sender,text,settings))continue;
        await maybeAI(m,jid,sender,text,settings);
      }catch(err){emit({type:'error',message:String(err?.message||err)})}
    }
  });
  sock.ev.on('group-participants.update',async({id,participants,action})=>{
    const settings=getSettings();if(action!=='add')return;const gc=groupConfig(settings,id);if(!gc.welcome)return;
    const text=settings.language==='ar'?'👋 أهلاً بك في المجموعة!\nمرحبًا بك مع FlowTech.':settings.language==='fr'?'👋 Bienvenue dans le groupe avec FlowTech.':'👋 Welcome to the group with FlowTech.';
    for(const p of participants)await reply(id,`${text}\n@${p.split('@')[0]}`,{mentions:[p]}).catch(()=>{});
  });
  return sock;
}


export async function requestPairingCode(phone){
  if(!phone)throw new Error('أدخل رقم الهاتف أولاً.');
  const number=phone.replace(/\D/g,'');
  if(number.length<8||number.length>15)throw new Error('استخدم الرقم الدولي بدون + أو مسافات أو شرطات. مثال: 9677xxxxxxxx');
  if(!sock || state==='disconnected')await startBot();
  if(currentAuthState?.creds?.registered||state==='connected')throw new Error('الجلسة مرتبطة بالفعل. افصل الجلسة أولاً إذا أردت ربط رقم جديد.');
  const target=sock;
  if(pairingReadyPromise)await Promise.race([pairingReadyPromise,new Promise(r=>setTimeout(r,15000))]);
  if(target!==sock)throw new Error('تم إعادة إنشاء اتصال واتساب، اضغط طلب الكود مرة أخرى.');
  if(state==='disconnected')throw new Error(`اتصال واتساب أغلق قبل إصدار الكود${lastDisconnect?.code?` (${lastDisconnect.code})`:''}. جرّب QR أو اضغط إعادة الاتصال.`);
  try{ target.authState.creds.browser=Browsers.windows('Chrome'); }catch{}
  await new Promise(r=>setTimeout(r,1500));
  pairingCode=await target.requestPairingCode(number);
  emit({type:'pairing',...getBotState()});
  return pairingCode;
}
export async function logout(){if(sock){try{await sock.logout()}catch{}}fs.rmSync('./session',{recursive:true,force:true});state='disconnected';qrData=null;pairingCode=null;sock=null;emit({type:'state',...getBotState()});}
