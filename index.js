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
const qrcode = require("qrcode-terminal"); // <-- TAMBAHKAN BARIS INI

// Fungsi utama untuk menjalankan bot
async function connectToWhatsApp() {
    // Menyimpan state otentikasi agar tidak perlu scan QR berulang kali
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    // Membuat koneksi ke WhatsApp
    const sock = makeWASocket({
        // Gunakan logger pino untuk menampilkan log
        logger: pino({ level: 'silent' }),
        // printQRInTerminal: true, // <-- HAPUS ATAU BERI KOMENTAR BARIS INI
        auth: state,
    });

    // Event listener saat koneksi berhasil/gagal/ditutup
    sock.ev.on('connection.update', (update) => {
        // Ambil qr, connection, dan lastDisconnect dari update
        const { connection, lastDisconnect, qr } = update;

        // Jika ada QR, tampilkan di terminal
        if (qr) {
            console.log("Pindai kode QR ini untuk terhubung:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi ditutup karena ', lastDisconnect.error, ', mencoba menghubungkan kembali...', shouldReconnect);
            // Jika bukan karena logout, coba sambungkan kembali
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Koneksi berhasil tersambung!');
        }
    });

    // Simpan kredensial setiap kali diperbarui
    sock.ev.on('creds.update', saveCreds);

    // Event listener saat ada pesan masuk
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;

        try {
            console.log('Menerima pesan dari:', from);
            await sock.sendMessage(from, { text: 'Halo!' });
            console.log('Berhasil membalas pesan ke:', from);
        } catch (error) {
            console.error('Gagal mengirim balasan:', error);
        }
    });
}

// Menjalankan bot
connectToWhatsApp();