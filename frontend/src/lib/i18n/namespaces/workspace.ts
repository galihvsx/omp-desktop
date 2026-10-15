export const workspaceEn = {
  statusDisconnected: "Disconnected",
  statusConnecting: "Starting omp…",
  statusReady: "Ready",
  statusBusy: "omp is working…",

  statusBarDisconnected: "disconnected",
  statusBarConnecting: "connecting",
  statusBarReady: "ready",
  statusBarBusy: "working",
  statusBarSessionPlaceholder: "session —",

  composerPlaceholderDisconnected: "Ask anything, run any command",
  composerPlaceholderBusy: "Ask anything, run any command",
  composerPlaceholder: "Ask anything, run any command",
  composerPlaceholderConflicted: "Session running in another process · read-only",
  composerSendHint: "⏎ send · ⇧⏎ new line",
  composerIdle: "Session not running",
  composerSend: "Send",
  composerModel: "Model",
  composerModelLoading: "Loading models…",
  composerModelError: "Couldn't load models",
  composerModelModelError: "Couldn't load models",
  composerModelEmpty: "No models",
  composerModelSearch: "Search models…",
  composerModelFavorites: "Favorites",
  composerModelRecent: "Recent",
  composerModelNoResults: "No matching models",
  composerReasoningUnavailable: "Set by the model",
  composerApprovalFixed: "Approval mode is fixed when the session starts",

  sessionConflictTitle: "This session is running in another omp process.",
  sessionConflictDescription:
    "Read-only here. Close it in the terminal to take over in the desktop app.",
  sessionConflictHint:
    "Once closed, reload the session to resume interactive mode.",
  sessionConflictReload: "Reload session",
  sessionConflictReloading: "Checking…",

  queueTitle: "Queue",
  queueCount: "{count} queued",
  queueSteering: "Steering",
  queueFollowUp: "Follow-up",
  queueSteeringHint: "Sent while omp is working",
  queueFollowUpHint: "Sent after this turn finishes",
  queueSteer: "Steer",
  queueSteerHint:
    "Promote to the steering queue so omp picks it up while it works",
  queueEdit: "Edit",
  queueEditHint: "Remove from the queue and put it back in the editor",
  queueDelete: "Delete",
  queueDeleteHint: "Remove from the queue",
  queueInterrupt: "Interrupt",
  queueInterruptImmediate: "Immediate",
  queueInterruptWait: "Wait",
  queueInterruptImmediateHint:
    "A steering message interrupts tool execution right away",
  queueInterruptWaitHint:
    "A steering message waits for the running tool to finish",
  queueReorderBlocked: "Can't reorder this queue",
  queueReorderDuplicate:
    "Two messages in this queue share the same text, so omp cannot tell which one to move.",
  queueReorderSlash:
    "A queued message that starts with \"/\" cannot be re-added after a reorder, so this queue is left as it is.",
  queueFailed: "Could not queue the message",
  queueSteerFailed: "Could not steer the queued message",
  queueRemoveFailed: "Could not remove the queued message",
  queueReorderFailed: "Could not reorder the queue",
  queueModeFailed: "Could not change the queue mode",

  conversationEmptyTitle: "No session yet",
  conversationEmptyDescription:
    "Send a message to run the omp agent over the RPC bridge.",

  permissionTitle: "Approval",
  permissionApprove: "Approve",
  permissionDeny: "Deny",
  permissionReplyPlaceholder: "Type a reply",
  permissionSubmit: "Submit",

  toolDone: "done",
  toolFailed: "failed",
  toolRunning: "running",
  toolPreparing: "preparing",
  toolParameters: "Parameters",
  toolResult: "Result",
  toolError: "Error",

  thinkingStreaming: "Thinking…",
  thought: "Thought",
  explore: "Explore",
  exploreFiles: "{count} files",
  todo: "Todo",

  workedFor: "Worked for {duration}",
  workingFor: "Working for {duration}",
  workDetails: "Work details",
} as const;

