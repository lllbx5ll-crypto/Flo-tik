import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState, jidNormalizedUser, isJidGroup } from '@whiskeysockets/baileys';
import P from 'pino';
import QRCode from 'qrcode';
import fs from 'node:fs';
import { getSettings, saveSettings } from './store.js';
import { labels, tr, normalizeLang } from './i18n.js';
import { askAI } from './ai.js';

const logger=P({level:process.env.LOG_LEVEL||'warn'});
let sock=null, qrData=null, pairingCode=null, state='disconnected', starting=false, currentAuthState=null;
const events=new Set();
export function onBotEvent(fn){events.add(fn);return()=>events.delete(fn)}
function emit(payload){for(const fn of events){try{fn(payload)}catch{}}}
export function getBotState(){return{state,qrData,pairingCode,connected:state==='connected',phone:sock?.user?.id||null}}
export function getSocket(){return sock}

const aliases={};
for(const [lang,map] of Object.entries(labels))for(const [key,word] of Object.entries(map))aliases[word.toLowerCase()]=key;
function parseCommand(text,prefix){if(!text?.startsWith(prefix))return null;const raw=text.slice(prefix.length).trim();if(!raw)return null;const [command,...args]=raw.split(/\s+/);return{command:aliases[command.toLowerCase()]||command.toLowerCase(),args,raw}}
function textOf(m){return m.message?.conversation||m.message?.extendedTextMessage?.text||m.message?.imageMessage?.caption||m.message?.videoMessage?.caption||m.message?.documentMessage?.caption||''}
function interactiveId(m){
  const r=m.message?.interactiveResponseMessage;
  if(r){try{const p=JSON.parse(r.nativeFlowResponseMessage?.paramsJson||'{}');return p.id||p.selected_row_id||p.button_id||p.display_text||''}catch{}}
  const b=m.message?.buttonsResponseMessage?.selectedButtonId; if(b)return b;
  const l=m.message?.listResponseMessage?.singleSelectReply?.selectedRowId; if(l)return l;
  return '';
}
function isStatusMessage(m){const jid=m.key?.remoteJid||'';return jid==='status@broadcast'||jid.endsWith('@broadcast')||Boolean(m.message?.statusMentionMessage)}
function statusKey(m){return `${m.key?.remoteJid||''}:${m.key?.id||''}:${m.key?.participant||m.key?.remoteJidAlt||''}`}
function isAdmin(meta,jid){return meta.participants.some(p=>jidNormalizedUser(p.id)===jidNormalizedUser(jid)&&['admin','superadmin'].includes(p.admin))}
async function groupContext(jid){const meta=await sock.groupMetadata(jid);const me=jidNormalizedUser(sock.user?.id||'');const participant=meta.participants.find(p=>jidNormalizedUser(p.id)===me);return{meta,isBotAdmin:['admin','superadmin'].includes(participant?.admin)}}
function targetFromMessage(m,args){const ctx=m.message?.extendedTextMessage?.contextInfo;const list=ctx?.mentionedJid||[];if(list[0])return jidNormalizedUser(list[0]);if(ctx?.participant)return jidNormalizedUser(ctx.participant);const num=args.find(a=>/^\d{7,15}$/.test(a.replace(/\D/g,'')));return num?`${num.replace(/\D/g,'')}@s.whatsapp.net`:null}
async function reply(jid,text,opts={}){return sock.sendMessage(jid,{text:String(text)},opts)}

