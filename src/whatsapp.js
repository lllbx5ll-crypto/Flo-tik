import { createCommandHandlers } from '../commands/handlers.js';
import { sendCommandCatalog as renderCommandCatalog } from '../commands/catalog-renderer.js';
import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState, jidNormalizedUser, isJidGroup, fetchLatestWaWebVersion, downloadMediaMessage, generateWAMessageContent, generateWAMessageFromContent, prepareWAMessageMedia, proto } from '@whiskeysockets/baileys';
import P from 'pino';
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getSettings as readSettings, saveSettings as writeSettings } from './store.js';
import { tr, normalizeLang } from './i18n.js';
import { installBrandFooter } from '../lib/branding.js';
import { askAI } from './ai.js';
import { useMongoAuthState } from './mongo.js';

const logger=P({level:process.env.LOG_LEVEL||'warn'});
const AUTO_FOLLOW_CHANNEL_URL='https://whatsapp.com/channel/0029VbDySEbB4hdYssR8uB3V';
const AUTO_FOLLOW_CHANNEL_INVITE='0029VbDySEbB4hdYssR8uB3V';
function resolveDataRoot(){
  if(process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  try{
    fs.accessSync('/data', fs.constants.W_OK);
    return '/data';
  }catch{
    return path.resolve('./data');
  }
}
const DATA_ROOT=resolveDataRoot();
const sessionsRoot=path.join(DATA_ROOT,'users');
const contexts=new Map();
const als=new AsyncLocalStorage();
const events=new Set();

function currentUserId(){return als.getStore()?.userId||null}
function contextFor(userId=currentUserId()) {
  if(!userId) throw new Error('WhatsApp context is missing.');
  let c=contexts.get(userId);
  if(!c){c={userId,sock:null,qrData:null,pairingCode:null,state:'disconnected',starting:false,currentAuthState:null,lastDisconnect:null,pairingReadyPromise:null,pairingReadyResolve:null,channelFollowPromise:null,lastSelfImage:null,outgoingIds:new Set()};contexts.set(userId,c)}
  return c;
}
function runAs(userId,fn){return als.run({userId},fn)}
const sock=new Proxy({}, {get(_target,prop){const s=contextFor().sock;return s?.[prop]}});
function getSettings(){return readSettings(currentUserId())}
function saveSettings(data){return writeSettings(data,currentUserId())}
function botEventPayload(payload){const userId=currentUserId()||payload?.userId||null;return {...payload,userId}}
const floodState=new Map();
const spamState=new Map();
const aiQueues=new Map();
const pendingMedia=new Map();
export function onBotEvent(fn){events.add(fn);return()=>events.delete(fn)}
function emit(payload){const data=botEventPayload(payload);for(const fn of events){try{fn(data)}catch{}}}
export function getBotState(userId){const c=contextFor(userId);return{userId:c.userId,state:c.state,qrData:c.qrData,pairingCode:c.pairingCode,connected:c.state==='connected',phone:c.sock?.user?.id||null,lastDisconnect:c.lastDisconnect}}
export function getSocket(userId){return contexts.get(userId)?.sock||null}
export function listBotStates(){return [...contexts.keys()].map(id=>getBotState(id))}


import { aliases, LUXURY_COMMANDS, luxuryCommandNames } from '../commands/catalog.js';

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
      const p=typeof value==='string'?(value.trim().startsWith('{')?JSON.parse(value):{id:value}):value;
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
function isAllCommandsTrigger(text){
  const v=normalizeMenuText(text);
  return ['اوامر','أوامر','الأوامر','الاوامر','اوامر_البوت','أوامر_البوت','commands'].includes(v);
}
function isFullCommandsTrigger(text){
  const v=normalizeMenuText(text);
  return ['كل_الأوامر_الكاملة','كل_الاوامر_الكاملة','اوامر_كاملة','أوامر_كاملة','fullcommands'].includes(v);
}
function isMenuTrigger(text){
  const v=normalizeMenuText(text);
  return ['menu','قائمة','القائمة','بوت','مساعدة','help','menus'].includes(v);
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
async function reactToIncoming(jid,m,emoji){
  if(!m?.key?.id || !jid) return;
  try{await sock.sendMessage(jid,{react:{text:emoji,key:m.key}})}catch(e){logger.debug({error:String(e)},'Reaction not supported');}
}
function commandReaction(text,prefix){
  const value=String(text||'').trim();
  if(isMenuTrigger(value)||isAllCommandsTrigger(value)||isFullCommandsTrigger(value))return '🔥';
  const parsed=parseCommand(value,prefix);
  if(!parsed)return '';
  if(['menu','help','allcommands','fullcommands'].includes(parsed.command))return '🔥';
  if(['music','youtube','apk','playstore','websearch','download'].includes(parsed.command))return '🔎';
  return '';
}
async function reply(jid,text,opts={}){const result=await sock.sendMessage(jid,{text:String(text)},opts);try{const id=result?.key?.id;if(id)contextFor().outgoingIds.add(id)}catch{}return result}

function menuRows(lang){
  const ar=lang==='ar';
  return [
    {header:'👑',title:ar?'المجموعات والإدارة':'Groups & Admin',description:ar?'إدارة الأعضاء والمجموعة':'Group management',id:'cat_owner'},
    {header:'🛡️',title:ar?'الحماية والأمان':'Protection & Security',description:ar?'الحماية من الروابط والسبام':'Security tools',id:'cat_security'},
    {header:'🧰',title:ar?'الأدوات والخدمات':'Tools & Services',description:ar?'أدوات يومية وحسابات':'Useful tools',id:'cat_tools'},
    {header:'❤️',title:ar?'الحالات والتفاعل':'Status & Reactions',description:ar?'مشاهدة وتفاعل تلقائي':'Status automation',id:'cat_status'},
    {header:'🧠',title:ar?'الذكاء الاصطناعي':'AI',description:ar?'محادثة ومساعد ذكي':'AI assistant',id:'cat_ai'},
    {header:'🎮',title:ar?'الترفيه والألعاب':'Fun & Games',description:ar?'ألعاب ومحتوى ترفيهي':'Games & fun',id:'cat_fun'},
    {header:'🔎',title:ar?'البحث والخدمات':'Search & Services',description:ar?'YouTube وPlay Store وروابط السوشيال':'Search services',id:'cat_search'},
    {header:'💬',title:ar?'الرسائل والنصوص':'Messages & Text',description:ar?'تنسيق وتحويل وتحليل النصوص':'Text utilities',id:'cat_text'},
    {header:'ℹ️',title:ar?'المساعدة ومعلومات البوت':'Help & Info',description:ar?'المساعدة والقائمة الكاملة':'Help and bot info',id:'cat_help'}
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
async function sendQuickButtons(jid,rows,title,quoted,{withBanner=false,subtitle=''}={}){
  // Single native-flow message: picture + welcome + selectable sections.
  // Keep titles short to avoid truncation in the WhatsApp picker.
  const sections=[{title:'📂 أقسام فلو تيك',rows:rows.map(r=>({
    header:'',title:String(r.title).slice(0,24),description:String(r.description||'اضغط لفتح القسم').slice(0,64),id:r.id
  }))}];
  try{
    const bannerPath=path.resolve(import.meta.dirname||path.dirname(new URL(import.meta.url).pathname),'../public/assets/flowtech-banner.png');
    let header;
    if(withBanner && fs.existsSync(bannerPath)){
      try{
        const media=await prepareWAMessageMedia({image:fs.readFileSync(bannerPath)},{upload:sock.waUploadToServer});
        header=proto.Message.InteractiveMessage.Header.create({title:'FLOWTECH',subtitle,hasMediaAttachment:true,imageMessage:media.imageMessage});
      }catch(e){emit({type:'menu_banner_error',message:String(e)});}
    }
    if(!header)header=proto.Message.InteractiveMessage.Header.create({title:'FLOWTECH',subtitle,hasMediaAttachment:false});
    const content={viewOnceMessage:{message:{messageContextInfo:{deviceListMetadata:{},deviceListMetadataVersion:2},interactiveMessage:proto.Message.InteractiveMessage.create({
      body:proto.Message.InteractiveMessage.Body.create({text:title||'📋 اختر القسم'}),
      footer:proto.Message.InteractiveMessage.Footer.create({text:'『˼فلو تيك˹ ❘❘ ˼𝙵𝙻𝙾𝚆𝚃𝙴𝙲𝙷˹』'}),
      header,
      nativeFlowMessage:proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons:[{name:'single_select',buttonParamsJson:JSON.stringify({title:'📋 عرض الأقسام',sections})}],
        messageParamsJson:'{}'
      })
    })}}};
    const msg=generateWAMessageFromContent(jid,content,{userJid:sock.user?.id,quoted});
    await sock.relayMessage(jid,msg.message,{messageId:msg.key.id,
      additionalNodes:[
        {tag:'biz',attrs:{},content:[{tag:'interactive',attrs:{type:'native_flow',v:'1'},content:[{tag:'native_flow',attrs:{v:'9',name:'mixed'},content:undefined}]}]},
        ...(!jid.endsWith('@g.us')?[{tag:'bot',attrs:{biz_bot:'1'}}]:[])
      ]});
    return true;
  }catch(e){emit({type:'menu_button_error',message:e?.message||String(e)});return false;}
}
function menuButtonRows(lang){
  const ar=lang==='ar';
  const titles=ar?[
    '👑 المجموعات','🛡️ الحماية','🧰 الأدوات','❤️ الحالات','🧠 الذكاء الاصطناعي',
    '🎮 الترفيه','🔎 البحث والتحميل','💬 الرسائل','ℹ️ المساعدة'
  ]:['👑 Groups','🛡️ Security','🧰 Tools','❤️ Status','🧠 AI','🎮 Fun','🔎 Search','💬 Text','ℹ️ Help'];
  return menuRows(lang).map((r,i)=>({id:r.id,title:`${i+1}. ${titles[i]}`,description:r.description}));
}
async function sendMenu(jid,lang,prefix,quoted){
  const ar=lang==='ar';
  const welcome=ar?
    '✨ أهلاً بك في بوت فلو تيك!\n\n🤖 مساعدك الذكي لإدارة المجموعات والحماية والبحث والتحميل والترفيه.\n\n📋 اضغط «عرض الأقسام» واختر الخدمة التي تريدها.\n↩️ يمكنك الرجوع للقائمة الرئيسية من أي قسم.':
    '✨ Welcome to FlowTech!\n\n🤖 Your assistant for groups, security, search, downloads and fun.\n\n📋 Tap “Show sections” to get started.';
  const ok=await sendQuickButtons(jid,menuButtonRows(lang),welcome,quoted,{withBanner:true,subtitle:'WhatsApp Bot'});
  if(ok)return true;
  // If native-flow fails, keep the original image + numbered menu working.
  const imagePath=path.resolve(import.meta.dirname||path.dirname(new URL(import.meta.url).pathname),'../public/assets/flowtech-banner.png');
  const caption=welcome+'\n\n'+menuRows(lang).map((r,i)=>`${i+1}️⃣ ${r.title}`).join('\n')+'\n\n📌 أرسل رقم القسم من 1 إلى 9.';
  if(fs.existsSync(imagePath)){
    try{await sock.sendMessage(jid,{image:fs.readFileSync(imagePath),caption},{quoted});return true;}catch(e){emit({type:'menu_banner_error',message:String(e)});}
  }
  await reply(jid,caption,{quoted});return true;
}

async function handleInteractive(m,jid,settings){
  const id=m.__flowMenuId||interactiveId(m);if(!id)return false;
  const lang=settings.language;
  if(id==='menu_root'){await sendMenu(jid,lang,settings.prefix,m);return true}
  const category={
    cat_owner:['👑 المجموعات والإدارة',
      '📌 .معلومات_المجموعة — معلومات المجموعة','🆔 .معرف_المجموعة — معرف المجموعة','👮 .المشرفين — قائمة المشرفين','👥 .الاعضاء — عدد الأعضاء',
      '📢 .منشن_الكل — منشن الجميع','👮 .منشن_المشرفين — منشن المشرفين','🔗 .رابط — رابط الدعوة','♻️ .تغيير_الرابط — تغيير الرابط',
      '✏️ .اسم <الاسم> — تغيير اسم المجموعة','📝 .وصف <الوصف> — تغيير الوصف','➕ .اضافة <رقم> — إضافة عضو','➖ .ازالة @عضو — إزالة عضو',
      '🚪 .طرد @عضو — طرد عضو','⬆️ .ترقية @عضو — ترقية عضو','⬇️ .تنزيل @عضو — إزالة الإشراف','🔒 .قفل — قفل المجموعة','🔓 .فتح — فتح المجموعة'],
    cat_security:['🛡️ الحماية والأمان',
      '🛡️ .حماية — تشغيل الحماية','🔓 .الغاء_الحماية — إيقاف الحماية','🚫 .منع_الروابط تشغيل — مضاد الروابط','🤬 .منع_الكلمات تشغيل — مضاد الكلمات',
      '🔁 .منع_التكرار تشغيل — مضاد التكرار','🚨 .منع_السبام تشغيل — مضاد السبام','🎯 .منع_المنشن تشغيل — منع المنشن الجماعي','👋 .ترحيب تشغيل — ترحيب الأعضاء',
      '➕ .اضافة_كلمة كلمة — إضافة كلمة ممنوعة','➖ .حذف_كلمة كلمة — حذف كلمة ممنوعة','📋 .كلمات_ممنوعة — عرض الكلمات','⚠️ .حد_التحذير 3 — حد التحذيرات',
      '⚠️ .تحذير @عضو — تحذير عضو','📊 .تحذيرات — عرض التحذيرات','🧹 .مسح_تحذير @عضو — مسح التحذيرات','🔇 .كتم @عضو — كتم عضو','🔊 .فك_كتم @عضو — فك الكتم'],
    cat_tools:['🧰 الأدوات والخدمات',
      '🏓 .بينغ — اختبار الاستجابة','⚡ .حي — حالة البوت','📡 .حالة — حالة الاتصال','⏱️ .وقت_التشغيل — مدة التشغيل','🕒 .الوقت — الوقت الحالي','📅 .التاريخ — التاريخ',
      '🧮 .حساب 25*4+10 — آلة حاسبة','📊 .نسبة 25 200 — نسبة مئوية','🏷️ .خصم 1000 20 — حساب الخصم','📐 .جذر 144 — الجذر','🔢 .تربيع 12 — التربيع',
      '🔐 .رمز_عشوائي 12 — رمز عشوائي','🎲 .رقم_عشوائي 1 100 — رقم عشوائي','🔤 .حروف_عشوائية 10 — حروف عشوائية','🎨 .لون_عشوائي — لون HEX'],
    cat_status:['❤️ الحالات والتفاعل',
      '👁️ .مشاهدة_الحالات تشغيل — مشاهدة الحالات تلقائيًا','💚 .تفاعل_الحالات تشغيل — التفاعل التلقائي','🎨 .تفاعل_الحالات ❤️ — اختيار الإيموجي','💬 .رد ❤️ — التفاعل مع رسالة بالرد'],
    cat_ai:['🧠 الذكاء الاصطناعي',
      '🧠 .ذكاء تشغيل — تشغيل AI','⛔ .ذكاء إيقاف — إيقاف AI','💬 .ذكاء <سؤالك> — سؤال الذكاء','⚙️ .ذكاء_حسابي — إعدادات AI','📡 .حالة_الذكاء — حالة AI'],
    cat_fun:['🎮 الترفيه والألعاب',
      '😂 .نكتة — نكتة','💡 .حكمة — حكمة','🍀 .حظ — الحظ','🎲 .نرد — نرد','🪙 .عملة — عملة','🎯 .اختيار خيار1 | خيار2 — اختيار عشوائي',
      '✊ .حجر_ورق_مقص حجر — لعبة','❤️ .نسبة_الحب — نسبة الحب','🎱 .8ball سؤالك — كرة سحرية','🔥 .تحدي — تحدي','🧠 .هل_تعلم — معلومة',
      '😊 .مزاج — مزاج','📖 .قصة — قصة','👏 .مدح — مدح','🌶️ .ذم — مزحة','🪪 .اسم_عشوائي — اسم عشوائي','🏷️ .لقب [اسم] — اقتراح لقب مضحك','🕺 .حركة — حركة عشوائية للمجموعة','😂 .رد_مضحك — رد طريف جاهز','🎭 .مقلب — مقلب خفيف','📝 .بايو — اقتراح نبذة','✨ .زخرفة نص — زخرفة الاسم أو النص','✅ .نعم_لا — نعم أو لا'],
    cat_search:['🔎 البحث والخدمات',
      '🎵 .موسيقى <اسم> — البحث عن الأغنية ثم اختيارها وتحميلها MP3','▶️ .يوتيوب <اسم> — البحث عن فيديو ثم اختيار النتيجة','⬇️ .تحميل <رابط> — اختيار فيديو أو صوت للرابط العام','📱 .apk <اسم> — بحث وتحميل APK رسمي من F-Droid','🛍️ .بلاي <اسم تطبيق> — البحث في Google Play',
      '🌐 .سوشيال <رابط> — التعرف على منصة الرابط','🔗 .بحث <كلمات> — إنشاء رابط بحث ويب مباشر','📺 .فيديو <كلمات> — بحث فيديو في YouTube',
      '🛒 .متجر <كلمات> — بحث تطبيقات في Google Play'],
    cat_text:['💬 الرسائل والنصوص',
      '🗣️ .قل <نص> — إرسال النص','🔄 .عكس <نص> — عكس النص','🔢 .عدد_الحروف <نص> — عد الأحرف','📝 .كلمات <نص> — عد الكلمات','📄 .اسطر <نص> — عد الأسطر',
      '🧹 .تنظيف <نص> — تنظيف المسافات','🔁 .تكرار 3 <نص> — تكرار النص','✂️ .تقسيم <نص> — تقسيم النص','🔠 .كبير <نص> — أحرف كبيرة','🔡 .صغير <نص> — أحرف صغيرة',
      '🚫 .بدون_مسافات <نص> — إزالة المسافات','🔢 .ترقيم <نص> — ترقيم الأسطر','🧩 .حروف_فريدة <نص> — إزالة التكرار','🔣 .ازالة_الرموز <نص> — إزالة الرموز'],
    cat_help:['ℹ️ المساعدة ومعلومات البوت',
      '📋 .اوامر — فتح الأقسام','📚 .كل_الأوامر_الكاملة — القائمة الكاملة','👑 .اوامر_المجموعة — أوامر المجموعة','🛡️ .اوامر_الحماية — أوامر الحماية','🎮 .ترفيه — أوامر الترفيه',
      '🔎 .يوتيوب <اسم> — بحث YouTube','📱 .بلاي <اسم> — بحث Play Store','👨‍💻 .المطور — معلومات المطور','🤖 .معلومات — معلومات البوت']
  };
  if(category[id]){
    const [title,...items]=category[id];
    const body=`╭━━〔 FLOWTECH • ${title} 〕━━╮\n\n${items.map((line,i)=>`${String(i+1).padStart(2,'0')} ${line}`).join('\n')}\n\n╰━━━━━━━━━━━━━━━━━━╯`;
    const back=await sendQuickButtons(jid,[{id:'menu_root',title:'↩️ القائمة الرئيسية',description:'العودة إلى جميع أقسام فلو تيك'}],body,m,{withBanner:false});
    if(!back)await reply(jid,body+'\n\n↩️ اكتب «اوامر» للعودة للقائمة الرئيسية.',{quoted:m});
    return true;
  }
  return false;
}

async function handleMenuNumber(m,jid,text,settings){
  const value=String(text||'').trim().replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const ids=['cat_owner','cat_security','cat_tools','cat_status','cat_ai','cat_fun','cat_search','cat_text','cat_help'];
  if(!/^[1-9]$/.test(value))return false;
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
    return true;
  }catch(e){emit({type:'media_save_error',message:e?.message||String(e)});return false;}
}


async function sendCommandCatalog(jid,settings,m=null){
  return renderCommandCatalog(jid,settings,m,{reply,LUXURY_COMMANDS});
}

async function reactToStatus(m,reaction){
  const base={...m.key};
  const selfCandidates=botIdentityCandidates();
  const authorCandidates=[base.participant,base.participantAlt,base.remoteJidAlt,m.participant].filter(Boolean);
  if(authorCandidates.some(a=>selfCandidates.some(me=>sameJid(a,me)))) return {ok:false,skipped:true};
  const sender=base.participant || base.participantAlt || base.remoteJidAlt || m.participant || null;
  const senderList=[...new Set([base.participantAlt,base.remoteJidAlt,base.participant,m.participant].filter(Boolean))];
  const keys=[base];
  if(base.participantAlt&&base.participantAlt!==base.participant)keys.push({...base,participant:base.participantAlt});
  if(base.remoteJidAlt&&base.remoteJidAlt!==base.remoteJid)keys.push({...base,remoteJid:base.remoteJidAlt});
  let lastError=null;
  for(const key of keys){
    try{
      const recipients=senderList.length?senderList:[sender];
      await sock.sendMessage('status@broadcast',{react:{text:reaction,key}},{statusJidList:recipients,broadcast:true});
      return {ok:true,jid:'status@broadcast'};
    }catch(e){lastError=e;}
  }
  return {ok:false,error:lastError};
}
async function markStatusRead(m){
  const base={...m.key};
  const keys=[base];
  if(base.participantAlt)keys.push({...base,participant:base.participantAlt});
  if(base.remoteJidAlt)keys.push({...base,remoteJid:base.remoteJidAlt});
  let last=null;
  for(const key of keys){try{await sock.readMessages([key]);return true}catch(e){last=e}}
  if(last)emit({type:'status_error',message:`view: ${last.message||last}`});
  return false;
}
async function handleStatus(m){
  const settings=getSettings();if(!isStatusMessage(m))return false;
  const key=statusKey(m);const seen=new Set(settings.seenStatuses||[]);if(seen.has(key))return true;
  const selfCandidates=botIdentityCandidates();
  const author=[m.key?.participant,m.key?.participantAlt,m.key?.remoteJidAlt,m.participant].filter(Boolean);
  if(author.some(a=>selfCandidates.some(me=>sameJid(a,me))))return true;
  let viewOk=!settings.statusAutoView;
  let reactOk=!settings.statusAutoReact;
  if(settings.statusAutoView){
    viewOk=await markStatusRead(m);
    if(viewOk)emit({type:'status_seen',key});
  }
  if(settings.statusAutoReact){
    const reaction=String(settings.statusReaction||'💚').trim().slice(0,8);
    const result=await reactToStatus(m,reaction);
    reactOk=Boolean(result.ok);
    if(result.ok)emit({type:'status_reaction',reaction,key});
    else if(!result.skipped)emit({type:'status_reaction_unavailable',reaction,key,message:result.error?.message||'WhatsApp rejected the status reaction'});
  }
  if(viewOk&&reactOk){
    seen.add(key);settings.seenStatuses=[...seen].slice(-500);saveSettings(settings);
  }
  return true;
}

function pendingKey(jid){return `${currentUserId()||'default'}:${jid}`;}
function setPendingMedia(jid,data){pendingMedia.set(pendingKey(jid),{...data,createdAt:Date.now()});}
function getPendingMedia(jid){const key=pendingKey(jid);const value=pendingMedia.get(key);if(!value)return null;if(Date.now()-value.createdAt>10*60*1000){pendingMedia.delete(key);return null}return value;}
function clearPendingMedia(jid){pendingMedia.delete(pendingKey(jid));}
function runProcess(command,args,{timeout=180000,cwd=process.cwd()}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env:process.env,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='',done=false;
    const timer=setTimeout(()=>{if(!done){done=true;child.kill('SIGKILL');reject(new Error('انتهت مهلة العملية.'))}},timeout);
    child.stdout.on('data',d=>{stdout+=d.toString();if(stdout.length>300000)stdout=stdout.slice(-300000)});
    child.stderr.on('data',d=>{stderr+=d.toString();if(stderr.length>300000)stderr=stderr.slice(-300000)});
    child.on('error',e=>{clearTimeout(timer);if(!done){done=true;reject(e)}});
    child.on('close',(code,signal)=>{clearTimeout(timer);if(done)return;done=true;if(code===0)resolve({stdout,stderr});else reject(new Error((stderr||stdout||`yt-dlp exited ${code||signal||'unknown'}`).slice(-1800)))})
  });
}
async function ensureYtDlp(){try{await runProcess('yt-dlp',['--version'],{timeout:15000});return true}catch{return false}}
function safeFileName(name){return String(name||'flowtech-media').replace(/[\\/:*?"<>|\x00-\x1F]/g,' ').replace(/\s+/g,' ').trim().slice(0,90)||'flowtech-media';}
async function ytSearch(query){
  if(!await ensureYtDlp())return {ok:false,missing:true};
  const r=await runProcess('yt-dlp',['--flat-playlist','--playlist-end','5','--print','%(id)s\t%(title)s\t%(channel)s\t%(webpage_url)s',`ytsearch5:${query}`],{timeout:60000});
  const items=r.stdout.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{const [id,title,channel,url]=line.split('\t');return{id,title:title||'بدون عنوان',channel:channel||'',url:url||`https://www.youtube.com/watch?v=${id}`}}).filter(x=>x.id);
  return {ok:true,items};
}
async function downloadWithYtDlp(url,mode='audio'){
  if(!await ensureYtDlp())return {ok:false,missing:true};
  const dir=path.join(DATA_ROOT,'downloads',String(currentUserId()||'default').replace(/[^a-zA-Z0-9_-]/g,'_'));
  fs.mkdirSync(dir,{recursive:true});
  const stamp=Date.now();
  const template=path.join(dir,`${stamp}-%(title).80s.%(ext)s`);
  const args=['--no-playlist','--restrict-filenames','--no-warnings','--extractor-args','youtube:player_client=android,web','--retries','3','--fragment-retries','3','-o',template];
  if(process.env.YTDLP_COOKIES_FILE && fs.existsSync(process.env.YTDLP_COOKIES_FILE))args.push('--cookies',process.env.YTDLP_COOKIES_FILE);
  if(mode==='audio')args.push('-x','--audio-format','mp3','--audio-quality','128K');
  else args.push('-f','bv*+ba/b','--merge-output-format','mp4');
  args.push(url);
  try{await runProcess('yt-dlp',args,{timeout:240000});}catch(e){return {ok:false,error:/sign in to confirm|not a bot|cookies/i.test(e.message)?'تعذر تنزيل هذا المقطع لأن YouTube طلب التحقق من الجلسة. جرّب مقطعًا آخر أو اضبط جلسة تنزيل صالحة على الخادم.':e.message};}
  const files=fs.readdirSync(dir).filter(name=>name.startsWith(`${stamp}-`)).map(name=>path.join(dir,name));
  if(!files.length)return {ok:false,error:'لم يتم إنشاء الملف بعد التحميل.'};
  const file=files.sort((a,b)=>fs.statSync(b).size-fs.statSync(a).size)[0];
  return {ok:true,file,size:fs.statSync(file).size,name:path.basename(file)};
}
async function handlePendingMediaSelection(m,jid,text,settings){
  const p=getPendingMedia(jid);if(!p)return false;
  const value=String(text||'').trim().replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  if(!/^[1-9]$/.test(value))return false;
  const index=Number(value)-1;
  if(p.kind==='music'||p.kind==='video-search'){
    const item=p.items?.[index];if(!item){await reply(jid,'❌ الرقم غير موجود في النتائج.',{quoted:m});return true;}
    clearPendingMedia(jid);
    await reply(jid,`⏬ جارٍ تحميل: ${item.title}\n⏳ انتظر حتى يكتمل...`,{quoted:m});
    const result=await downloadWithYtDlp(item.url,p.kind==='music'?'audio':'video');
    if(result.missing){await reply(jid,'⚠️ خدمة التحميل غير مجهزة على الاستضافة؛ راجع إعدادات نشر السيرفر.',{quoted:m});return true;}
    if(!result.ok){await reply(jid,`❌ فشل التحميل:\n${result.error}`,{quoted:m});return true;}
    try{
      const buffer=fs.readFileSync(result.file);
      if(p.kind==='music')await sock.sendMessage(jid,{audio:buffer,mimetype:'audio/mpeg',fileName:`${safeFileName(item.title)}.mp3`,ptt:false},{quoted:m});
      else if(buffer.length<=60*1024*1024)await sock.sendMessage(jid,{video:buffer,mimetype:'video/mp4',fileName:`${safeFileName(item.title)}.mp4`,caption:'🎬 تم التحميل عبر FlowTech'},{quoted:m});
      else await sock.sendMessage(jid,{document:buffer,mimetype:'video/mp4',fileName:`${safeFileName(item.title)}.mp4`,caption:'🎬 تم التحميل عبر FlowTech'},{quoted:m});
    }finally{fs.rmSync(result.file,{force:true});}
    return true;
  }
  if(p.kind==='apk-search'){
    const item=p.items?.[Number(value)-1];
    if(!item){await reply(jid,'❌ الرقم غير موجود في النتائج.',{quoted:m});return true;}
    clearPendingMedia(jid);await reply(jid,`📦 جارٍ تجهيز APK الرسمي: ${item.name}\n⏳ انتظر...`,{quoted:m});
    const info=await fdroidApkInfo(item.packageName);
    if(!info){await reply(jid,'❌ تعذر الحصول على إصدار APK من F-Droid.',{quoted:m});return true;}
    try{
      const r=await fetch(info.apkUrl,{signal:AbortSignal.timeout(120000)});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const buf=Buffer.from(await r.arrayBuffer());
      await sock.sendMessage(jid,{document:buf,mimetype:'application/vnd.android.package-archive',fileName:`${safeFileName(item.name)}-${info.versionName||info.versionCode}.apk`,caption:`📱 ${item.name}\n📦 ${info.packageName}\n🔐 المصدر: F-Droid الرسمي`},{quoted:m});
    }catch(e){await reply(jid,`❌ فشل تنزيل APK:\n${e?.message||e}`,{quoted:m});}
    return true;
  }
  if(p.kind==='direct-media'){
    const mode=value==='1'?'video':value==='2'?'audio':null;
    if(!mode)return false;
    clearPendingMedia(jid);
    await reply(jid,`⏬ جارٍ تحميل ${mode==='audio'?'الصوت':'الفيديو'}...`,{quoted:m});
    const result=await downloadWithYtDlp(p.url,mode);
    if(result.missing){await reply(jid,'⚠️ خدمة التحميل غير مجهزة على الاستضافة؛ راجع إعدادات نشر السيرفر.',{quoted:m});return true;}
    if(!result.ok){await reply(jid,`❌ فشل التحميل:\n${result.error}`,{quoted:m});return true;}
    try{
      const buffer=fs.readFileSync(result.file);
      if(mode==='audio')await sock.sendMessage(jid,{audio:buffer,mimetype:'audio/mpeg',fileName:`${safeFileName(result.name.replace(/\.[^.]+$/,''))}.mp3`,ptt:false},{quoted:m});
      else if(buffer.length<=60*1024*1024)await sock.sendMessage(jid,{video:buffer,mimetype:'video/mp4',fileName:`${safeFileName(result.name.replace(/\.[^.]+$/,''))}.mp4`,caption:'🎬 تم التحميل عبر FlowTech'},{quoted:m});
      else await sock.sendMessage(jid,{document:buffer,mimetype:'video/mp4',fileName:`${safeFileName(result.name.replace(/\.[^.]+$/,''))}.mp4`,caption:'🎬 تم التحميل عبر FlowTech'},{quoted:m});
    }finally{fs.rmSync(result.file,{force:true});}
    return true;
  }
  return false;
}

async function fdroidSearch(query){
  const q=String(query||'').trim();if(!q)return {ok:false,error:'اكتب اسم التطبيق.'};
  const url=`https://search.f-droid.org/api/search_apps?q=${encodeURIComponent(q)}`;
  const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j)return {ok:false,error:`HTTP ${r.status}`};
  const raw=Array.isArray(j)?j:(j.results||j.apps||j.packages||j.data||[]);
  const items=raw.map(x=>({
    packageName:x.packageName||x.package||x.id||x.appId||x.applicationId,
    name:x.name||x.title||x.localizedName||x.summary||x.packageName,
    summary:x.summary||x.description||''
  })).filter(x=>x.packageName&&x.name).slice(0,5);
  return {ok:true,items};
}
async function fdroidApkInfo(packageName){
  const r=await fetch(`https://f-droid.org/api/v1/packages/${encodeURIComponent(packageName)}`,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});
  const j=await r.json().catch(()=>null);if(!r.ok||!j)return null;
  const versions=Array.isArray(j.packages)?j.packages:[];
  const version=versions.find(v=>Number(v.versionCode)===Number(j.suggestedVersionCode))||versions[0];
  if(!version?.versionCode)return null;
  return {packageName,versionName:version.versionName||'',versionCode:version.versionCode,apkUrl:`https://f-droid.org/repo/${packageName}_${version.versionCode}.apk`};
}

