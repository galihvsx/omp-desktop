export const terminalEn = {
  title: "Terminal",
  close: "Close terminal",
  newTab: "New terminal tab",
  restart: "Restart shell",
  exited: "The shell exited",
  unavailable: "The terminal is unavailable in this build.",
  resize: "Drag to resize the terminal panel",
} as const;

export const terminalId: Record<keyof typeof terminalEn, string> = {
  title: "Terminal",
  close: "Tutup terminal",
  newTab: "Tab terminal baru",
  restart: "Jalankan ulang shell",
  exited: "Shell berhenti",
  unavailable: "Terminal tidak tersedia di build ini.",
  resize: "Seret untuk mengubah ukuran panel terminal",
};