function menuContent(lang,prefix){
  const rows=[
    {header:'🤖',title:lang==='ar'?'الأساسيات':'Basics',description:`${prefix}ping • ${prefix}status • ${prefix}info`,id:'menu_basic'},
    {header:'👥',title:lang==='ar'?'إدارة المجموعة':'Group Management',description:lang==='ar'?'طرد وترقية وتحذير وتاج للجميع':'Kick, promote, warn and tag all',id:'menu_group'},
    {header:'🛡️',title:lang==='ar'?'الحماية':'Protection',description:lang==='ar'?'الروابط والكلمات والترحيب':'Links, words and welcome',id:'menu_protection'},
    {header:'👁️',title:lang==='ar'?'الحالات':'Statuses',description:lang==='ar'?'مشاهدة وتفاعل تلقائي':'Auto view and react',id:'menu_status'},
    {header:'🧠',title:'AI',description:lang==='ar'?'رد آلي بالذكاء الاصطناعي':'AI auto replies',id:'menu_ai'},
    {header:'⚙️',title:lang==='ar'?'الإعدادات':'Settings',description:lang==='ar'?'اللغة والبادئة':'Language and prefix',id:'menu_settings'}
  ];
  return {interactiveMessage:{header:{title:'FLOWTECH',hasMediaAttachment:false},body:{text:lang==='ar'?'اختر خدمة من القائمة التفاعلية:':'Choose a service from the interactive menu:'},footer:{text:'FlowTech • WhatsApp'},nativeFlowMessage:{buttons:[{name:'single_select',buttonParamsJson:JSON.stringify({title:lang==='ar'?'فتح القائمة':'Open Menu',sections:[{title:lang==='ar'?'الخدمات':'Services',rows}]})},{name:'quick_reply',buttonParamsJson:JSON.stringify({display_text:'🏓 Ping',id:'cmd_ping'})},{name:'quick_reply',buttonParamsJson:JSON.stringify({display_text:'🧠 AI',id:'cmd_ai'})}]}}};
}
async function sendMenu(jid,lang,prefix,quoted){
  const content=menuContent(lang,prefix);
  try{return await sock.sendMessage(jid,content,{quoted})}catch{
    return reply(jid,`╭─〔 FLOWTECH 〕─╮\n${menuText(lang,prefix)}\n╰────────────────╯`,{quoted});
  }
}
function menuText(lang,prefix){return `${prefix}menu / ${prefix}قائمة\n${prefix}ping / ${prefix}بينغ\n${prefix}status / ${prefix}حالة\n${prefix}owner / ${prefix}المطور\n${prefix}info / ${prefix}معلومات\n${prefix}language ar|en|fr / ${prefix}لغة\n${prefix}prefix ! / ${prefix}بادئة\n\n👥 ${prefix}groupinfo • ${prefix}admins • ${prefix}members\n${prefix}tagall • ${prefix}kick @user • ${prefix}promote @user • ${prefix}demote @user\n${prefix}add 9677xxxxxxxx • ${prefix}remove @user\n${prefix}lock • ${prefix}unlock • ${prefix}setname • ${prefix}setdesc\n${prefix}linkgroup • ${prefix}revoke\n\n⚠️ ${prefix}warn @user • ${prefix}warnings • ${prefix}clearwarn @user\n${prefix}mute @user • ${prefix}unmute @user\n\n🛡️ ${prefix}protect • ${prefix}unprotect\n${prefix}antilink on|off • ${prefix}antibadword on|off • ${prefix}welcome on|off\n\n👁️ ${prefix}statusview on|off • ${prefix}statusreact ❤️\n🧠 ${prefix}ai on|off • ${prefix}ai provider openai|gemini • ${prefix}ai ask سؤالك\n💬 ${prefix}react ❤️ (بالرد) • ${prefix}delete (بالرد)`}

async function handleInteractive(m,jid,settings){
  const id=interactiveId(m);if(!id)return false;const lang=settings.language;
  if(id==='cmd_ping')return handleCommand(m,jid,m.key.participant||jid,`${settings.prefix}ping`,settings);
  if(id==='cmd_ai'){settings.aiEnabled=!settings.aiEnabled;saveSettings(settings);await reply(jid,settings.aiEnabled?(lang==='ar'?'🧠 تم تشغيل الرد الذكي.':'🧠 AI replies enabled.'):(lang==='ar'?'🧠 تم إيقاف الرد الذكي.':'🧠 AI replies disabled.'),{quoted:m});return true}
  const maps={menu_basic:`${settings.prefix}menu_basic`,menu_group:`${settings.prefix}menu_group`,menu_protection:`${settings.prefix}menu_protection`,menu_status:`${settings.prefix}menu_status`,menu_ai:`${settings.prefix}menu_ai`,menu_settings:`${settings.prefix}menu_settings`};
  if(maps[id]){await handleCommand(m,jid,m.key.participant||jid,maps[id],settings);return true}
  return false;
}