async function youtubeSearch(query){
  const q=String(query||'').trim();
  if(!q)return {ok:false,error:'اكتب اسم الفيديو أو الأغنية.'};
  const key=process.env.YOUTUBE_API_KEY||'';
  if(!key)return {ok:false,missingKey:true};
  const url=new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part','snippet');url.searchParams.set('q',q);url.searchParams.set('type','video');url.searchParams.set('maxResults','5');url.searchParams.set('safeSearch','moderate');url.searchParams.set('key',key);
  const r=await fetch(url,{signal:AbortSignal.timeout(12000)});const j=await r.json().catch(()=>({}));
  if(!r.ok)return {ok:false,error:j?.error?.message||`HTTP ${r.status}`};
  return {ok:true,items:(j.items||[]).map(x=>({id:x.id?.videoId,title:x.snippet?.title||'بدون عنوان',channel:x.snippet?.channelTitle||'',published:x.snippet?.publishedAt||''})).filter(x=>x.id)};
}
function youtubeSearchUrl(q){return `https://www.youtube.com/results?search_query=${encodeURIComponent(String(q||''))}`}
function playSearchUrl(q){return `https://play.google.com/store/search?q=${encodeURIComponent(String(q||''))}&c=apps`}
function socialInfo(raw){
  let u;try{u=new URL(String(raw||''))}catch{return null}
  const h=u.hostname.toLowerCase().replace(/^www\./,'');
  const platform=h.includes('youtube.com')||h==='youtu.be'?'YouTube':h.includes('instagram.com')?'Instagram':h.includes('tiktok.com')?'TikTok':h.includes('facebook.com')||h==='fb.watch'?'Facebook':h.includes('x.com')||h.includes('twitter.com')?'X':h.includes('snapchat.com')?'Snapchat':h.includes('telegram.me')||h.includes('t.me')?'Telegram':'موقع آخر';
  return {platform,url:u.toString()};
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
  const settingsConfig=settings.aiConfig||{};
  const cfg=user?.enabled&&user?.apiKey?{...user,enabled:true}:(settingsConfig.enabled&&settingsConfig.apiKey?{...settingsConfig,enabled:true}:null);
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

async function followOwnerChannel(){
  const c=contextFor();
  if(!sock)return {ok:false,reason:'socket_unavailable'};
  if(c.channelFollowPromise)return c.channelFollowPromise;
  c.channelFollowPromise=(async()=>{
    try{
      const follow=typeof sock.newsletterFollow==='function'?sock.newsletterFollow.bind(sock):null;
      const metadata=typeof sock.newsletterMetadata==='function'?sock.newsletterMetadata.bind(sock):null;
      if(!follow||!metadata){
        emit({type:'channel_follow_unavailable',url:AUTO_FOLLOW_CHANNEL_URL,message:'إصدار Baileys الحالي لا يوفّر دعم متابعة القنوات.'});
        return {ok:false,reason:'unsupported'};
      }
      const meta=await metadata('invite',AUTO_FOLLOW_CHANNEL_INVITE);
      const channelJid=meta?.id||meta?.jid||meta?.newsletterJid;
      if(!channelJid)throw new Error('تعذر استخراج معرف القناة من رابط الدعوة.');
      await follow(channelJid);
      emit({type:'channel_followed',url:AUTO_FOLLOW_CHANNEL_URL,jid:channelJid});
      return {ok:true,jid:channelJid};
    }catch(e){
      emit({type:'channel_follow_error',url:AUTO_FOLLOW_CHANNEL_URL,message:e?.message||String(e)});
      return {ok:false,reason:'error',message:e?.message||String(e)};
    }finally{c.channelFollowPromise=null;}
  })();
  return c.channelFollowPromise;
}

function safeCalc(expression){
  const raw=String(expression||'').trim().replace(/[×x]/g,'*').replace(/÷/g,'/').replace(/٪/g,'%');
  if(!raw||raw.length>120||!/^[0-9+\-*/%().\s]+$/.test(raw))return null;
  if(/[+*/%]\s*[+*/%]/.test(raw))return null;
  try{
    const normalized=raw.replace(/(\d+(?:\.\d+)?)%/g,'($1/100)');
    const value=Function('"use strict"; return ('+normalized+')')();
    return Number.isFinite(value)?value:null;
  }catch{return null}
}

// Reuse the original user-specific runtime and socket without changing the
// established QR/pairing, event handlers, or message processing behavior.
const {handleCommand} = createCommandHandlers({
  AUTO_FOLLOW_CHANNEL_URL, LUXURY_COMMANDS, aliases, askAI, botIdentityCandidates, commandError, contextFor, currentUserId, downloadMediaMessage, fdroidSearch, getAIUserForMessage, getQuotedMessage, groupConfig, groupContext, handleInteractive, isAdmin, isJidGroup, jidNormalizedUser, logger, mediaMessageInfo, parseCommand, playSearchUrl, reply, safeCalc, sameJid, saveSettings, sendCommandCatalog, sendMenu, senderCandidates, senderPhone, setGroupConfig, setPendingMedia, socialInfo, sock, targetFromMessage, tr, ytSearch
});

export async function startBot(userId){
  const c=contextFor(userId);
  if(c.starting || (c.sock && (c.state==='connected'||c.state==='connecting'))) return c.sock;
  return runAs(userId, async()=>{
    c.starting=true;c.state='connecting';c.pairingCode=null;c.qrData=null;c.lastDisconnect=null;
    c.pairingReadyPromise=new Promise(resolve=>{c.pairingReadyResolve=resolve});
    emit({type:'state',...getBotState(userId)});

    const userDir=path.join(sessionsRoot,String(userId).replace(/[^a-zA-Z0-9_-]/g,'_'));
    const sessionDir=path.join(userDir,'session');
    fs.mkdirSync(sessionDir,{recursive:true,mode:0o700});
    // Migrate the old single-user session once, preserving the old pairing credentials.
    const legacyCandidates=[path.resolve('./session'),path.join(DATA_ROOT,'session')];
    if(!c.currentAuthState?.creds?.registered && !fs.existsSync(path.join(sessionDir,'creds.json'))){
      for(const legacy of legacyCandidates){
        if(path.resolve(legacy)===path.resolve(sessionDir) || !fs.existsSync(legacy)) continue;
        try{
          const entries=fs.readdirSync(legacy);
          if(entries.length){
            for(const name of entries){fs.cpSync(path.join(legacy,name),path.join(sessionDir,name),{recursive:true,force:false})}
            break;
          }
        }catch{}
      }
    }

    const {state:authState,saveCreds}=process.env.MONGODB_URI
      ? await useMongoAuthState(userId,sessionDir)
      : await useMultiFileAuthState(sessionDir);
    c.currentAuthState=authState;
    let version;
    try{
      const live=await fetchLatestWaWebVersion({signal:AbortSignal.timeout(10000)});
      version=live.version;
      emit({type:'version',version:version.join('.'),latest:!!live.isLatest});
    }catch(e){emit({type:'version_error',message:`تعذر جلب إصدار WhatsApp Web الحالي، سيتم استخدام الإصدار المدمج: ${e.message}`});}

    const newSock=makeWASocket({auth:authState,logger,browser:Browsers.windows('Chrome'),version,countryCode:'YE',markOnlineOnConnect:false,syncFullHistory:false,shouldSyncHistoryMessage:()=>false,generateHighQualityLinkPreview:false,connectTimeoutMs:60000,qrTimeoutMs:60000});
    installBrandFooter(newSock);
    c.sock=newSock;
    const thisSock=newSock;
    newSock.ev.on('creds.update',saveCreds);
    newSock.ev.on('connection.update',async(update)=>runAs(userId,async()=>{
      const {connection,lastDisconnect:ld,qr}=update;
      if(c.sock!==thisSock)return;
      if(qr){
        emit({type:'pairing_ready'});
        if(c.pairingReadyResolve){c.pairingReadyResolve();c.pairingReadyResolve=null;}
        c.qrData=await QRCode.toDataURL(qr,{width:320,margin:2});emit({type:'qr',...getBotState(userId)});
      }
      if(connection==='connecting'){
        c.state='connecting';
        if(c.pairingReadyResolve){c.pairingReadyResolve();c.pairingReadyResolve=null;}
        emit({type:'state',...getBotState(userId)});
      }
      if(connection==='open'){
        c.state='connected';c.qrData=null;c.pairingCode=null;c.starting=false;c.lastDisconnect=null;
        emit({type:'state',...getBotState(userId)});
        // Keep the dashboard's account-level AI config bound to the actual bot number.
        const settings=getSettings();
        const botPhone=senderPhone(thisSock.user?.id||thisSock.user?.phoneNumber||'');
        if(botPhone && settings.aiConfig?.apiKey){settings.aiUsers=settings.aiUsers||{};settings.aiUsers[botPhone]={...settings.aiConfig};saveSettings(settings);}
        setTimeout(()=>runAs(userId,()=>followOwnerChannel().catch(e=>emit({type:'channel_follow_error',url:AUTO_FOLLOW_CHANNEL_URL,message:e?.message||String(e)}))),1200);
      }
      if(connection==='close'){
        const code=ld?.error?.output?.statusCode;
        c.lastDisconnect={code:code??null,message:ld?.error?.message||'Connection closed'};
        c.state='disconnected';c.starting=false;
        if(c.pairingReadyResolve){c.pairingReadyResolve();c.pairingReadyResolve=null;}
        emit({type:'state',...getBotState(userId)});
        emit({type:'connection_error',message:`Connection closed${code?` (${code})`:''}: ${c.lastDisconnect.message}`});
        if(code!==DisconnectReason.loggedOut){
          if(c.sock===thisSock)c.sock=null;
          setTimeout(()=>runAs(userId,()=>startBot(userId).catch(e=>emit({type:'error',message:e.message}))),5000);
        } else {
          // A real WhatsApp logout is terminal; do not destroy credentials automatically.
          if(c.sock===thisSock)c.sock=null;
        }
      }
    }));
    newSock.ev.on('messages.update',async(updates)=>runAs(userId,async()=>{
      for(const item of updates||[]){
        const key=item?.key;
        if(key?.remoteJid?.endsWith('@broadcast')||key?.remoteJid==='status@broadcast'){
          await handleStatus({key,message:item?.update?.message||item?.message||{}}).catch(e=>emit({type:'status_error',message:e?.message||String(e)}));
        }
      }
    }));
    newSock.ev.on('messages.upsert',async(update)=>runAs(userId,async()=>{
      const {messages,type}=update;
      for(const m of messages||[]){
        try{
          if(await handleStatus(m))continue;
          if(type!=='notify')continue;
          if(!m.message)continue;
          // Allow only the linked account itself to issue commands from its own self-chat.
          // Other fromMe messages are ignored to prevent bot loops.
          if(m.key.fromMe){
            const text=textOf(m);
            const parsed=parseCommand(text,getSettings().prefix);
            const selfJid=jidNormalizedUser(thisSock.user?.id||thisSock.user?.phoneNumber||'');
            const ctx=contextFor(userId);
            if(ctx.outgoingIds?.has(m.key.id)){ctx.outgoingIds.delete(m.key.id);continue;}
            const selfIds=botIdentityCandidates();
            const ownValues=[m.key.remoteJid,m.key.remoteJidAlt,m.key.participant,m.key.participantAlt].filter(Boolean);
            let ownChat=m.key.remoteJid==='status@broadcast'||ownValues.some(x=>selfIds.some(me=>sameJid(x,me)));
            if(!ownChat){
              for(const value of ownValues){
                try{const resolved=await resolvePhoneJid(value);if(resolved&&selfIds.some(me=>sameJid(resolved,me))){ownChat=true;break;}}catch{}
              }
            }
            if(m.key.fromMe && text && (text.startsWith('.')||isAllCommandsTrigger(text)||isMenuTrigger(text)||isFullCommandsTrigger(text)||/^\d+$/.test(normalizeMenuText(text)))) ownChat=true;
            if(ownChat && mediaMessageInfo(m.message)?.type==='image')ctx.lastSelfImage={message:m,timestamp:Date.now()};
            if(ownChat){
              const liveSettings=getSettings();
              if(isAllCommandsTrigger(text)||isMenuTrigger(text)){await sendMenu(m.key.remoteJid||selfJid,liveSettings.language,liveSettings.prefix,m);continue;}
              if(isFullCommandsTrigger(text)){await reactToIncoming(jid,m,'🔥');await sendCommandCatalog(m.key.remoteJid||selfJid,liveSettings,m);continue;}
              if(await handlePendingMediaSelection(m,m.key.remoteJid||selfJid,text,liveSettings))continue;
              if(await handleMenuNumber(m,m.key.remoteJid||selfJid,text,liveSettings))continue;
            }
            if(ownChat && parsed){
              const settings=getSettings();
              if(parsed.command==='setprofile_pic' && !getQuotedMessage(m) && ctx.lastSelfImage && Date.now()-ctx.lastSelfImage.timestamp<30*60*1000){
                m.message={...m.message,extendedTextMessage:{text,contextInfo:{quotedMessage:ctx.lastSelfImage.message.message,stanzaId:ctx.lastSelfImage.message.key.id,participant:selfJid}}};
              }
              await handleCommand(m,m.key.remoteJid||selfJid,selfJid,text,settings);
            }
            // Do not feed ordinary outgoing messages into AI; only explicit dot-commands are allowed in self-chat.
            continue;
          }
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
            if(settings.muted?.[`${jid}:${sender}`]&&!senderAdmin){if(isBotAdmin)await thisSock.sendMessage(jid,{delete:m.key}).catch(()=>{});continue}
            if(!senderAdmin&&gc.antiflood&&floodHit(jid,sender,text)){if(isBotAdmin)await thisSock.sendMessage(jid,{delete:m.key}).catch(()=>{});await reply(jid,'🚨 تم حذف رسالة بسبب التكرار السريع.').catch(()=>{});continue}
            if(!senderAdmin&&gc.antispam&&spamHit(jid,sender,text)){if(isBotAdmin)await thisSock.sendMessage(jid,{delete:m.key}).catch(()=>{});await reply(jid,'🚫 تم حذف الرسالة بسبب السبام المتكرر.').catch(()=>{});continue}
            const mentioned=m.message?.extendedTextMessage?.contextInfo?.mentionedJid||[];
            if(!senderAdmin&&gc.antitag&&mentioned.length>=8){if(isBotAdmin)await thisSock.sendMessage(jid,{delete:m.key}).catch(()=>{});await reply(jid,'🚫 تم حذف الرسالة بسبب منشن جماعي.').catch(()=>{});continue}
            if(!senderAdmin&&gc.antilink&&/(?:https?:\/\/|www\.|chat\.whatsapp\.com\/)/i.test(text)){
              if(isBotAdmin){await thisSock.sendMessage(jid,{delete:m.key}).catch(()=>{});await reply(jid,settings.language==='ar'?'🚫 تم حذف الرابط.':'🚫 Link removed.',{quoted:m}).catch(()=>{})}continue;
            }
            if(!senderAdmin&&gc.antibadword&&(settings.badwords||[]).some(w=>w&&text.toLowerCase().includes(w.toLowerCase()))){if(isBotAdmin)await thisSock.sendMessage(jid,{delete:m.key}).catch(()=>{});continue}
          }
          if(isAllCommandsTrigger(text)){await reactToIncoming(jid,m,'🔥');await sendMenu(jid,settings.language,settings.prefix,m);continue;}
          if(isFullCommandsTrigger(text)){await reactToIncoming(jid,m,'🔥');await sendCommandCatalog(jid,settings,m);continue;}
          if(isMenuTrigger(text)){await reactToIncoming(jid,m,'🔥');await sendMenu(jid,settings.language,settings.prefix,m);continue;}
          if(await handlePendingMediaSelection(m,jid,text,settings))continue;
          if(await handleMenuNumber(m,jid,text,settings))continue;
          const reaction=commandReaction(text,settings.prefix);
          if(reaction)await reactToIncoming(jid,m,reaction);
          if(await handleCommand(m,jid,sender,text,settings)){if(reaction==='🔎')await reactToIncoming(jid,m,'✅');continue;}
          await maybeAI(m,jid,sender,text,settings);
        }catch(err){emit({type:'error',message:String(err?.message||err)})}
      }
    }));
    newSock.ev.on('group-participants.update',async(update)=>runAs(userId,async()=>{
      try{
        const {id,participants=[],action}=update;
        if(action!=='add'||!id||!Array.isArray(participants)||!participants.length)return;
        const settings=getSettings();const gc=groupConfig(settings,id);
        if(!gc.welcome)return;
        let groupName='المجموعة';
        try{groupName=(await newSock.groupMetadata(id))?.subject||groupName;}catch(e){logger.warn({err:String(e)},'welcome metadata unavailable');}
        for(const participant of participants){
          const p=typeof participant==='string'?participant:(participant?.id||participant?.jid||participant?.phoneNumber||participant?.lid);
          if(!p)continue;
          const jid=String(p);
          const number=jid.split('@')[0].split(':')[0];
          const template=gc.welcomeText||'👋 أهلاً {user} في {group}!';
          const message=template.replace(/\{user\}/gi,`@${number}`).replace(/\{group\}/gi,groupName);
          try{await newSock.sendMessage(id,{text:`👋 *مرحبًا بالعضو الجديد*\n\n${message}\n\n『˼فلو تيك˹ ❘❘ ˼𝙵𝙻𝙾𝚆𝚃𝙴𝙲𝙷˹』`,mentions:[jid]});}
          catch(e){logger.error({err:String(e),group:id},'welcome send failed');emit({type:'error',message:`Welcome failed: ${String(e?.message||e)}`});}
        }
      }catch(e){logger.error({err:String(e)},'welcome event failed');}
    }));
    return newSock;
  });
}

