/**
 * Well-known non-personal email prefixes (local parts).
 *
 * Entries are compared after normalization (see `normalizeKnownPrefix`), so
 * `'noreply'` also covers `no-reply`, `No_Reply`, `no.reply` and `noreply+tag`.
 */
export const KNOWN_PREFIXES = {
  /** Mailbox and infrastructure names from RFC 2142 and common system accounts. */
  system: [
    'abuse',
    'admin',
    'administrator',
    'daemon',
    'ftp',
    'hostmaster',
    'mailerdaemon',
    'news',
    'noc',
    'nobody',
    'postmaster',
    'root',
    'security',
    'sysadmin',
    'usenet',
    'uucp',
    'webmaster',
    'www',
  ],
  /** Automated / unmonitored senders. */
  noReply: [
    'bounce',
    'bounces',
    'donotreply',
    'naoresponda',
    'naoresponder',
    'noreply',
    'notifications',
    'notification',
    'notify',
  ],
  /** Shared team / department mailboxes (English and Portuguese). */
  role: [
    'atendimento',
    'billing',
    'careers',
    'comercial',
    'contact',
    'contato',
    'contatos',
    'faturamento',
    'financeiro',
    'hello',
    'help',
    'helpdesk',
    'hr',
    'info',
    'jobs',
    'marketing',
    'office',
    'ouvidoria',
    'rh',
    'sac',
    'sales',
    'suporte',
    'support',
    'team',
    'vendas',
  ],
} as const satisfies Record<string, readonly string[]>;

/** Groups blocked when `knownPrefixes` is `true` (the default). */
export const DEFAULT_KNOWN_PREFIXES: readonly string[] = [
  ...KNOWN_PREFIXES.system,
  ...KNOWN_PREFIXES.noReply,
];

/** Lowercase, drop the `+tag` sub-address and the `.`, `-`, `_` separators. */
export function normalizeKnownPrefix(prefix: string): string {
  const plus = prefix.indexOf('+');
  return (plus === -1 ? prefix : prefix.slice(0, plus))
    .toLowerCase()
    .replace(/[._-]/g, '');
}
