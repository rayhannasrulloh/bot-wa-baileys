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
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        const listResponseEntity = msg.message.listResponse;
        const buttonResponseEntity = msg.message.buttonsResponse;
        
        if (listResponseEntity) {
            const selectedId = listResponseEntity.singleSelectReply.selectedRowId;
            console.log(`Pengguna ${from} memilih dari daftar dengan ID: ${selectedId}`);

            if(selectedId === 'promo_id') {
                await sock.sendMessage(from, { text: 'Saat ini belum ada promo yang tersedia.'}, { quoted: msg });
            } else if (selectedId === 'lacak_id') {
                await sock.sendMessage(from, { text: 'Fitur lacak pesanan akan segera hadir!'}, { quoted: msg });
            } else if (selectedId === 'menu_utama_id') {
                 await sock.sendMessage(from, { text: 'Ini adalah menu utama kami... (fitur belum jadi)'}, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: 'Pilihan tidak dikenali.'}, { quoted: msg });
            }
            return; // hentikan eksekusi agar galanjut
        }
        
        if (!messageText) return;

        console.log(`Menerima pesan "${messageText}" dari ${from}`);
        
        if (messageText.toLowerCase() === 'ping' || messageText.toLowerCase() === 'test') {
            await sock.sendMessage(from, { text: 'Pong!' }, { quoted: msg });
        }
        else if (messageText.toLowerCase() === 'halo') {
            await sock.sendMessage(from, { text: 'Halo juga!' }, { quoted: msg });
        }
        else if (command === '!menu') {
        const menuText = `Hai! Ada yang bisa saya bantu?

Pilih salah satu opsi di bawah ini:

*1. Lihat Menu Utama* 🍽️
*2. Cek Promo Spesial* 🎉
*3. Lacak Status Pesanan* 🚚

Ketik *angka* pilihan Anda (contoh: 1)`;

        await sock.sendMessage(from, { text: menuText });
        console.log(`Mengirim menu teks ke ${from}`);
    }
        else if (messageText.toLowerCase() === '!help') {
             const buttons = [
                {buttonId: '!ping', buttonText: {displayText: 'Test Kecepatan (Ping)'}, type: 1},
                {buttonId: '!menu', buttonText: {displayText: 'Tampilkan Menu'}, type: 1},
             ]

             const buttonMessage = {
                 text: "Ini adalah menu bantuan. Silakan pilih salah satu tombol di bawah.",
                 footer: 'Bot WhatsApp by Partner Coding',
                 buttons: buttons,
                 headerType: 1
             }
             await sock.sendMessage(from, buttonMessage);
             console.log(`Mengirim pesan tombol ke ${from}`);
        }
    });
    // ==================================================
    //            BAGIAN LOGIKA PERINTAH SELESAI
    // ==================================================
}



connectToWhatsApp();