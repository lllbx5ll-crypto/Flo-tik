import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { getSettings, updateSettings } from './store.js';
import { startBot, getBotState, requestPairingCode, logout, onBotEvent } from './whatsapp.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();const server=http.createServer(app);const io=new Server(server,{cors:{origin:true,credentials:true}});
const PORT=Number(process.env.PORT||3000);const HOST=process.env.HOST||'0.0.0.0';
app.use(helmet({contentSecurityPolicy:false}));app.use(cors());app.use(express.json({limit:'1mb'}));app.use(express.static(path.join(__dirname,'../public')));
const sessions=new Set();
function cryptoRandom(){return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}
function auth(req,res,next){
  if(String(process.env.DASHBOARD_AUTH||'false').toLowerCase()!=='true')return next();
  const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');
  if(!token||!sessions.has(token))return res.status(401).json({error:'Unauthorized'});next();
}
app.post('/api/login',(req,res)=>{if(String(process.env.DASHBOARD_AUTH||'false').toLowerCase()!=='true')return res.json({token:'public-dashboard'});if(String(req.body.password||'')!==String(process.env.ADMIN_PASSWORD||''))return res.status(401).json({error:'Invalid password'});const token=cryptoRandom();sessions.add(token);res.json({token})});
app.post('/api/logout',auth,(req,res)=>{const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');if(token)sessions.delete(token);res.json({ok:true})});
app.get('/api/state',auth,(req,res)=>{const s=getSettings();res.json({bot:getBotState(),settings:s,meta:{name:process.env.BOT_NAME||'FlowTech',developer:process.env.DEVELOPER_NAME||'FlowTech Team',contact:process.env.CONTACT_PHONE||process.env.OWNER_PHONE||'',auth:process.env.DASHBOARD_AUTH==='true'}})});
app.post('/api/start',auth,async(req,res)=>{try{await startBot();res.json(getBotState())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/pair',auth,async(req,res)=>{try{const code=await requestPairingCode(req.body.phone);res.json({code})}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/logout-whatsapp',auth,async(req,res)=>{try{await logout();res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/settings',auth,(req,res)=>res.json(getSettings()));
app.post('/api/settings',auth,(req,res)=>{
  const allowed=['prefix','language','antilink','antibadword','welcome','statusAutoView','statusAutoReact','statusReaction','aiEnabled','aiProvider','aiGroupMode','aiPrivate','aiModel','aiSystemPrompt'];
  const patch={};for(const k of allowed)if(req.body[k]!==undefined)patch[k]=req.body[k];
  if(patch.language&&!['ar','en','fr'].includes(patch.language))patch.language='ar';
  if(patch.aiProvider&&!['openai','gemini'].includes(patch.aiProvider))patch.aiProvider='gemini';
  if(patch.statusReaction)patch.statusReaction=String(patch.statusReaction).slice(0,8);
  res.json(updateSettings(patch));
});
app.get(/.*/,(req,res)=>res.sendFile(path.join(__dirname,'../public/index.html')));
onBotEvent(payload=>io.emit('bot:event',payload));
server.listen(PORT,HOST,()=>{console.log(`FlowTech dashboard: http://${HOST==='0.0.0.0'?'localhost':HOST}:${PORT}`);startBot().catch(err=>console.error('Bot start error:',err.message))});
