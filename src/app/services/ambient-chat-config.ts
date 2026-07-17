/**
 * Configuración de la CHARLA AMBIENTAL del chat (AmbientChatService).
 *
 * Otros personajes NO controlados (héroes del roster desbloqueados + personajes con
 * voz propia como Mordekai) sueltan frases al azar en el registro de chat, y a veces
 * conversan entre ellos. Todos los textos son claves i18n (en.json/es.json →
 * `CHAT_AMBIENT.*`); el servicio las resuelve al publicarlas.
 */

/** Personaje con voz propia (frases específicas). */
export interface NamedChatter {
  /** Nombre mostrado en el chat ("Mordekai"). */
  name: string;
  /** Claves i18n de sus frases al azar. */
  lineKeys: string[];
  /** Nombre de personaje que debe estar desbloqueado para que hable. Omitir = siempre. */
  requiresUnlock?: string;
}

/** Línea de un guion con retardo (apertura o conversación). */
export interface ChatScriptLine {
  speaker: string;
  key: string;
  /** Retardo, en ms, desde el inicio del guion (o de la partida, en la apertura). */
  delayMs: number;
}

/** Frases genéricas que puede soltar cualquier héroe del roster (no controlado). */
export const AMBIENT_LINE_KEYS: string[] = [
  'CHAT_AMBIENT.GENERIC.L1',
  'CHAT_AMBIENT.GENERIC.L2',
  'CHAT_AMBIENT.GENERIC.L3',
  'CHAT_AMBIENT.GENERIC.L4',
  'CHAT_AMBIENT.GENERIC.L5',
];

/** Personajes con frases propias. Mordekai habla siempre (sin requiresUnlock). */
export const NAMED_CHATTERS: NamedChatter[] = [
  {
    name: 'Mordekai',
    lineKeys: [
      'CHAT_AMBIENT.MORDEKAI.CHEESE',
      'CHAT_AMBIENT.MORDEKAI.L1',
      'CHAT_AMBIENT.MORDEKAI.L2',
    ],
  },
];

/** Frases de apertura al empezar la partida (una sola vez, tras `start()`). */
export const OPENING_LINES: ChatScriptLine[] = [
  { speaker: 'Mordekai', key: 'CHAT_AMBIENT.MORDEKAI.CHEESE', delayMs: 10000 },
];

/** Ventana (ms) entre frases ambientales al azar. */
export const AMBIENT_MIN_MS = 22000;
export const AMBIENT_MAX_MS = 55000;
/** Probabilidad de que un tick lance una conversación (2 PJs) en vez de una frase suelta. */
export const CONVERSATION_CHANCE = 0.3;