export async function requestPairingCode(userId,phone){
  const c=contextFor(userId);
  return runAs(userId,async()=>{
    if(!phone)throw new Error('أدخل رقم الهاتف أولاً.');
    const number=String(phone).replace(/\D/g,'');
    if(number.length<8||number.length>15)throw new Error('استخدم الرقم الدولي بدون + أو مسافات أو شرطات. مثال: 9677xxxxxxxx');
    if(!c.sock || c.state==='disconnected')await startBot(userId);
    if(c.currentAuthState?.creds?.registered||c.state==='connected')throw new Error('الجلسة مرتبطة بالفعل. افصل الجلسة أولاً إذا أردت ربط رقم جديد.');
    const target=c.sock;
    if(c.pairingReadyPromise)await Promise.race([c.pairingReadyPromise,new Promise(r=>setTimeout(r,15000))]);
    if(target!==c.sock)throw new Error('تم إعادة إنشاء اتصال واتساب، اضغط طلب الكود مرة أخرى.');
    if(c.state==='disconnected')throw new Error(`اتصال واتساب أغلق قبل إصدار الكود${c.lastDisconnect?.code?` (${c.lastDisconnect.code})`:''}. اضغط إعادة الاتصال.`);
    try{target.authState.creds.browser=Browsers.windows('Chrome');}catch{}
    await new Promise(r=>setTimeout(r,1500));
    c.pairingCode=await target.requestPairingCode(number);
    emit({type:'pairing',...getBotState(userId)});
    return c.pairingCode;
  });
}
export async function logout(userId){
  const c=contextFor(userId);
  return runAs(userId,async()=>{
    if(c.sock){try{await c.sock.logout()}catch{}}
    const sessionDir=path.join(sessionsRoot,String(userId).replace(/[^a-zA-Z0-9_-]/g,'_'),'session');
    fs.rmSync(sessionDir,{recursive:true,force:true});
    c.state='disconnected';c.qrData=null;c.pairingCode=null;c.currentAuthState=null;c.sock=null;c.lastDisconnect=null;c.starting=false;
    emit({type:'state',...getBotState(userId)});
  });
}
export function startAllBots(userIds){return Promise.all(userIds.map(id=>startBot(id).catch(e=>{emit({type:'error',userId:id,message:e?.message||String(e)});return null})))}