export const workspaceId: Record<keyof typeof workspaceEn, string> = {
  statusDisconnected: "Terputus",
  statusConnecting: "Menjalankan omp…",
  statusReady: "Siap",
  statusBusy: "omp sedang bekerja…",

  statusBarDisconnected: "terputus",
  statusBarConnecting: "menghubungkan",
  statusBarReady: "siap",
  statusBarBusy: "bekerja",
  statusBarSessionPlaceholder: "sesi —",

  composerPlaceholderDisconnected: "Tanyakan apa saja, jalankan perintah apa saja",
  composerPlaceholderBusy: "Tanyakan apa saja, jalankan perintah apa saja",
  composerPlaceholder: "Tanyakan apa saja, jalankan perintah apa saja",
  composerPlaceholderConflicted: "Sesi berjalan di proses lain · hanya-baca",
  composerSendHint: "⏎ kirim · ⇧⏎ baris baru",
  composerIdle: "Sesi belum berjalan",
  composerSend: "Kirim",
  composerModel: "Model",
  composerModelLoading: "Memuat model…",
  composerModelError: "Gagal memuat model",
  composerModelModelError: "Gagal memuat model",
  composerModelEmpty: "Tidak ada model",
  composerModelSearch: "Cari model…",
  composerModelFavorites: "Favorit",
  composerModelRecent: "Terbaru",
  composerModelNoResults: "Tidak ada model yang cocok",
  composerReasoningUnavailable: "Ditentukan oleh model",
  composerApprovalFixed: "Mode persetujuan tetap sejak sesi dimulai",

  sessionConflictTitle: "Sesi ini sedang berjalan di proses omp lain.",
  sessionConflictDescription:
    "Hanya-baca di sini. Tutup proses di terminal untuk mengambil alih di aplikasi desktop.",
  sessionConflictHint:
    "Setelah ditutup, muat ulang sesi untuk melanjutkan mode interaktif.",
  sessionConflictReload: "Muat ulang sesi",
  sessionConflictReloading: "Memeriksa…",

  queueTitle: "Antrean",
  queueCount: "{count} menunggu",
  queueSteering: "Steering",
  queueFollowUp: "Lanjutan",
  queueSteeringHint: "Dikirim saat omp sedang bekerja",
  queueFollowUpHint: "Dikirim setelah giliran ini selesai",
  queueSteer: "Arahkan",
  queueSteerHint:
    "Naikkan ke antrean steering supaya omp mengambilnya saat sedang bekerja",
  queueEdit: "Ubah",
  queueEditHint: "Keluarkan dari antrean dan kembalikan ke editor",
  queueDelete: "Hapus",
  queueDeleteHint: "Keluarkan dari antrean",
  queueInterrupt: "Interupsi",
  queueInterruptImmediate: "Langsung",
  queueInterruptWait: "Tunggu",
  queueInterruptImmediateHint:
    "Pesan steering langsung menginterupsi eksekusi tool",
  queueInterruptWaitHint:
    "Pesan steering menunggu tool yang berjalan selesai",
  queueReorderBlocked: "Antrean ini tidak bisa diurutkan ulang",
  queueReorderDuplicate:
    "Dua pesan di antrean ini punya teks yang sama, jadi omp tidak tahu mana yang harus dipindah.",
  queueReorderSlash:
    "Pesan dalam antrean yang dimulai dengan \"/\" tidak bisa ditambahkan lagi setelah pengurutan ulang, jadi antrean ini dibiarkan apa adanya.",
  queueFailed: "Gagal mengantrekan pesan",
  queueSteerFailed: "Gagal mengarahkan pesan dalam antrean",
  queueRemoveFailed: "Gagal menghapus pesan dalam antrean",
  queueReorderFailed: "Gagal mengurutkan ulang antrean",
  queueModeFailed: "Gagal mengubah mode antrean",

  conversationEmptyTitle: "Belum ada sesi",
  conversationEmptyDescription:
    "Kirim pesan untuk menjalankan agen omp lewat jembatan RPC.",

  permissionTitle: "Persetujuan",
  permissionApprove: "Setujui",
  permissionDeny: "Tolak",
  permissionReplyPlaceholder: "Ketik balasan",
  permissionSubmit: "Kirim",

  toolDone: "selesai",
  toolFailed: "gagal",
  toolRunning: "berjalan",
  toolPreparing: "menyiapkan",
  toolParameters: "Parameter",
  toolResult: "Hasil",
  toolError: "Galat",

  thinkingStreaming: "Berpikir…",
  thought: "Berpikir",
  explore: "Jelajahi",
  exploreFiles: "{count} berkas",
  todo: "Tugas",

  workedFor: "Bekerja {duration}",
  workingFor: "Sedang bekerja {duration}",
  workDetails: "Rincian pekerjaan",
};