async function handleCommand(m,jid,sender,text,settings){
  const parsed=parseCommand(text,settings.prefix);if(!parsed)return false;const{command,args}=parsed;const lang=settings.language;const group=isJidGroup(jid);const send=x=>reply(jid,x,{quoted:m});
  if(command==='menu'||command==='help'){await sendMenu(jid,lang,settings.prefix,m);return true}
  if(command==='ping'){await send(`🏓 ${tr(lang,'ping')}`);return true}
  if(command==='status'){await send(`📡 ${tr(lang,'status')}\n${tr(lang,'prefix')}: ${settings.prefix}\n${tr(lang,'language')}: ${lang}\n👁️ Status view: ${settings.statusAutoView?'ON':'OFF'}\n❤️ Status reaction: ${settings.statusAutoReact?'ON':'OFF'}\n🧠 AI: ${settings.aiEnabled?'ON':'OFF'}`);return true}
  if(command==='owner'){await send(`👤 ${tr(lang,'owner')}: ${process.env.DEVELOPER_NAME||'FlowTech Team'}\n📱 https://wa.me/${process.env.CONTACT_PHONE||process.env.OWNER_PHONE||''}`);return true}
  if(command==='info'){await send(`🤖 FlowTech\n${tr(lang,'owner')}: ${process.env.DEVELOPER_NAME||'FlowTech Team'}\n🌐 ${process.env.PUBLIC_URL||'Local / private'}`);return true}
  if(command==='menu_basic'){await send(`${settings.prefix}ping\n${settings.prefix}status\n${settings.prefix}owner\n${settings.prefix}info`);return true}
  if(command==='menu_group'){await send(`${settings.prefix}kick @user\n${settings.prefix}promote @user\n${settings.prefix}demote @user\n${settings.prefix}warn @user\n${settings.prefix}tagall`);return true}
  if(command==='menu_protection'){await send(`${settings.prefix}antilink on|off\n${settings.prefix}antibadword on|off\n${settings.prefix}welcome on|off`);return true}
  if(command==='menu_status'){await send(`${settings.prefix}statusview on|off\n${settings.prefix}statusreact on|off\n${settings.prefix}statusreact ❤️|😂|🔥|😍|😮|😢|👏`);return true}
  if(command==='menu_ai'){await send(`${settings.prefix}ai on|off\n${settings.prefix}ai provider openai|gemini\n${settings.prefix}ai ask سؤالك`);return true}
  if(command==='menu_settings'){await send(`${settings.prefix}language ar|en|fr\n${settings.prefix}prefix !`);return true}
  if(command==='groupinfo'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);await send(`👥 ${meta.subject}\n🆔 ${jid}\n👤 الأعضاء: ${meta.participants.length}\n👮 المشرفون: ${meta.participants.filter(p=>['admin','superadmin'].includes(p.admin)).length}`);return true}
  if(command==='admins'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);const a=meta.participants.filter(p=>['admin','superadmin'].includes(p.admin));await sock.sendMessage(jid,{text:'👮 المشرفون:\n'+a.map(x=>'@'+x.id.split('@')[0]).join('\n'),mentions:a.map(x=>x.id)},{quoted:m});return true}
  if(command==='members'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);await send(`👥 عدد الأعضاء: ${meta.participants.length}`);return true}
  if(command==='linkgroup'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta,isBotAdmin}=await groupContext(jid);if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}const code=await sock.groupInviteCode(jid);await send(`🔗 رابط المجموعة:\nhttps://chat.whatsapp.com/${code}`);return true}
  if(command==='revoke'){if(!group){await send(tr(lang,'groupOnly'));return true}const {isBotAdmin}=await groupContext(jid);if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}await sock.groupRevokeInvite(jid);await send('🔐 تم إبطال رابط الدعوة السابق وإنشاء رابط جديد.');return true}
  if(command==='setname'){if(!group){await send(tr(lang,'groupOnly'));return true}const {isBotAdmin}=await groupContext(jid);if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}const name=args.join(' ').trim();if(!name){await send(`${settings.prefix}setname الاسم الجديد`);return true}await sock.groupUpdateSubject(jid,name);await send('✅ تم تغيير اسم المجموعة.');return true}
  if(command==='setdesc'){if(!group){await send(tr(lang,'groupOnly'));return true}const {isBotAdmin}=await groupContext(jid);if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}const desc=args.join(' ').trim();if(!desc){await send(`${settings.prefix}setdesc الوصف الجديد`);return true}await sock.groupUpdateDescription(jid,desc);await send('✅ تم تحديث وصف المجموعة.');return true}
  if(command==='lock'||command==='unlock'){if(!group){await send(tr(lang,'groupOnly'));return true}const {isBotAdmin}=await groupContext(jid);if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}await sock.groupSettingUpdate(jid,command==='lock'?'announcement':'not_announcement');await send(command==='lock'?'🔒 تم قفل المجموعة للمشرفين.':'🔓 تم فتح المجموعة للأعضاء.');return true}
  if(command==='add'||command==='remove'){if(!group){await send(tr(lang,'groupOnly'));return true}const {isBotAdmin}=await groupContext(jid);if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}const target=targetFromMessage(m,args);if(!target){await send(`${settings.prefix}${command} 9677XXXXXXXX`);return true}await sock.groupParticipantsUpdate(jid,[target],command==='add'?'add':'remove');await send(command==='add'?'➕ تمت محاولة إضافة العضو.':'❌ تمت إزالة العضو.');return true}
  if(command==='warnings'){const {meta}=group?await groupContext(jid):{meta:null};if(!group){await send(tr(lang,'groupOnly'));return true}const entries=Object.entries(settings.warnings||{}).filter(([k])=>k.startsWith(jid+':'));if(!entries.length){await send('✅ لا توجد تحذيرات مسجلة.');return true}await send('⚠️ التحذيرات:\n'+entries.map(([k,v])=>'@'+k.split(':').pop().split('@')[0]+' — '+v).join('\n'));return true}
  if(command==='clearwarn'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);if(!isAdmin(meta,sender)){await send(tr(lang,'adminOnly'));return true}const target=targetFromMessage(m,args);if(!target){await send(`${settings.prefix}clearwarn @user`);return true}delete settings.warnings[`${jid}:${target}`];saveSettings(settings);await send('✅ تم مسح تحذيرات العضو.');return true}
  if(command==='react'){const ctx=m.message?.extendedTextMessage?.contextInfo;const id=ctx?.stanzaId;if(!id){await send(`${settings.prefix}react ❤️ بالرد على رسالة`);return true}const emoji=(args[0]||'❤️').slice(0,8);await sock.sendMessage(jid,{react:{text:emoji,key:{remoteJid:jid,id,fromMe:false,participant:ctx.participant||sender}}});return true}
  if(command==='delete'){const ctx=m.message?.extendedTextMessage?.contextInfo;if(!ctx?.stanzaId){await send(`${settings.prefix}delete بالرد على الرسالة`);return true}const {isBotAdmin}=group?await groupContext(jid):{isBotAdmin:false};if(group&&!isBotAdmin){await send(tr(lang,'noPermission'));return true}await sock.sendMessage(jid,{delete:{remoteJid:jid,id:ctx.stanzaId,fromMe:false,participant:ctx.participant||sender}});return true}
  if(command==='mute'||command==='unmute'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta,isBotAdmin}=await groupContext(jid);if(!isAdmin(meta,sender)){await send(tr(lang,'adminOnly'));return true}if(!isBotAdmin){await send(tr(lang,'noPermission'));return true}const target=targetFromMessage(m,args);if(!target){await send(`${settings.prefix}${command} @user`);return true}settings.muted=settings.muted||{};const key=`${jid}:${target}`;if(command==='mute')settings.muted[key]=true;else delete settings.muted[key];saveSettings(settings);await send(command==='mute'?'🔇 تم كتم العضو. سيتم حذف رسائله تلقائيًا.':'🔊 تم إلغاء كتم العضو.');return true}
  if(command==='protect'||command==='unprotect'){if(!group){await send(tr(lang,'groupOnly'));return true}const {meta}=await groupContext(jid);if(!isAdmin(meta,sender)){await send(tr(lang,'adminOnly'));return true}const on=command==='protect';settings.antilink=on;settings.antibadword=on;settings.welcome=on;saveSettings(settings);await send(on?'🛡️ تم تفعيل حزمة الحماية الأساسية.':'🛡️ تم إيقاف حزمة الحماية الأساسية.');return true}
  if(command==='language'){const next=normalizeLang(args[0]);settings.language=next;saveSettings(settings);await send(`🌐 ${tr(next,'language')}: ${next}`);return true}
  if(command==='prefix'){const next=args[0];if(!next||next.length>3){await send(`${tr(lang,'usage')}: ${settings.prefix}prefix !`);return true}settings.prefix=next;saveSettings(settings);await send(`⚙️ ${tr(lang,'prefix')}: ${next}`);return true}
  if(command==='statusview'||command==='statusreact'){
    if(command==='statusview'){const on=['on','enable','1','تشغيل','تفعيل','نعم'].includes((args[0]||'').toLowerCase());settings.statusAutoView=on;saveSettings(settings);await send(on?'👁️ Auto status viewing enabled.':'👁️ Auto status viewing disabled.');return true}
    const first=(args[0]||'').toLowerCase();const toggles=['on','enable','1','تشغيل','تفعيل','نعم','off','disable','0','إيقاف','تعطيل','لا'];
    if(first&&!toggles.includes(first))settings.statusReaction=args[0];else settings.statusAutoReact=['on','enable','1','تشغيل','تفعيل','نعم'].includes(first);
    if(args[1]&&!toggles.includes(args[1].toLowerCase()))settings.statusReaction=args[1];
    saveSettings(settings);await send(settings.statusAutoReact?`❤️ Auto status reaction enabled: ${settings.statusReaction}`:'❤️ Auto status reaction disabled.');return true;
  }
  if(command==='ai'){
    if(args[0]==='provider'){const p=(args[1]||'').toLowerCase();if(!['openai','gemini'].includes(p)){await send('provider: openai | gemini');return true}settings.aiProvider=p;saveSettings(settings);await send(`🧠 AI provider: ${p}`);return true}
    if(args[0]==='on'||args[0]==='off'||['تشغيل','إيقاف','تفعيل','تعطيل'].includes(args[0])){settings.aiEnabled=['on','تشغيل','تفعيل'].includes(args[0]);saveSettings(settings);await send(settings.aiEnabled?'🧠 AI enabled.':'🧠 AI disabled.');return true}
    if(args[0]==='ask'){const prompt=args.slice(1).join(' ');try{const out=await askAI({provider:settings.aiProvider,model:settings.aiModel,prompt,system:settings.aiSystemPrompt});await send(`🧠 ${out.text}`)}catch(e){await send(`❌ AI: ${e.message}`)}return true}
    await send(`🧠 ${settings.aiEnabled?'ON':'OFF'} • ${settings.aiProvider}\nUse ${settings.prefix}ai on|off or ${settings.prefix}ai ask ...`);return true;
  }
  if(['antilink','antibadword','welcome'].includes(command)){
    const on=['on','enable','1','تشغيل','تفعيل','نعم'].includes((args[0]||'').toLowerCase());settings[command]=on;saveSettings(settings);const map={antilink:[tr(lang,'antiLinkOn'),tr(lang,'antiLinkOff')],antibadword:[tr(lang,'antiBadOn'),tr(lang,'antiBadOff')],welcome:[tr(lang,'welcomeOn'),tr(lang,'welcomeOff')]};await send(on?map[command][0]:map[command][1]);return true;
  }
  if(!group){if(settings.aiEnabled&&text){try{const out=await askAI({provider:settings.aiProvider,model:settings.aiModel,prompt:text,system:settings.aiSystemPrompt});if(out.text)await send(`🧠 ${out.text}`)}catch(e){await send(`⚠️ AI غير متاح: ${e.message}`)}}else await send(tr(lang,'groupOnly'));return true}
  const {meta,isBotAdmin}=await groupContext(jid);const admin=isAdmin(meta,sender);
  if(['kick','promote','demote','warn','tagall'].includes(command)&&!admin){await send(tr(lang,'adminOnly'));return true}
  if(['kick','promote','demote'].includes(command)&&!isBotAdmin){await send(tr(lang,'noPermission'));return true}
  if(command==='kick'||command==='promote'||command==='demote'||command==='warn'){
    const target=targetFromMessage(m,args);if(!target){await send(tr(lang,'userMissing'));return true}
    if(command==='kick')await sock.groupParticipantsUpdate(jid,[target],'remove');
    if(command==='promote')await sock.groupParticipantsUpdate(jid,[target],'promote');
    if(command==='demote')await sock.groupParticipantsUpdate(jid,[target],'demote');
    if(command==='warn'){const key=`${jid}:${target}`;settings.warnings[key]=(settings.warnings[key]||0)+1;const count=settings.warnings[key];saveSettings(settings);if(count>=3&&isBotAdmin){await sock.groupParticipantsUpdate(jid,[target],'remove').catch(()=>{});delete settings.warnings[key];saveSettings(settings);await send(`🚫 تم بلوغ 3 تحذيرات، وتمت إزالة العضو.`)}else await send(`⚠️ ${tr(lang,'warned')} ${count}/3`);return true}
    await send(tr(lang,command==='kick'?'kicked':command==='promote'?'promoted':'demoted'));return true;
  }
  if(command==='tagall'){const mentions=meta.participants.map(p=>p.id);const body=mentions.map(j=>`@${j.split('@')[0]}`).join(' ');await sock.sendMessage(jid,{text:`📢 ${tr(lang,'tagall')}\n${body}`,mentions},{quoted:m});return true}
  if(settings.aiEnabled&&text&&(!group||settings.aiGroupMode==='all'||text.includes('@'+(sock.user?.id||'').split('@')[0]))){try{const out=await askAI({provider:settings.aiProvider,model:settings.aiModel,prompt:text.replace(/@\d+/g,'').trim(),system:settings.aiSystemPrompt});if(out.text)await send(`🧠 ${out.text}`)}catch(e){emit({type:'error',message:e.message})};return true}
  await send(tr(lang,'unknown'));return true;
}

