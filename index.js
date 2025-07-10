const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    jidDecode
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode-terminal");

// Fungsi utama untuk menjalankan bot
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("Pindai kode QR ini untuk terhubung:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi ditutup karena ', lastDisconnect.error, ', mencoba menghubungkan kembali...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Koneksi berhasil tersambung!');
        }
    });

    sock.ev.on('creds.update', saveCreds);


    // ==================================================
    //           BAGIAN LOGIKA PERINTAH DIMULAI
    // ==================================================
    sock.ev.on('messages.upsert', async m => {
        // Mengambil data pesan yang relevan
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        // Mendapatkan nomor pengirim dan teks pesan
        const from = msg.key.remoteJid;
        // Memastikan message.conversation tidak null, jika null gunakan extendedTextMessage
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        // Jika tidak ada teks pesan, abaikan
        if (!messageText) return;

        console.log(`Menerima pesan "${messageText}" dari ${from}`);

        // --- Logika untuk memproses perintah ---
        if (messageText.toLowerCase() === '!ping') {
            await sock.sendMessage(from, { text: 'Pong!' }, { quoted: msg });
            console.log(`Membalas "Pong!" ke ${from}`);
        }
        else if (messageText.toLowerCase() === '!halo') {
            await sock.sendMessage(from, { text: 'Halo juga!' }, { quoted: msg });
            console.log(`Membalas "Halo juga!" ke ${from}`);
        }
        // Anda bisa menambahkan 'else if' lain di sini untuk perintah baru
    });
    // ==================================================
    //            BAGIAN LOGIKA PERINTAH SELESAI
    // ==================================================
}

// Menjalankan bot
connectToWhatsApp();