/**
 * A rule used to match one part of an email address.
 *
 * - `string`: glob pattern, where `*` matches any sequence of characters
 *   (e.g. `'admin'`, `'no-reply*'`, `'*.edu.br'`).
 * - `RegExp`: tested against the part as-is.
 * - `function`: receives the part and the full email; return `true` to match.
 */
export type Matcher =
  | string
  | RegExp
  | ((part: string, email: string) => boolean);

export interface PartRules {
  /** When set, the part must match at least one of these. Empty = no restriction. */
  allow?: Matcher | readonly Matcher[];
  /** The part must not match any of these. Takes precedence over `allow`. */
  deny?: Matcher | readonly Matcher[];
}

export type EmailIssueCode =
  | 'invalid_type'
  | 'invalid_format'
  | 'prefix_not_allowed'
  | 'prefix_denied'
  | 'prefix_reserved'
  | 'suffix_not_allowed'
  | 'suffix_denied';

export interface MessageContext {
  code: EmailIssueCode;
  /** The value being validated (only a string when the type was valid). */
  email: unknown;
  /** Local part, before the last `@`. Empty when the format is invalid. */
  prefix: string;
  /** Domain, after the last `@` (lowercased). Empty when the format is invalid. */
  suffix: string;
}

export type Message = string | ((ctx: MessageContext) => string);

export interface EmailValidatorOptions {
  /** Rules applied to the local part (before `@`). */
  prefix?: PartRules;
  /** Rules applied to the domain (after `@`). */
  suffix?: PartRules;
  /**
   * Block well-known non-personal prefixes (`admin`, `postmaster`,
   * `no-reply`, ...). Matching ignores case, `.`/`-`/`_` and `+tags`.
   *
   * - `true`: block `DEFAULT_KNOWN_PREFIXES` (system + no-reply groups).
   * - `false`: block none.
   * - `string[]`: block exactly these, e.g.
   *   `[...DEFAULT_KNOWN_PREFIXES, ...KNOWN_PREFIXES.role]`.
   * @default true
   */
  knownPrefixes?: boolean | readonly string[];
  /**
   * Whether string matchers on the prefix are case-sensitive.
   * Domains are always compared case-insensitively.
   * @default false
   */
  caseSensitive?: boolean;
  /**
   * Check that the value looks like an email before applying the rules.
   * Disable it if another validator (e.g. `z.email()`) already does that.
   * @default true
   */
  checkFormat?: boolean;
  /** Override the default message of each issue code. */
  messages?: Partial<Record<EmailIssueCode, Message>>;
}

export interface EmailIssue {
  code: EmailIssueCode;
  message: string;
}

export type EmailValidationResult =
  | {
      success: true;
      value: string;
      prefix: string;
      suffix: string;
      issues?: undefined;
    }
  | { success: false; issues: EmailIssue[] };

/** Standard Schema v1 (https://standardschema.dev), inlined to avoid a runtime dependency. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

// oxlint-disable-next-line typescript/no-namespace
export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
      options?: Options | undefined
    ) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }
  export interface Options {
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
  export type Result<Output> = SuccessResult<Output> | FailureResult;
  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }
  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }
  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }
  export interface PathSegment {
    readonly key: PropertyKey;
  }
  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }
}