async function handleStatus(m){
  const settings=getSettings();if(!isStatusMessage(m))return false;
  const key=statusKey(m);const seen=new Set(settings.seenStatuses||[]);if(seen.has(key))return true;
  if(settings.statusAutoView){try{await sock.readMessages([m.key])}catch(e){emit({type:'status_error',message:`view: ${e.message}`})}}
  if(settings.statusAutoReact){try{await sock.sendMessage(m.key.remoteJid||'status@broadcast',{react:{text:settings.statusReaction||'❤️',key:m.key}});emit({type:'status_reaction',reaction:settings.statusReaction,key})}catch(e){emit({type:'status_error',message:`reaction: ${e.message}`})}}
  seen.add(key);settings.seenStatuses=[...seen].slice(-500);saveSettings(settings);emit({type:'status_seen',key,reaction:settings.statusAutoReact?settings.statusReaction:null});return true;
}

async function maybeAI(m,jid,sender,text,settings){
  if(!settings.aiEnabled||!text||text.startsWith(settings.prefix)||isStatusMessage(m))return false;
  const group=isJidGroup(jid);
  if(group&&settings.aiGroupMode==='mention'){
    const me=(sock.user?.id||'').split(':')[0].split('@')[0];const mentioned=m.message?.extendedTextMessage?.contextInfo?.mentionedJid||[];
    if(!mentioned.some(x=>x.includes(me)))return false;
  }
  if(!group&&!settings.aiPrivate)return false;
  try{const sessionKey=`${jid}:${sender}`;const prev=settings.aiSessions?.[sessionKey]||null;const out=await askAI({provider:settings.aiProvider,model:settings.aiModel,prompt:text.replace(/@\d+/g,'').trim(),system:settings.aiSystemPrompt,previousResponseId:prev});if(out.text)await reply(jid,`🧠 ${out.text}`,{quoted:m});if(out.responseId){settings.aiSessions=settings.aiSessions||{};settings.aiSessions[sessionKey]=out.responseId;saveSettings(settings)}return true}catch(e){emit({type:'ai_error',message:e.message});return false}
}

