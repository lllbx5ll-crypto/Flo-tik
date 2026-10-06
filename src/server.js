import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { getSettings, updateSettings, saveSettings } from './store.js';
import { askAI } from './ai.js';
import { startBot, getBotState, requestPairingCode, logout, onBotEvent } from './whatsapp.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();const server=http.createServer(app);const io=new Server(server,{cors:{origin:true,credentials:true}});
const PORT=Number(process.env.PORT||3000);const HOST=process.env.HOST||'0.0.0.0';
app.use(helmet({contentSecurityPolicy:false}));app.use(cors());app.use(express.json({limit:'1mb'}));app.use(express.static(path.join(__dirname,'../public')));
const sessions=new Set();

function normalizePhone(v){return String(v||'').replace(/\D/g,'');}

function publicSettings(settings){
  const aiUsers={};
  for(const [phone,u] of Object.entries(settings.aiUsers||{})){
    aiUsers[phone]={provider:u.provider||'gemini',model:u.model||'gemini-3.8-flash',enabled:Boolean(u.enabled),groupMode:u.groupMode||'mention',privateEnabled:u.privateEnabled!==false,systemPrompt:u.systemPrompt||'',apiKeySet:Boolean(u.apiKey),apiKeyMask:u.apiKey?'••••••••'+String(u.apiKey).slice(-4):'',typingPresence:u.typingPresence!==false,recordingPresence:Boolean(u.recordingPresence)};
  }
  return {
    prefix:'.',language:'ar',antilink:Boolean(settings.antilink),antibadword:Boolean(settings.antibadword),welcome:Boolean(settings.welcome),
    statusAutoView:Boolean(settings.statusAutoView),statusAutoReact:Boolean(settings.statusAutoReact),statusReaction:settings.statusReaction||'💚',
    aiEnabled:Boolean(settings.aiEnabled),aiProvider:settings.aiProvider||'gemini',aiGroupMode:settings.aiGroupMode||'mention',aiPrivate:settings.aiPrivate!==false,
    aiModel:settings.aiModel||'gemini-3.8-flash',aiSystemPrompt:settings.aiSystemPrompt||'',aiUsers
  };
}
function aiPublicProfile(settings,phone){
  const key=normalizePhone(phone);const u=settings.aiUsers?.[key];
  if(!u)return {phone:key,configured:false,enabled:false,provider:'gemini',model:'gemini-3.8-flash',apiKeySet:false,groupMode:'mention',privateEnabled:true,systemPrompt:''};
  return {phone:key,configured:Boolean(u.apiKey),enabled:Boolean(u.enabled),provider:u.provider||'gemini',model:u.model||'gemini-3.8-flash',apiKeySet:Boolean(u.apiKey),apiKeyMask:u.apiKey?'••••••••'+String(u.apiKey).slice(-4):'',typingPresence:u.typingPresence!==false,recordingPresence:Boolean(u.recordingPresence),groupMode:u.groupMode||'mention',privateEnabled:u.privateEnabled!==false,systemPrompt:u.systemPrompt||'',typingPresence:u.typingPresence!==false,recordingPresence:Boolean(u.recordingPresence)};
}

