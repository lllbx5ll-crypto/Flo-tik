import { runOfflineCommand } from './extra-utilities.js';
/**
 * Command handlers extracted from the WhatsApp connection lifecycle.
 * Dependencies are injected from the original runtime to preserve user-scoped
 * AsyncLocalStorage, Baileys socket proxy, storage, and existing behavior.
 */
export function createCommandHandlers(deps){
  const {AUTO_FOLLOW_CHANNEL_URL, LUXURY_COMMANDS, aliases, askAI, botIdentityCandidates, commandError, contextFor, currentUserId, downloadMediaMessage, fdroidSearch, getAIUserForMessage, getQuotedMessage, groupConfig, groupContext, handleInteractive, isAdmin, isJidGroup, jidNormalizedUser, logger, mediaMessageInfo, parseCommand, playSearchUrl, reply, safeCalc, sameJid, saveSettings, sendCommandCatalog, sendMenu, senderCandidates, senderPhone, setGroupConfig, setPendingMedia, socialInfo, sock, targetFromMessage, tr, ytSearch} = deps;
async function handleCommand(m,jid,sender,text,settings){
  const parsed=parseCommand(text,settings.prefix);if(!parsed)return false;const{command,args}=parsed;const lang=settings.language;const group=isJidGroup(jid);const send=x=>reply(jid,x,{quoted:m});
  if(await runOfflineCommand(command,args,send))return true;
  if(await handleExtraCommand(command,args,m,jid,sender,settings))return true;
  if(command==='menu'||command==='help'||command==='allcommands'){await sendMenu(jid,lang,settings.prefix,m);return true}
  if(command==='fullcommands'){await sendCommandCatalog(jid,settings,m);return true}
  if(command==='ping'){await send(`🏓 ${tr(lang,'ping')}`);return true}
  if(command==='alive'){await send(`⚡ FlowTech يعمل الآن.\n📡 ${contextFor().state}\n🕒 ${new Date().toLocaleTimeString('ar-YE')}`);return true}
  if(command==='runtime'){const uptime=Math.floor(process.uptime());const h=Math.floor(uptime/3600),m=Math.floor((uptime%3600)/60),sec=uptime%60;await send(`⏱️ مدة التشغيل: ${h}س ${m}د ${sec}ث`);return true}
  if(command==='start'||command==='restart'){await startBot(currentUserId());await send('♻️ تم طلب إعادة الاتصال.');return true}
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
    await send(`╭〔جميع الٲوامر 〕╮\n\n👑 المجموعة والإدارة\n${settings.prefix}معلومات_المجموعة • ${settings.prefix}معرف_المجموعة • ${settings.prefix}المشرفين • ${settings.prefix}الاعضاء • ${settings.prefix}منشن_الكل • ${settings.prefix}رابط • ${settings.prefix}تغيير_الرابط • ${settings.prefix}اسم • ${settings.prefix}وصف • ${settings.prefix}قفل • ${settings.prefix}فتح • ${settings.prefix}اضافة • ${settings.prefix}ازالة • ${settings.prefix}طرد • ${settings.prefix}ترقية • ${settings.prefix}تنزيل\n\n🛡️ الحماية\n${settings.prefix}حماية • ${settings.prefix}الغاء_الحماية • ${settings.prefix}منع_الروابط • ${settings.prefix}منع_الكلمات • ${settings.prefix}منع_التكرار • ${settings.prefix}منع_السبام • ${settings.prefix}منع_المنشن • ${settings.prefix}ترحيب • ${settings.prefix}اضافة_كلمة • ${settings.prefix}حذف_كلمة • ${settings.prefix}كلمات_ممنوعة • ${settings.prefix}حد_التحذير • ${settings.prefix}تحذير • ${settings.prefix}تحذيرات • ${settings.prefix}مسح_تحذير • ${settings.prefix}كتم • ${settings.prefix}فك_كتم • ${settings.prefix}حذف_رسالة\n\n❤️ الحالات\n${settings.prefix}مشاهدة_الحالات • ${settings.prefix}تفاعل_الحالات • ${settings.prefix}رد\n\n🧠 الذكاء\n${settings.prefix}ذكاء • ${settings.prefix}ذكاء_حسابي\n\n🤖 أساسية\n${settings.prefix}قائمة • ${settings.prefix}مساعدة • ${settings.prefix}بينغ • ${settings.prefix}حي • ${settings.prefix}حالة • ${settings.prefix}وقت_التشغيل • ${settings.prefix}المطور • ${settings.prefix}معلومات • ${settings.prefix}معرف • ${settings.prefix}تشغيل • ${settings.prefix}اعادة_تشغيل • ${settings.prefix}الوقت • ${settings.prefix}التاريخ • ${settings.prefix}حساب • ${settings.prefix}قل • ${settings.prefix}عكس • ${settings.prefix}عدد_الحروف • ${settings.prefix}القناة • ${settings.prefix}حالة_القناة • ${settings.prefix}رقم_البوت • ${settings.prefix}ذاكرة\n\n╰─────────────────╯`);
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
    const botIds=botIdentityCandidates();
    const authorized=botIds.some(id=>sameJid(id,sender)) || (m?.key?.fromMe===true);
    if(!authorized){await send('🔐 هذا الإعداد محمي. لا يمكن تغييره من المحادثة إلا من رقم واتساب المرتبط بالبوت.');return true;}
    if(command==='statusview'){const on=['on','enable','1','تشغيل','تفعيل','نعم'].includes((args[0]||'').toLowerCase());settings.statusAutoView=on;saveSettings(settings);await send(on?'👁️ تم تفعيل مشاهدة الحالات.':'👁️ تم إيقاف مشاهدة الحالات.');return true}
    const first=(args[0]||'').toLowerCase();const toggles=['on','enable','1','تشغيل','تفعيل','نعم','off','disable','0','إيقاف','تعطيل','لا'];
    if(first&&!toggles.includes(first))settings.statusReaction=args.join('').trim();else settings.statusAutoReact=['on','enable','1','تشغيل','تفعيل','نعم'].includes(first);
    if(args[1]&&!toggles.includes(args[1].toLowerCase()))settings.statusReaction=args.slice(1).join('').trim();
    saveSettings(settings);await send(settings.statusAutoReact?`❤️ تم تفعيل التفاعل التلقائي: ${settings.statusReaction}`:'❤️ تم إيقاف التفاعل التلقائي.');return true;
  }
  if(command==='aiconfig'){
    const key=senderPhone(sender)||senderPhone(jid)||'account';
    const cfg=settings.aiUsers?.[key]||settings.aiConfig||{};
    await send(`🧠 إعدادات الذكاء الاصطناعي\n🔑 الحساب: ${key}\n⚡ الحالة: ${cfg.enabled?'مفعّل':'متوقف'}\n🔌 المزود: ${cfg.provider||'غير محدد'}\n🤖 النموذج: ${cfg.model||'الافتراضي'}\n\nلتشغيله: ${settings.prefix}ذكاء تشغيل\nلإيقافه: ${settings.prefix}ذكاء إيقاف`);
    return true;
  }
  if(command==='ai'){
    const identity=await getAIUserForMessage(settings,m,jid,sender);const userKey=identity.key;settings.aiUsers=settings.aiUsers||{};const currentUser=identity.user||{};
    const arg=(args[0]||'').toLowerCase();
    if(['حسابي','account','settings','إعداداتي'].includes(arg)){await send(`🧠 إعداد AI لحسابك: ${currentUser?.enabled?'مفعّل':'متوقف'}\nالمزود: ${currentUser?.provider||'غير محدد'}\nالنموذج: ${currentUser?.model||'غير محدد'}\n🔐 المفتاح: ${currentUser?.apiKey?'محفوظ':'غير محفوظ'}`);return true;}
    if(['provider','مزود','المزود'].includes(arg)){
      const provider=String(args[1]||'').toLowerCase();if(!['gemini','openai'].includes(provider)){await send('الاستخدام: .ذكاء مزود gemini أو .ذكاء مزود openai');return true;}
      if(!userKey){await send('⚠️ تعذر تحديد رقم الحساب.');return true;}
      const model=provider==='gemini'?(currentUser.model?.startsWith('gemini-')?currentUser.model:'gemini-3.8-flash'):(currentUser.model?.startsWith('gpt-')?currentUser.model:'gpt-5.5');
      settings.aiConfig={...(settings.aiConfig||{}),provider,model}; if(userKey) {settings.aiUsers=settings.aiUsers||{};settings.aiUsers[userKey]={...(settings.aiUsers[userKey]||{}),...settings.aiConfig};} saveSettings(settings);await send(`✅ تم اختيار مزود ${provider} والنموذج ${model} لحسابك.`);return true;
    }
    if(['تشغيل','on','تفعيل'].includes(arg)){
      if(!userKey){await send('⚠️ تعذر تحديد رقم الحساب. أرسل الرسالة من حساب واتساب عادي ثم حاول مرة أخرى.');return true;}
      settings.aiConfig={...(settings.aiConfig||{}),enabled:true}; if(userKey){settings.aiUsers=settings.aiUsers||{};settings.aiUsers[userKey]={...(settings.aiUsers[userKey]||{}),...settings.aiConfig};} saveSettings(settings);await send('🧠 تم تشغيل الرد الذكي لحسابك.');return true;
    }
    if(['إيقاف','off','تعطيل'].includes(arg)){
      if(!userKey){await send('⚠️ تعذر تحديد رقم الحساب.');return true;}
      settings.aiConfig={...(settings.aiConfig||{}),enabled:false}; if(userKey){settings.aiUsers=settings.aiUsers||{};settings.aiUsers[userKey]={...(settings.aiUsers[userKey]||{}),...settings.aiConfig};} saveSettings(settings);await send('🧠 تم إيقاف الرد الذكي لحسابك.');return true;
    }
    if(['ask','سؤال'].includes(arg)||args.length){
      const prompt=(arg==='ask'||arg==='سؤال')?args.slice(1).join(' '):args.join(' ');
      const cfg=currentUser?.apiKey?{...currentUser,enabled:true}:null;
      if(!cfg?.apiKey){await send('⚠️ لا يوجد مفتاح API محفوظ لحسابك. أضف المفتاح من لوحة التحكم ثم اضغط «حفظ إعداد AI» و«اختبار المفتاح».');return true;}
      try{const out=await askAI({provider:cfg.provider,model:cfg.model,prompt,system:cfg.systemPrompt||settings.aiSystemPrompt,apiKey:cfg.apiKey});await send(`🧠 ${out.text||'لم يُرجع النموذج نصًا.'}`)}catch(e){await send(`❌ فشل الذكاء الاصطناعي: ${e.message}`)}return true;
    }
    await send(`🧠 إعداد AI لحسابك: ${currentUser?.enabled?'مفعّل':'متوقف'}\nالمزود: ${currentUser?.provider||'غير محدد'}\nالنموذج: ${currentUser?.model||'غير محدد'}\n🔐 المفتاح: ${currentUser?.apiKey?'محفوظ':'غير محفوظ'}`);return true;
  }
  if(command==='welcome_status'||command==='welcome_message'){
    if(!group){await send(tr(lang,'groupOnly'));return true;}
    const {meta}=await groupContext(jid);
    if(command==='welcome_message' && !isAdmin(meta,senderCandidates(m,sender))){await send(tr(lang,'adminOnly'));return true;}
    if(command==='welcome_status'){
      const cfg=groupConfig(settings,jid);
      await send(`👋 الترحيب: ${cfg.welcome?'مفعّل ✅':'متوقف ⛔'}\n📝 الرسالة: ${cfg.welcomeText}\n\n${settings.prefix}ترحيب تشغيل\n${settings.prefix}رسالة_الترحيب أهلاً {user} في {group}`);
    }else{
      const value=args.join(' ').trim();
      if(!value){await send(`📝 الاستخدام: ${settings.prefix}رسالة_الترحيب أهلاً {user} في {group}\nيمكنك استخدام {user} و{group}`);return true;}
      setGroupConfig(settings,jid,{welcomeText:value.slice(0,800)});
      await send('✅ تم حفظ رسالة الترحيب لهذه المجموعة.');
    }
    return true;
  }
  if(['antilink','antibadword','welcome','antiflood','antispam','antitag'].includes(command)){
    if(!group){await send(tr(lang,'groupOnly'));return true;}
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
  if(command==='nickname'){
    const name=args.join(' ').trim();
    const nicknames=['الأسطورة 😎','صاحب الهيبة 👑','الزعيم 🔥','أبو الضحكة 😂','النجم اللامع ✨','المبدع 🎯','القائد 🦁','صانع الأجواء 🎉','الغامض 🖤','الذيب 🐺','الكفو 💪','ملك المزاج 🕶️'];
    const nick=nicknames[Math.floor(Math.random()*nicknames.length)];
    await send(`🏷️ ${name?`لقب ${name} المقترح`:'لقبك المقترح'}: ${nick}`);return true;
  }
  if(command==='movefun'){
    const lines=['🕺 حركة اليوم: ادخل بثقة وكأن الموسيقى شغالة خلفك.','😂 حركة اليوم: قل «عندي خبر مهم» ثم أرسل ملصق ضحك.','😎 حركة اليوم: اختفِ خمس دقائق وارجع كأنك كنت في اجتماع سري.','🎭 حركة اليوم: رد على صديقك بعبارة «تم استلام المهمة يا قائد».','🔥 حركة اليوم: امدح شخصًا في المجموعة بدون مقدمات.'];
    await send(lines[Math.floor(Math.random()*lines.length)]);return true;
  }
  if(command==='funnyreply'){
    const lines=['😂 الرد الرسمي: جاري معالجة طلبك داخل قسم الضحك.','🤖 تم استلام الرسالة، وسيتم تحويلها إلى لجنة المزاج.','🫡 حاضر يا مدير السعادة، الأمر تحت السيطرة.','🤣 الرد: لا تعليق… الضحكة تتكلم عني.'];
    await send(lines[Math.floor(Math.random()*lines.length)]);return true;
  }
  if(command==='prankline'){
    const lines=['📣 إعلان عاجل: تم اختيارك مسؤول الضحك لهذا اليوم 😂','🚨 تنبيه: مستوى الهيبة عندك تجاوز الحد المسموح.','🕵️ مقلب خفيف: عندك رسالة سرية… ابتسم أولًا ثم تذكّر أن البوت يمزح 😄'];
    await send(lines[Math.floor(Math.random()*lines.length)]);return true;
  }
  if(command==='bioidea'){
    const bios=['✨ أترك أثرًا طيبًا أينما مررت.','🖤 هادئ، لكن أحلامي لا تعرف الهدوء.','⚡ نسخة لا تتكرر، وطموح لا يتوقف.','🌙 أعيش ببساطة وأحلم بما يستحق.'];
    await send(`📝 بايو مقترح:\n${bios[Math.floor(Math.random()*bios.length)]}`);return true;
  }
  if(command==='decorate'){
    const value=args.join(' ').trim();
    if(!value){await send(`✨ الاستخدام: ${settings.prefix}زخرفة القميشي`);return true;}
    const styles=[`『 ${value} 』`,`꧁༺ ${value} ༻꧂`,`𓆩 ${value} 𓆪`,`★彡 ${value} 彡★`,`♡ ${value} ♡`,`♛ ${value} ♛`];
    await send(`✨ زخارف مقترحة:\n${styles.join('\n')}`);return true;
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
  if(['kick','promote','demote','warn','tagall'].includes(command)){
    if(!group){await send(tr(lang,'groupOnly'));return true}
    const {meta,isBotAdmin}=await groupContext(jid);const admin=isAdmin(meta,senderCandidates(m,sender));
    if(!admin){await send(tr(lang,'adminOnly'));return true}
    if(['kick','promote','demote'].includes(command)&&!isBotAdmin){await send(tr(lang,'noPermission'));return true}
    if(command==='tagall'){
      const mentions=meta.participants.map(p=>p.id);const body=mentions.map(x=>'@'+String(x).split('@')[0]).join(' ');
      await sock.sendMessage(jid,{text:`📢 ${tr(lang,'tagall')}\n${body}`,mentions},{quoted:m});return true;
    }
    if(['kick','promote','demote','warn'].includes(command)){
      const target=targetFromMessage(m,args);if(!target){await send(tr(lang,'userMissing'));return true}
      try{
        if(command==='kick')await sock.groupParticipantsUpdate(jid,[target],'remove');
        if(command==='promote')await sock.groupParticipantsUpdate(jid,[target],'promote');
        if(command==='demote')await sock.groupParticipantsUpdate(jid,[target],'demote');
      }catch(e){await send(commandError(e));return true;}
      if(command==='warn'){
        const key=`${jid}:${target}`;settings.warnings=settings.warnings||{};settings.warnings[key]=(settings.warnings[key]||0)+1;const count=settings.warnings[key];const limit=groupConfig(settings,jid).warnLimit;saveSettings(settings);
        if(count>=limit&&isBotAdmin){await sock.groupParticipantsUpdate(jid,[target],'remove').catch(()=>{});delete settings.warnings[key];saveSettings(settings);await send(`🚫 تم بلوغ ${limit} تحذيرات، وتمت إزالة العضو.`)}else await send(`⚠️ ${tr(lang,'warned')} ${count}/${limit}`);
      } else await send(tr(lang,command==='kick'?'kicked':command==='promote'?'promoted':'demoted'));
      return true;
    }
  }
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

async function handleExtraCommand(command,args,m,jid,sender,settings){
  const send=x=>reply(jid,x,{quoted:m});
  const selfJid=jidNormalizedUser(sock?.user?.id||sock?.user?.phoneNumber||'');
  const selfAuthorized=Boolean(selfJid && (m?.key?.fromMe || sameJid(sender,selfJid) || sameJid(jid,selfJid)));
  const onArg=v=>['on','enable','1','تشغيل','تفعيل','نعم','ن'].includes(String(v||'').toLowerCase());
  const offArg=v=>['off','disable','0','إيقاف','تعطيل','لا','ل'].includes(String(v||'').toLowerCase());
  const needSelf=async()=>{if(!selfAuthorized){await send('🔐 هذا الأمر شخصي ولا يمكن تنفيذه إلا من رقم واتساب المرتبط بالبوت.');return false}return true};

  if(command==='weekday'){await send(`📅 اليوم: ${new Date().toLocaleDateString('ar-YE',{weekday:'long'})}`);return true}
  if(command==='month'){await send(`🗓️ الشهر: ${new Date().toLocaleDateString('ar-YE',{month:'long'})}`);return true}
  if(command==='year'){await send(`📆 السنة: ${new Date().getFullYear()}`);return true}
  if(command==='percent'){
    const a=Number(args[0]),b=Number(args[1]); if(!Number.isFinite(a)||!Number.isFinite(b)){await send(`📊 الاستخدام: ${settings.prefix}نسبة 25 200`);return true} await send(`📊 ${a} من ${b} = ${(a/b*100).toFixed(2)}%`);return true;
  }
  if(command==='discount'){
    const price=Number(args[0]),pct=Number(args[1]); if(!Number.isFinite(price)||!Number.isFinite(pct)){await send(`💸 الاستخدام: ${settings.prefix}خصم 1000 20`);return true} const d=price*pct/100;await send(`💸 السعر: ${price}
🔻 الخصم: ${pct}%
💰 بعد الخصم: ${(price-d).toFixed(2)}`);return true;
  }
  if(['average','max','min'].includes(command)){
    const nums=args.map(Number).filter(Number.isFinite); if(!nums.length){await send(`🔢 الاستخدام: ${settings.prefix}${command==='average'?'متوسط':' '+command} 10 20 30`);return true}
    const v=command==='average'?nums.reduce((a,b)=>a+b,0)/nums.length:command==='max'?Math.max(...nums):Math.min(...nums); await send(`🔢 النتيجة: ${v}`);return true;
  }
  if(command==='round'||command==='sqrt'||command==='square'||command==='power'){
    const a=Number(args[0]),b=Number(args[1]); if(!Number.isFinite(a)){await send(`🧮 الاستخدام: ${settings.prefix}${command} 25`);return true}
    const v=command==='round'?Math.round(a):command==='sqrt'?Math.sqrt(a):command==='square'?a*a:Math.pow(a,Number.isFinite(b)?b:2); await send(`🧮 النتيجة: ${Number.isFinite(v)?v:'غير صالحة'}`);return true;
  }
  if(command==='words'){const v=args.join(' ').trim();await send(`📝 عدد الكلمات: ${v?v.split(/\s+/).length:0}`);return true}
  if(command==='lines'){const v=args.join(' ');await send(`📄 عدد الأسطر: ${v?v.split(/\n/).length:0}`);return true}
  if(command==='trim'){await send(`🧹 ${args.join(' ').trim()}`);return true}
  if(command==='repeat'){const n=Math.max(1,Math.min(20,Number(args[0]||1)));const v=args.slice(1).join(' ');if(!v){await send(`🔁 الاستخدام: ${settings.prefix}تكرار 3 مرحبًا`);return true}await send(Array.from({length:n},()=>v).join('\n'));return true}
  if(command==='split'){const v=args.join(' ');if(!v){await send(`✂️ الاستخدام: ${settings.prefix}تقسيم نص`);return true}const parts=v.split(' ');await send(parts.map((x,i)=>`${i+1}. ${x}`).join('\n'));return true}
  if(command==='randomletters'){const n=Math.max(1,Math.min(30,Number(args[0]||8)));let out='';const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';for(let i=0;i<n;i++)out+=chars[Math.floor(Math.random()*chars.length)];await send(`🔤 ${out}`);return true}
  if(command==='randomcode'){const n=Math.max(4,Math.min(32,Number(args[0]||8)));let out='';const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';for(let i=0;i<n;i++)out+=chars[Math.floor(Math.random()*chars.length)];await send(`🔐 الرمز: ${out}`);return true}


  // Expanded local utility commands
  if(['version','accountid','whoami','aistatus','protectionstatus','botsettings','connectioncheck','reload','servertime'].includes(command)){
    if(command==='version')await send('🚀 FlowTech V31.2 • Baileys 7 RC14 • Node '+process.version);
    else if(command==='accountid')await send(`🆔 رقم الحساب المرتبط: ${senderPhone(selfJid)||selfJid||'غير متاح'}`);
    else if(command==='whoami')await send(`👤 أنت: ${senderPhone(sender)||sender}`);
    else if(command==='aistatus')await send(`🧠 AI: ${settings.aiEnabled?'مفعّل':'متوقف'} • مزود الحساب: ${settings.aiConfig?.provider||'غير محدد'}`);
    else if(command==='protectionstatus'){
      const g=isJidGroup(jid)?groupConfig(settings,jid):null;
      await send(g?`🛡️ حماية المجموعة:\nالروابط: ${g.antilink?'ON':'OFF'}\nالكلمات: ${g.antibadword?'ON':'OFF'}\nالتكرار: ${g.antiflood?'ON':'OFF'}\nالسبام: ${g.antispam?'ON':'OFF'}\nالمنشن: ${g.antitag?'ON':'OFF'}\nالترحيب: ${g.welcome?'ON':'OFF'}`:`🛡️ الإعداد العام: الروابط ${settings.antilink?'ON':'OFF'} • الكلمات ${settings.antibadword?'ON':'OFF'}`);
    } else if(command==='botsettings')await send(`⚙️ إعدادات البوت\nالبادئة: ${settings.prefix}\nاللغة: ${settings.language}\nمشاهدة الحالات: ${settings.statusAutoView?'ON':'OFF'}\nتفاعل الحالات: ${settings.statusAutoReact?'ON':'OFF'}`);
    else if(command==='connectioncheck')await send(`📡 الاتصال: ${contextFor().state}\n🤖 ${selfJid||'غير متاح'}`);
    else if(command==='reload'){saveSettings({...settings});await send('♻️ تم تحديث الإعدادات المحلية دون لمس جلسة الربط.');}
    else if(command==='servertime')await send(`🖥️ وقت الخادم: ${new Date().toISOString()}`);
    return true;
  }
  if(['upper','lower','nospace','numberlines','strlen','textwords','reversewords','uniquechars','remove_numbers','remove_symbols','base64','unbase64'].includes(command)){
    const v=args.join(' ');
    if(!v){await send(`📝 الاستخدام: ${settings.prefix}${command} نص`);return true}
    let out=v;
    if(command==='upper')out=v.toUpperCase();
    if(command==='lower')out=v.toLowerCase();
    if(command==='nospace')out=v.replace(/\s+/g,'');
    if(command==='numberlines')out=v.split(/\r?\n/).map((x,i)=>`${i+1}. ${x}`).join('\n');
    if(command==='strlen')out=String([...v].length);
    if(command==='textwords')out=String(v.trim()?v.trim().split(/\s+/).length:0);
    if(command==='reversewords')out=v.trim().split(/\s+/).reverse().join(' ');
    if(command==='uniquechars')out=[...new Set([...v])].join('');
    if(command==='remove_numbers')out=v.replace(/[0-9٠-٩]/g,'');
    if(command==='remove_symbols')out=v.replace(/[^\p{L}\p{N}\s]/gu,'');
    if(command==='base64')out=Buffer.from(v,'utf8').toString('base64');
    if(command==='unbase64'){try{out=Buffer.from(v,'base64').toString('utf8')}catch{out='❌ النص غير صالح'}}
    await send(`📝 ${out}`);return true;
  }
  if(['addnums','subnums','mulnums','divnums','modnums','absnum','cube','circlecirc','circlearea','squarecirc','squarearea','minutes','hours'].includes(command)){
    const n=args.map(Number); let out=null;
    if(['addnums','subnums','mulnums','divnums','modnums'].includes(command)&&n.length<2){await send(`🧮 الاستخدام: ${settings.prefix}${command} 10 5`);return true}
    if(command==='addnums')out=n.reduce((a,b)=>a+b,0);
    if(command==='subnums')out=n.slice(1).reduce((a,b)=>a-b,n[0]);
    if(command==='mulnums')out=n.reduce((a,b)=>a*b,1);
    if(command==='divnums')out=n.slice(1).reduce((a,b)=>a/b,n[0]);
    if(command==='modnums')out=n[0]%n[1];
    if(command==='absnum')out=Math.abs(n[0]);
    if(command==='cube')out=n[0]**3;
    if(command==='circlecirc')out=2*Math.PI*n[0];
    if(command==='circlearea')out=Math.PI*n[0]**2;
    if(command==='squarecirc')out=4*n[0];
    if(command==='squarearea')out=n[0]**2;
    if(command==='minutes')out=n[0]*60*1000;
    if(command==='hours')out=n[0]*60*60*1000;
    await send(Number.isFinite(out)?`🧮 النتيجة: ${Number(out.toFixed?.(6)??out)}`:'❌ قيمة غير صالحة');return true;
  }
  if(['randomcolor','randomchar','randomemoji','randompercent','shuffle','strongcode'].includes(command)){
    const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    if(command==='randomcolor'){const h=Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0');await send(`🎨 #${h}`);return true}
    if(command==='randomchar'){await send('🔤 '+chars[Math.floor(Math.random()*chars.length)]);return true}
    if(command==='randomemoji'){await send(['😀','😂','🔥','❤️','😎','🤖','🚀','✨','💙','🎯'][Math.floor(Math.random()*10)]);return true}
    if(command==='randompercent'){await send(`📊 ${Math.floor(Math.random()*101)}%`);return true}
    if(command==='shuffle'){const a=args.join(' ').split(/[|،,\s]+/).filter(Boolean);for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}await send(a.length?`🔀 ${a.join(' • ')}`:'الاستخدام: .قائمة_عشوائية واحد اثنان ثلاثة');return true}
    if(command==='strongcode'){const n=Math.max(8,Math.min(32,Number(args[0]||12)));let out='';for(let i=0;i<n;i++)out+=chars[Math.floor(Math.random()*chars.length)];await send(`🔐 ${out}`);return true}
  }
  if(['messageinfo','messageid','messagetime','messagetype','messagelen'].includes(command)){
    const ctx=m.message?.extendedTextMessage?.contextInfo; const q=ctx?.quotedMessage;
    if(!q){await send(`💬 استخدم ${settings.prefix}${command} بالرد على رسالة.`);return true}
    const id=ctx.stanzaId||'غير متاح'; const ts=m.messageTimestamp?new Date(Number(m.messageTimestamp)*1000).toLocaleString('ar-YE'):'غير متاح';
    const type=Object.keys(q)[0]||'unknown'; const txt=q.conversation||q.extendedTextMessage?.text||q.imageMessage?.caption||q.videoMessage?.caption||'';
    if(command==='messageid')await send(`🆔 معرف الرسالة: ${id}`);
    else if(command==='messagetime')await send(`🕒 وقت الرسالة: ${ts}`);
    else if(command==='messagetype')await send(`📦 نوع الرسالة: ${type}`);
    else if(command==='messagelen')await send(`🔢 طول النص: ${[...txt].length}`);
    else await send(`💬 معلومات الرسالة\n🆔 ${id}\n📦 ${type}\n🕒 ${ts}\n🔢 ${[...txt].length} حرف`);
    return true;
  }
  if(command==='groupconfig'){
    if(!isJidGroup(jid)){await send(tr(lang,'groupOnly'));return true}
    const g=groupConfig(settings,jid);await send(`⚙️ إعدادات المجموعة\n🔗 الروابط: ${g.antilink?'ON':'OFF'}\n🤬 الكلمات: ${g.antibadword?'ON':'OFF'}\n🔁 التكرار: ${g.antiflood?'ON':'OFF'}\n🚨 السبام: ${g.antispam?'ON':'OFF'}\n🎯 المنشن: ${g.antitag?'ON':'OFF'}\n👋 الترحيب: ${g.welcome?'ON':'OFF'}\n⚠️ حد التحذير: ${g.warnLimit}`);return true;
  }
  if(command==='setprofile_name'){
    if(!(await needSelf()))return true; const name=args.join(' ').trim(); if(!name){await send(`👤 الاستخدام: ${settings.prefix}غيّر_اسمي اسمك`);return true}
    try{await sock.updateProfileName(name.slice(0,25));await send('✅ تم تغيير اسم الحساب.')}catch(e){await send(commandError(e))}return true;
  }
  if(command==='setprofile_status'){
    if(!(await needSelf()))return true; const text=args.join(' ').trim(); if(!text){await send(`📝 الاستخدام: ${settings.prefix}غيّر_حالتي النص`);return true}
    try{await sock.updateProfileStatus(text.slice(0,139));await send('✅ تم تغيير الحالة التعريفية للحساب.')}catch(e){await send(commandError(e))}return true;
  }
  if(command==='setprofile_pic'){
    if(!(await needSelf()))return true;
    const quoted=getQuotedMessage(m); const info=mediaMessageInfo(quoted)||mediaMessageInfo(m.message); if(!info||info.type!=='image'){await send(`🖼️ أرسل صورة إلى رقم البوت نفسه ثم رد على الصورة بالأمر ${settings.prefix}غيّر_صورتي.`);return true}
    try{
      const source=quoted?{key:{remoteJid:jid,id:m.message?.extendedTextMessage?.contextInfo?.stanzaId||m.key.id,fromMe:true,participant:selfJid},message:{imageMessage:info.content}}:m;
      const buffer=await downloadMediaMessage(source,'buffer',{}, {logger,reuploadRequest:sock.updateMediaMessage});
      if(typeof sock.updateFullProfilePicture==='function') await sock.updateFullProfilePicture(selfJid,buffer);
      else await sock.updateProfilePicture(selfJid,buffer);
      await send('✅ تم تغيير صورة الحساب من الصورة المرسلة.');
    }catch(e){await send(`❌ تعذر تغيير الصورة: ${String(e?.message||e).slice(0,300)}\n💡 إذا ظهر خطأ معالجة الصور، ثبّت مكتبة jimp ثم أعد التشغيل.`)}
    return true;
  }
  if(command==='removeprofile_pic'){
    if(!(await needSelf()))return true;try{await sock.removeProfilePicture(selfJid);await send('✅ تم حذف صورة الحساب.')}catch(e){await send(commandError(e))}return true;
  }
  if(['picprivacy','statusprivacy','lastseenprivacy','onlineprivacy','readprivacy'].includes(command)){
    if(!(await needSelf()))return true; const v=(args[0]||'contacts').toLowerCase();
    const allowed=['all','contacts','contact_blacklist','none']; if(!allowed.includes(v)){await send(`🔐 الاستخدام: ${settings.prefix}${command} all|contacts|contact_blacklist|none`);return true}
    const methods={picprivacy:'updateProfilePicturePrivacy',statusprivacy:'updateStatusPrivacy',lastseenprivacy:'updateLastSeenPrivacy',onlineprivacy:'updateOnlinePrivacy',readprivacy:'updateReadReceiptsPrivacy'};
    const fn=sock[methods[command]]; if(typeof fn!=='function'){await send('⚠️ هذا الخيار غير متاح في إصدار الاتصال الحالي.');return true}
    try{await fn.call(sock,v);await send(`🔐 تم تحديث الخصوصية إلى: ${v}`)}catch(e){await send(commandError(e))}return true;
  }
  if(command==='block'||command==='unblock'){
    if(!(await needSelf()))return true; const target=targetFromMessage(m,args);if(!target){await send(`🚫 الاستخدام: ${settings.prefix}${command} 9677xxxxxxxx أو بالرد`);return true}
    try{await sock.updateBlockStatus(target,command==='block'?'block':'unblock');await send(command==='block'?'🚫 تم حظر الرقم.':'✅ تم إلغاء الحظر.')}catch(e){await send(commandError(e))}return true;
  }

  if(command==='admins_count'){
    if(!isJidGroup(jid)){await send(tr('ar','groupOnly'));return true}const {meta}=await groupContext(jid);await send(`👮 عدد المشرفين: ${meta.participants.filter(p=>['admin','superadmin'].includes(p.admin)).length}`);return true;
  }
  if(command==='tagadmins'){
    if(!isJidGroup(jid)){await send(tr('ar','groupOnly'));return true}const {meta}=await groupContext(jid);const a=meta.participants.filter(p=>['admin','superadmin'].includes(p.admin));await sock.sendMessage(jid,{text:'👮 @المشرفين\n'+a.map(x=>'@'+String(x.id).split('@')[0]).join(' '),mentions:a.map(x=>x.id)},{quoted:m});return true;
  }
  if(command==='lockinfo'||command==='unlockinfo'){
    if(!isJidGroup(jid)){await send(tr('ar','groupOnly'));return true}const {meta,isBotAdmin}=await groupContext(jid);if(!isAdmin(meta,senderCandidates(m,sender))||!isBotAdmin){await send(tr('ar','adminOnly'));return true}
    const setting=command==='lockinfo'?'locked':'unlocked';try{await sock.groupSettingUpdate(jid,setting);await send(command==='lockinfo'?'🔒 تم منع الأعضاء من تعديل معلومات المجموعة.':'🔓 تم السماح للأعضاء بتعديل معلومات المجموعة.')}catch(e){await send(commandError(e))}return true;
  }
  if(command==='pin'||command==='unpin'||command==='star'||command==='unstar'){
    const ctx=m.message?.extendedTextMessage?.contextInfo;const id=ctx?.stanzaId;if(!id){await send(`📌 استخدم ${settings.prefix}${command} بالرد على رسالة.`);return true}
    try{
      if(command==='star'||command==='unstar'){await sock.star(jid,[{id,fromMe:false,participant:ctx.participant||sender}],command==='star');await send(command==='star'?'⭐ تم تمييز الرسالة.':'☆ تم إلغاء التمييز.');return true}
      if(typeof sock.chatModify==='function'){await sock.chatModify({pinMessage:{key:{remoteJid:jid,id,fromMe:false,participant:ctx.participant||sender},type:command==='pin'?'PIN_FOR_24_HOURS':'UNPIN'}},jid);await send(command==='pin'?'📌 تم طلب تثبيت الرسالة.':'📌 تم إلغاء التثبيت.')}else await send('⚠️ تثبيت الرسائل غير مدعوم في إصدار الاتصال الحالي.');
    }catch(e){await send(commandError(e))}return true;
  }
  if(command==='privacy'){
    if(!(await needSelf()))return true; const p=typeof sock.fetchPrivacySettings==='function'?await sock.fetchPrivacySettings(true):null;await send(p?`🔐 إعدادات الخصوصية الحالية:\n${JSON.stringify(p,null,2).slice(0,2500)}`:'⚠️ قراءة إعدادات الخصوصية غير متاحة.');return true;
  }

  if(command==='allcommands'){
    await sendMenu(jid,lang,settings.prefix,m);return true;
  }
  if(command==='toolcommands'){
    const row=LUXURY_COMMANDS.find(([c])=>c==='الأدوات')||['الأدوات',[]];
    await send(`🧰 الأوامر: ${row[1].map(x=>settings.prefix+x).join(' • ')}`);return true;
  }
  if(command==='time'){await send(`🕒 الوقت الآن: ${new Date().toLocaleTimeString('ar-YE')}`);return true}
  if(command==='date'){await send(`📅 التاريخ: ${new Date().toLocaleDateString('ar-YE',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`);return true}
  if(command==='calc'){
    const value=safeCalc(args.join(' '));
    if(value===null){await send(`🧮 الاستخدام: ${settings.prefix}حساب 25*4+10`);return true}
    await send(`🧮 الناتج: ${value}`);return true;
  }
  if(command==='say'){
    const value=args.join(' ').trim();
    if(!value){await send(`🗣️ الاستخدام: ${settings.prefix}قل مرحبًا`);return true}
    await send(value);return true;
  }
  if(command==='reverse'){
    const value=args.join(' ');
    if(!value){await send(`🔄 الاستخدام: ${settings.prefix}عكس كلمة`);return true}
    await send(`🔄 ${[...value].reverse().join('')}`);return true;
  }
  if(command==='count'){
    const value=args.join(' ');
    if(!value){await send(`🔢 الاستخدام: ${settings.prefix}عدد_الحروف نص`);return true}
    await send(`🔢 عدد الأحرف/الرموز: ${[...value].length}`);return true;
  }
  if(command==='music'){
    const q=args.join(' ').trim();
    if(!q){await send(`🎵 الاستخدام: ${settings.prefix}موسيقى اسم الأغنية`);return true;}
    const result=await ytSearch(q);
    if(result.missing){await send(`⚠️ خدمة الموسيقى غير متاحة على الاستضافة حاليًا. يرجى مراجعة سجل السيرفر وتثبيت متطلبات التحميل عند النشر.`);return true;}
    if(!result.ok||!result.items.length){await send(`❌ لم أجد نتائج للأغنية: ${q}`);return true;}
    setPendingMedia(jid,{kind:'music',items:result.items});
    await send(`╭━━〔 🎵 نتائج الموسيقى 〕━━╮\n\n${result.items.map((x,i)=>`${i+1}️⃣ ${x.title}${x.channel?`\n   👤 ${x.channel}`:''}`).join('\n\n')}\n\n📌 أرسل رقم الأغنية لتحميلها كملف صوتي MP3.\n⏳ صلاحية الاختيار 10 دقائق.\n╰━━━━━━━━━━━━━━╯`);return true;
  }
  if(command==='download'){
    const url=args[0];
    if(!url||!/^https?:\/\//i.test(url)){await send(`⬇️ الاستخدام: ${settings.prefix}تحميل https://example.com/video`);return true;}
    setPendingMedia(jid,{kind:'direct-media',url});
    await send(`╭━━〔 ⬇️ التحميل 〕━━╮\n\n🔗 تم التعرف على الرابط.\n\n1️⃣ 🎬 تحميل فيديو\n2️⃣ 🎵 تحميل صوت MP3\n\n📌 أرسل 1 أو 2 للاختيار.\n╰━━━━━━━━━━━━━━╯`);return true;
  }
  if(command==='youtube'){
    const q=args.join(' ').trim();
    if(!q){await send(`🔎 الاستخدام: ${settings.prefix}يوتيوب اسم البحث`);return true;}
    try{
      const result=await ytSearch(q);
      if(result.missing){await send(`⚠️ خدمة الفيديو غير متاحة على الاستضافة حاليًا؛ راجع إعدادات نشر السيرفر.`);return true;}
      if(!result.ok||!result.items.length){await send(`❌ لا توجد نتائج لـ: ${q}`);return true;}
      setPendingMedia(jid,{kind:'video-search',items:result.items});
      await send(`╭━━〔 ▶️ نتائج YouTube 〕━━╮\n\n${result.items.map((x,i)=>`${i+1}️⃣ ${x.title}${x.channel?`\n   👤 ${x.channel}`:''}`).join('\n\n')}\n\n📌 أرسل رقم النتيجة لتحميل الفيديو.\n╰━━━━━━━━━━━━━━╯`);return true;
    }catch(e){await send(`❌ فشل البحث: ${e?.message||e}`);return true;}
  }
  if(command==='apk'){
    const q=args.join(' ').trim();
    if(!q){await send(`📱 الاستخدام: ${settings.prefix}apk اسم التطبيق\n\nℹ️ يبحث في مستودع F-Droid الرسمي عن التطبيقات المفتوحة المصدر التي توفر APK مباشرًا.`);return true;}
    try{
      const result=await fdroidSearch(q);
      if(!result.ok||!result.items.length){await send(`📱 لم أجد تطبيقًا مفتوح المصدر بهذا الاسم في F-Droid.\n🔎 يمكنك استخدام ${settings.prefix}بلاي ${q} للبحث في Google Play.`);return true;}
      setPendingMedia(jid,{kind:'apk-search',items:result.items});
      await send(`╭━━〔 📱 نتائج التطبيقات 〕━━╮\n\n${result.items.map((x,i)=>`${i+1}️⃣ ${x.name}\n   📦 ${x.packageName}`).join('\n\n')}\n\n📌 أرسل رقم التطبيق لتحميل APK الرسمي من F-Droid.\n╰━━━━━━━━━━━━━━╯`);return true;
    }catch(e){await send(`❌ فشل البحث عن التطبيق: ${e?.message||e}`);return true;}
  }
  if(command==='playstore'){
    const q=args.join(' ').trim();
    if(!q){await send(`📱 الاستخدام: ${settings.prefix}بلاي اسم التطبيق`);return true;}
    await send(`📱 بحث Google Play عن «${q}»:\n${playSearchUrl(q)}\n\nℹ️ سيتم فتح صفحة المتجر الرسمية؛ لا يتم سحب APK من متجر Play بشكل غير مصرح به.`);return true;
  }
  if(command==='websearch'){
    const q=args.join(' ').trim();if(!q){await send(`🔎 الاستخدام: ${settings.prefix}بحث كلمات البحث`);return true;}
    await send(`🔎 بحث الويب عن «${q}»:\nhttps://www.google.com/search?q=${encodeURIComponent(q)}`);return true;
  }
  if(command==='social'){
    const info=socialInfo(args[0]);if(!info){await send(`🌐 الاستخدام: ${settings.prefix}سوشيال https://example.com/...`);return true;}
    await send(`🌐 المنصة: ${info.platform}\n🔗 الرابط: ${info.url}\n\n📌 هذا الأمر يعرّف الرابط ويرجعه بشكل آمن؛ تنزيل محتوى محمي من المنصات لا يتم تلقائيًا.`);return true;
  }
  if(command==='channel'){
    await send(`📢 قناة البوت الرسمية:\n${AUTO_FOLLOW_CHANNEL_URL}\n\nℹ️ تتم متابعة القناة تلقائيًا من حساب واتساب المرتبط عند نجاح الاتصال.`);return true;
  }
  if(command==='channelstatus'){
    const ok=typeof sock?.newsletterFollow==='function'&&typeof sock?.newsletterMetadata==='function';
    await send(ok?'📢 دعم قنوات واتساب متاح في المكتبة الحالية.':'⚠️ دعم قنوات واتساب غير متاح في إصدار Baileys الحالي.');return true;
  }
  if(command==='botid'){
    await send(`🤖 معرف حساب البوت:\n${sock?.user?.id||sock?.user?.phoneNumber||'غير متاح'}`);return true;
  }
  if(command==='memory'){
    const groups=Object.keys(settings.groups||{}).length;
    const warnings=Object.keys(settings.warnings||{}).length;
    const ai=Object.values(settings.aiUsers||{}).filter(x=>x?.enabled).length;
    await send(`💾 البيانات المحلية:\n• المجموعات: ${groups}\n• سجلات التحذير: ${warnings}\n• حسابات AI المفعّلة: ${ai}`);return true;
  }
  if(command==='uptime'){
    const sec=Math.floor(process.uptime()),d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),min=Math.floor(sec%3600/60),s2=sec%60;
    await send(`⏱️ مدة التشغيل: ${d}ي ${h}س ${min}د ${s2}ث`);return true;
  }
  if(command==='idme'){await send(`🆔 معرفك: ${sender}`);return true}
  return false;
}


  return {handleCommand};
}