export async function startBot(){
  if(starting || (sock && state==='connected')) return sock;
  starting=true; state='connecting'; pairingCode=null; qrData=null; emit({type:'state',...getBotState()});
  fs.mkdirSync('./session',{recursive:true});
  const {state:authState,saveCreds}=await useMultiFileAuthState('./session');
  currentAuthState=authState;
  sock=makeWASocket({auth:authState,logger,browser:Browsers.ubuntu('FlowTech'),markOnlineOnConnect:false,syncFullHistory:false,generateHighQualityLinkPreview:false});
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',async({connection,lastDisconnect,qr})=>{
    if(qr){qrData=await QRCode.toDataURL(qr,{width:300,margin:1});emit({type:'qr',...getBotState()})}
    if(connection==='connecting'){state='connecting';emit({type:'state',...getBotState()})}
    if(connection==='open'){state='connected';qrData=null;pairingCode=null;starting=false;emit({type:'state',...getBotState()})}
    if(connection==='close'){
      const code=lastDisconnect?.error?.output?.statusCode;
      state='disconnected';starting=false;emit({type:'state',...getBotState()});
      if(code!==DisconnectReason.loggedOut)setTimeout(()=>startBot().catch(e=>emit({type:'error',message:e.message})),3000);
    }
  });
  sock.ev.on('messages.upsert',async({messages,type})=>{
    if(type!=='notify')return;
    for(const m of messages){
      try{
        if(!m.message)continue;
        if(await handleStatus(m))continue;
        if(m.key.fromMe)continue;
        const jid=m.key.remoteJid;if(!jid)continue;const sender=m.key.participant||jid;const settings=getSettings();
        const iid=interactiveId(m);
        if(iid){await handleInteractive(m,jid,settings);continue}
        const text=textOf(m);
        if(isJidGroup(jid)){
          const {meta,isBotAdmin}=await groupContext(jid);const senderAdmin=isAdmin(meta,sender);
          if(settings.muted?.[`${jid}:${sender}`]&&!senderAdmin){if(isBotAdmin)await sock.sendMessage(jid,{delete:m.key}).catch(()=>{});continue}
          if(!senderAdmin&&settings.antilink&&/(?:https?:\/\/|www\.|chat\.whatsapp\.com\/)/i.test(text)){
            if(isBotAdmin){await sock.sendMessage(jid,{delete:m.key});await reply(jid,settings.language==='ar'?'🚫 تم حذف الرابط.':'🚫 Link removed.',{quoted:m})}continue;
          }
          if(!senderAdmin&&settings.antibadword&&settings.badwords.some(w=>w&&text.toLowerCase().includes(w.toLowerCase()))){if(isBotAdmin)await sock.sendMessage(jid,{delete:m.key});continue}
        }
        if(await handleCommand(m,jid,sender,text,settings))continue;
        await maybeAI(m,jid,sender,text,settings);
      }catch(err){emit({type:'error',message:String(err?.message||err)})}
    }
  });
  sock.ev.on('group-participants.update',async({id,participants,action})=>{
    const settings=getSettings();if(!settings.welcome||action!=='add')return;
    const text=settings.language==='ar'?'👋 أهلاً بك في المجموعة!\nمرحبًا بك مع FlowTech.':settings.language==='fr'?'👋 Bienvenue dans le groupe avec FlowTech.':'👋 Welcome to the group with FlowTech.';
    for(const p of participants)await reply(id,`${text}\n@${p.split('@')[0]}`,{mentions:[p]}).catch(()=>{});
  });
  return sock;
}

export async function requestPairingCode(phone){
  if(!phone)throw new Error('Phone number is required');
  const number=phone.replace(/\D/g,'');if(number.length<8)throw new Error('Use international number without +, spaces or dashes.');
  if(!sock)await startBot();
  if(currentAuthState?.creds?.registered||state==='connected')throw new Error('Already connected.');
  await new Promise(r=>setTimeout(r,1200));
  pairingCode=await sock.requestPairingCode(number);emit({type:'pairing',...getBotState()});return pairingCode;
}
export async function logout(){if(sock){try{await sock.logout()}catch{}}fs.rmSync('./session',{recursive:true,force:true});state='disconnected';qrData=null;pairingCode=null;sock=null;emit({type:'state',...getBotState()});}
