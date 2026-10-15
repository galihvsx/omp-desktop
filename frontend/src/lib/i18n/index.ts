import { useCallback, useMemo } from "react";
import { create } from "zustand";

import { messages } from "./namespaces";

export const LOCALES = ["en", "id"] as const;

export type Locale = (typeof LOCALES)[number];

type Dict = typeof messages.en;

type LeafPaths<T> = {
 [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPaths<T[K]>}`;
}[keyof T & string];

export type TranslationKey = LeafPaths<Dict>;

export type TranslationVars = Record<string, string | number>;

const STORAGE_KEY = "omp-locale";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && LOCALES.some((locale) => locale === value)
  );
}

function initialLocale(): Locale {
 try {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) {
   return stored;
  }
 } catch {
 }
 const system =
  typeof navigator === "undefined" ? "" : navigator.language.toLowerCase();
 return system.startsWith("id") ? "id" : "en";
}

function applyDocumentLang(locale: Locale): void {
 if (typeof document !== "undefined") {
  document.documentElement.lang = locale;
 }
}

type Namespace = Record<string, string>;

type Dictionary = Record<string, Namespace>;

function lookup(dict: Dictionary, key: string): string {
 const separator = key.indexOf(".");
 if (separator <= 0 || separator === key.length - 1) {
  return key;
 }
 const namespace = dict[key.slice(0, separator)];
 const value = namespace?.[key.slice(separator + 1)];
 return typeof value === "string" ? value : key;
}

function interpolate(text: string, vars?: TranslationVars): string {
 if (!vars) {
  return text;
 }
 return text.replace(/\{(\w+)\}/g, (match, name: string) =>
  Object.hasOwn(vars, name) ? String(vars[name]) : match
 );
}

interface I18nState {
 locale: Locale;
 setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>()((set) => ({
 locale: initialLocale(),
 setLocale: (locale) => {
  set({ locale });
  try {
   window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
  }
  applyDocumentLang(locale);
 },
}));

applyDocumentLang(useI18nStore.getState().locale);

export function formatRelative(ms: number, locale?: Locale): string {
 const active = locale ?? useI18nStore.getState().locale;
 const minutes = Math.floor(ms / 60_000);
 if (minutes < 1) {
  return lookup(messages[active], "common.justNow");
 }
 if (minutes < 60) {
  return `${minutes}m`;
 }
 const hours = Math.floor(minutes / 60);
 if (hours < 24) {
  return `${hours}h`;
 }
 return `${Math.floor(hours / 24)}d`;
}

export function t(key: TranslationKey, vars?: TranslationVars): string {
 return interpolate(
  lookup(messages[useI18nStore.getState().locale], key),
  vars
 );
}

export interface TranslationApi {
 t: (key: TranslationKey, vars?: TranslationVars) => string;
 locale: Locale;
 setLocale: (locale: Locale) => void;
 formatRelative: (ms: number) => string;
}

export function useTranslation(): TranslationApi {
 const locale = useI18nStore((state) => state.locale);
 const setLocale = useI18nStore((state) => state.setLocale);

 const translate = useCallback(
  (key: TranslationKey, vars?: TranslationVars) =>
   interpolate(lookup(messages[locale], key), vars),
  [locale]
 );
 const relative = useCallback((ms: number) => formatRelative(ms, locale), [
  locale,
 ]);

 return useMemo(
  () => ({
   t: translate,
   locale,
   setLocale,
   formatRelative: relative,
  }),
  [translate, locale, setLocale, relative]
 );
}
