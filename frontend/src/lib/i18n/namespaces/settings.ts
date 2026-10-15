export const settingsEn = {
  navGeneral: "General",
  navConnection: "Connection",
  navAbout: "About",
  navLabel: "Settings navigation",

  generalTitle: "General",
  generalDescription:
    "Customize language, appearance, and code display preferences.",
  language: "Language",
  languageDescription: "Choose the language used across the app.",
  appearance: "Appearance",
  appearanceDescription:
    "Choose the interface theme. Your choice is saved and reused the next time the app opens.",
  themeLight: "Light",
  themeDark: "Dark",
  themeSystem: "System",
  textSize: "UI text size",
  textSizeDescription:
    "The text-ui-* scale follows this variable; icon sizes and spacing stay the same.",
  textSizeBase: "Base size",
  codeTheme: "Code theme",
  codeThemeDescription:
    "Syntax highlighting theme for code blocks in the transcript.",
  lineNumbers: "Line numbers",
  lineNumbersDescription:
    "Display line numbers alongside code blocks in messages.",
  preview: "Preview",

  connection: "Connection",
  connectionTitle: "Connection",
  connectionDescription: "Status of the omp session running in this window.",
  status: "Status",
  statusDescription: "Current agent execution state.",
  sessionId: "Session ID",
  sessionIdDescription: "Identifier of the active CLI session.",
  stopAll: "Stop all sessions",
  stopAllDescription: "Terminate active CLI sessions and release resources.",
  statusDisconnected: "Disconnected",
  statusConnecting: "Connecting",
  statusReady: "Ready",
  statusBusy: "Busy",

  about: "About",
  aboutTitle: "About",
  aboutSubtitle: "Application details and runtime specifications.",
  aboutDescription:
    "OMP Desktop — a Wails shell for the omp CLI (--mode rpc). Protocol: JSON lines (wire v1), stdout→omp:frame, exit→omp:rpc-exit.",
  version: "Version",
  protocol: "RPC Protocol",
  runtime: "Runtime",
} as const;

export const settingsId: Record<keyof typeof settingsEn, string> = {
  navGeneral: "Umum",
  navConnection: "Koneksi",
  navAbout: "Tentang",
  navLabel: "Navigasi pengaturan",

  generalTitle: "Umum",
  generalDescription:
    "Sesuaikan bahasa, tampilan, dan preferensi tampilan kode.",
  language: "Bahasa",
  languageDescription: "Pilih bahasa yang dipakai di seluruh aplikasi.",
  appearance: "Tampilan",
  appearanceDescription:
    "Pilih tema antarmuka. Pilihan disimpan dan dipakai lagi saat aplikasi dibuka.",
  themeLight: "Terang",
  themeDark: "Gelap",
  themeSystem: "Ikut sistem",
  textSize: "Ukuran teks UI",
  textSizeDescription:
    "Skala text-ui-* mengikuti variabel ini; ukuran ikon dan spasi tidak berubah.",
  textSizeBase: "Ukuran dasar",
  codeTheme: "Tema kode",
  codeThemeDescription:
    "Tema penyorotan sintaksis untuk blok kode di transkrip.",
  lineNumbers: "Nomor baris",
  lineNumbersDescription:
    "Tampilkan nomor baris di samping blok kode dalam pesan.",
  preview: "Pratinjau",

  connection: "Koneksi",
  connectionTitle: "Koneksi",
  connectionDescription: "Status sesi omp yang berjalan di window ini.",
  status: "Status",
  statusDescription: "Status eksekusi agen saat ini.",
  sessionId: "ID sesi",
  sessionIdDescription: "Pengidentifikasi sesi CLI yang aktif.",
  stopAll: "Hentikan semua sesi",
  stopAllDescription: "Hentikan sesi CLI yang aktif dan lepaskan sumber daya.",
  statusDisconnected: "Terputus",
  statusConnecting: "Menghubungkan",
  statusReady: "Siap",
  statusBusy: "Sibuk",

  about: "Tentang",
  aboutTitle: "Tentang",
  aboutSubtitle: "Detail aplikasi dan spesifikasi runtime.",
  aboutDescription:
    "OMP Desktop — shell Wails untuk CLI omp (--mode rpc). Protokol: JSON lines (wire v1), stdout→omp:frame, keluar→omp:rpc-exit.",
  version: "Versi",
  protocol: "Protokol RPC",
  runtime: "Runtime",
};
