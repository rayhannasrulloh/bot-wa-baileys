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

async function connectToWhatsApp() {
    // Menyimpan state otentikasi agar tidak perlu scan QR berulang kali
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    // Membuat koneksi ke WhatsApp
    const sock = makeWASocket({
        // Gunakan logger pino untuk menampilkan log
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // Menampilkan QR code di terminal
        auth: state, // Menggunakan state otentikasi yang sudah disimpan
    });

    // Event listener saat koneksi berhasil/gagal/ditutup
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

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
        // Mengambil pesan yang relevan
        const msg = m.messages[0];

        // Jika tidak ada pesan atau bukan dari pengguna, abaikan
        if (!msg.message || msg.key.fromMe) return;

        // Mendapatkan nomor pengirim
        const from = msg.key.remoteJid;

        // Mengirim balasan "Halo!" ke pengirim
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