function cryptoRandom(){return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}
function auth(req,res,next){
  if(String(process.env.DASHBOARD_AUTH||'false').toLowerCase()!=='true')return next();
  const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');
  if(!token||!sessions.has(token))return res.status(401).json({error:'Unauthorized'});next();
}
app.post('/api/login',(req,res)=>{if(String(process.env.DASHBOARD_AUTH||'false').toLowerCase()!=='true')return res.json({token:'public-dashboard'});if(String(req.body.password||'')!==String(process.env.ADMIN_PASSWORD||''))return res.status(401).json({error:'Invalid password'});const token=cryptoRandom();sessions.add(token);res.json({token})});
app.post('/api/logout',auth,(req,res)=>{const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');if(token)sessions.delete(token);res.json({ok:true})});
app.get('/api/state',auth,(req,res)=>{const s=getSettings();res.json({bot:getBotState(),settings:publicSettings(s),meta:{name:process.env.BOT_NAME||'FlowTech',developer:process.env.DEVELOPER_NAME||'FlowTech Team',contact:process.env.CONTACT_PHONE||process.env.OWNER_PHONE||'',dev2Name:process.env.DEV2_NAME||'أحمد العباسي',dev2Phone:process.env.DEV2_PHONE||'967739020737',auth:process.env.DASHBOARD_AUTH==='true'}})});
app.post('/api/start',auth,async(req,res)=>{try{await startBot();res.json(getBotState())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/pair',auth,async(req,res)=>{try{const code=await requestPairingCode(req.body.phone);res.json({code})}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/logout-whatsapp',auth,async(req,res)=>{try{await logout();res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});

app.get('/api/ai-user',auth,(req,res)=>{
  const phone=normalizePhone(req.query.phone);if(phone.length<7)return res.status(400).json({error:'أدخل رقم واتساب دولي صحيح.'});
  res.json(aiPublicProfile(getSettings(),phone));
});
app.post('/api/ai-user',auth,(req,res)=>{
  const phone=normalizePhone(req.body.phone);if(phone.length<7||phone.length>15)return res.status(400).json({error:'أدخل رقم واتساب دولي صحيح بدون + أو مسافات.'});
  const provider=String(req.body.provider||'gemini').toLowerCase();if(!['gemini','openai'].includes(provider))return res.status(400).json({error:'مزود AI غير صالح.'});
  const settings=getSettings();settings.aiUsers=settings.aiUsers||{};const old=settings.aiUsers[phone]||{};
  const apiKey=String(req.body.apiKey||'').trim()||old.apiKey||'';
  if(!apiKey)return res.status(400).json({error:'أدخل مفتاح API أولاً.'});
  settings.aiUsers[phone]={...old,provider,model:String(req.body.model||'').trim()||'gemini-3.8-flash',apiKey,enabled:Boolean(req.body.enabled),groupMode:req.body.groupMode==='all'?'all':'mention',privateEnabled:req.body.privateEnabled!==false,typingPresence:req.body.typingPresence!==false,recordingPresence:Boolean(req.body.recordingPresence),systemPrompt:String(req.body.systemPrompt||'').slice(0,3000)};
  saveSettings(settings);res.json(aiPublicProfile(settings,phone));
});
app.post('/api/ai-user/test',auth,async(req,res)=>{
  const phone=normalizePhone(req.body.phone);const u=getSettings().aiUsers?.[phone];if(!u?.apiKey)return res.status(400).json({error:'لا يوجد مفتاح API محفوظ لهذا الرقم.'});
  try{const out=await askAI({provider:u.provider,model:u.model,prompt:'قل: تم اختبار الذكاء الاصطناعي بنجاح.',system:u.systemPrompt,apiKey:u.apiKey});res.json({ok:true,text:out.text});}catch(e){res.status(400).json({error:e.message});}
});
app.get('/api/ai-users',auth,(req,res)=>{
  const users=Object.entries(getSettings().aiUsers||{}).map(([phone,u])=>({phone,provider:u.provider||'gemini',model:u.model||'gemini-3.8-flash',enabled:Boolean(u.enabled),groupMode:u.groupMode||'mention',privateEnabled:u.privateEnabled!==false,apiKeySet:Boolean(u.apiKey),apiKeyMask:u.apiKey?'••••••••'+String(u.apiKey).slice(-4):'',typingPresence:u.typingPresence!==false,recordingPresence:Boolean(u.recordingPresence)}));
  res.json({users});
});
app.delete('/api/ai-user',auth,(req,res)=>{
  const phone=normalizePhone(req.body.phone);const settings=getSettings();settings.aiUsers=settings.aiUsers||{};delete settings.aiUsers[phone];saveSettings(settings);res.json({ok:true});
});

app.get('/api/settings',auth,(req,res)=>res.json(publicSettings(getSettings())));
app.post('/api/settings',auth,(req,res)=>{
  const allowed=['antilink','antibadword','welcome','statusAutoView','statusAutoReact','statusReaction','aiEnabled','aiProvider','aiGroupMode','aiPrivate','aiModel','aiSystemPrompt'];
  const patch={};for(const k of allowed)if(req.body[k]!==undefined)patch[k]=req.body[k];
  patch.language='ar';patch.prefix='.';
  if(patch.aiProvider&&!['openai','gemini'].includes(patch.aiProvider))patch.aiProvider='gemini';
  if(patch.statusReaction)patch.statusReaction=String(patch.statusReaction).slice(0,8);
  res.json(updateSettings(patch));
});
app.get(/.*/,(req,res)=>res.sendFile(path.join(__dirname,'../public/index.html')));
onBotEvent(payload=>io.emit('bot:event',payload));
server.listen(PORT,HOST,()=>{console.log(`FlowTech dashboard: http://${HOST==='0.0.0.0'?'localhost':HOST}:${PORT}`);startBot().catch(err=>console.error('Bot start error:',err.message))});
