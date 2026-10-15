import { commonEn, commonId } from "./common";
import { newSessionEn, newSessionId } from "./new-session";
import { panelEn, panelId } from "./panel";
import { settingsEn, settingsId } from "./settings";
import { sidebarEn, sidebarId } from "./sidebar";
import { terminalEn, terminalId } from "./terminal";
import { workspaceEn, workspaceId } from "./workspace";

export const messages = {
  en: {
    common: commonEn,
    sidebar: sidebarEn,
    workspace: workspaceEn,
    newSession: newSessionEn,
    panel: panelEn,
    settings: settingsEn,
    terminal: terminalEn,
  },
  id: {
    common: commonId,
    sidebar: sidebarId,
    workspace: workspaceId,
    newSession: newSessionId,
    panel: panelId,
    settings: settingsId,
    terminal: terminalId,
  },
} as const;
