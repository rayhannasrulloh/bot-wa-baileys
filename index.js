const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require('fs'); // <-- Diperlukan untuk interaksi file

// ==================================================
//      BAGIAN PENGELOLAAN DATABASE PENGGUNA
// ==================================================
const DB_FILE = 'chatted_users.json';
let chattedUsers = new Set();

const loadChattedUsers = () => {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            const usersArray = JSON.parse(data);
            chattedUsers = new Set(usersArray);
            console.log("Database pengguna berhasil dimuat.");
        } else {
            console.log("Database tidak ditemukan, memulai dengan daftar kosong.");
        }
    } catch (error) {
        console.error("Gagal memuat database pengguna:", error);
    }
};

const saveChattedUsers = () => {
    try {
        const usersArray = Array.from(chattedUsers);
        fs.writeFileSync(DB_FILE, JSON.stringify(usersArray, null, 2));
    } catch (error) {
        console.error("Gagal menyimpan database pengguna:", error);
    }
};
// ==================================================


async function connectToWhatsApp() {
    loadChattedUsers();

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
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

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        let messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        // user baru yang belum pernah chat
        if (!chattedUsers.has(from)) {
            const welcomeMenu = `ada yang bisa saya bantu?

pilih salah satu opsi di bawah ini:

*1.* Menu Utama
*2.* Nomor WA Habil
*3.* Cara Berak Dengan Berdiri

pencet *angka* pilihan Anda (contoh: 1)`;
            
            await sock.sendMessage(from, { text: welcomeMenu });
            console.log(`Pengguna baru terdeteksi: ${from}. Menu sambutan dikirim.`);

            // tambah pengguna ke database trs simpen
            chattedUsers.add(from);
            saveChattedUsers();
            
            return; // proses berhenti biar ga ke awal
        }

        if (!messageText) return;
        
        console.log(`Menerima pesan "${messageText}" dari ${from}`);
        const command = messageText.toLowerCase();

        if (command === '!menu') {
            const menuText = `ada yang bisa saya bantu?

pilih salah satu opsi di bawah ini:

*1.* Menu Utama
*2.* Nomor WA Habil
*3.* Cara Berak Dengan Berdiri

pencet *angka* pilihan Anda (contoh: 1)`;

            await sock.sendMessage(from, { text: menuText });
        }
        else if (command === '1') {
            await sock.sendMessage(from, { text: 'Ya ndak tawu kok tanya saya awkoakowka'}, { quoted: msg });
        }
        else if (command === '2') {
             await sock.sendMessage(from, { text: 'ya saya ndak tawu'}, { quoted: msg });
        }
         else if (command === '3') {
             await sock.sendMessage(from, { text: 'ndak tawu juga saya hohoho'}, { quoted: msg });
        }
    });
}

// Menjalankan bot
connectToWhatsApp();