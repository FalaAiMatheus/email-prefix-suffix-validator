import type { Matcher } from './types.ts';

export type CompiledMatcher = (part: string, email: string) => boolean;

function globToRegExp(pattern: string, caseSensitive: boolean): RegExp {
  const source = pattern
    .split('*')
    .map((chunk) => chunk.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}$`, caseSensitive ? '' : 'i');
}

export function compileMatchers(
  input: Matcher | readonly Matcher[] | undefined,
  caseSensitive: boolean
): CompiledMatcher[] {
  if (input === undefined) return [];
  const list: readonly Matcher[] = Array.isArray(input) ? input : [input];

  return list.map((matcher): CompiledMatcher => {
    if (typeof matcher === 'function') return matcher;
    const regex =
      typeof matcher === 'string'
        ? globToRegExp(matcher, caseSensitive)
        : // Drop stateful flags so `test` never depends on a previous call.
          new RegExp(matcher.source, matcher.flags.replace(/[gy]/g, ''));
    return (part) => regex.test(part);
  });
}
