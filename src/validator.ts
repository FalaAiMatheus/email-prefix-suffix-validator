import {
  DEFAULT_KNOWN_PREFIXES,
  normalizeKnownPrefix,
} from './known-prefixes.ts';
import { compileMatchers, type CompiledMatcher } from './matcher.ts';
import type {
  EmailIssue,
  EmailIssueCode,
  EmailValidationResult,
  EmailValidatorOptions,
  Message,
  MessageContext,
  StandardSchemaV1,
} from './types.ts';

// HTML living standard email pattern, requiring at least one dot in the domain.
const EMAIL_FORMAT =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const DEFAULT_MESSAGES: Record<EmailIssueCode, Message> = {
  invalid_type: 'Email must be a string',
  invalid_format: 'Invalid email address',
  prefix_not_allowed: ({ prefix }) => `Email prefix "${prefix}" is not allowed`,
  prefix_denied: ({ prefix }) => `Email prefix "${prefix}" is not allowed`,
  prefix_reserved: ({ prefix }) =>
    `Email prefix "${prefix}" is reserved, use a personal address`,
  suffix_not_allowed: ({ suffix }) => `Email domain "${suffix}" is not allowed`,
  suffix_denied: ({ suffix }) => `Email domain "${suffix}" is not allowed`,
};

export class EmailValidationError extends Error {
  readonly issues: EmailIssue[];

  constructor(issues: EmailIssue[]) {
    super(issues.map((issue) => issue.message).join('; '));
    this.name = 'EmailValidationError';
    this.issues = issues;
  }
}

/** Values treated as "not filled" by the form-library adapters. */
function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export interface EmailValidator extends StandardSchemaV1<string, string> {
  /** Validate a value and return every issue found. */
  validate(value: unknown): EmailValidationResult;
  /** Type guard: `true` when the value passes every rule. */
  isValid(value: unknown): value is string;
  /** Throw an `EmailValidationError` when the value is invalid. */
  assert(value: unknown): asserts value is string;
  /** First error message, or `undefined` when valid. */
  getError(value: unknown): string | undefined;

  /**
   * `(value) => true | message`. Works with react-hook-form `validate`,
   * VeeValidate, Vuetify / Quasar rules, etc. Empty values pass so that a
   * separate `required` rule can handle them.
   */
  rule: (value: unknown) => true | string;

  /** Zod (v3 / v4): `z.string().superRefine(validator.zod)` */
  zod: (
    value: string,
    ctx: { addIssue(issue: { code: 'custom'; message: string }): void }
  ) => void;

  /** Yup: `yup.string().test(validator.yup)`. Empty values pass. */
  yup: {
    name: string;
    test: <E>(
      value: unknown,
      ctx: { createError(params: { message: string }): E }
    ) => true | E;
  };

  /** Joi: `Joi.string().custom(validator.joi)` */
  joi: <V, E>(
    value: V,
    helpers: { message(messages: { custom: string }): E }
  ) => V | E;
}

export function createEmailValidator(
  options: EmailValidatorOptions = {}
): EmailValidator {
  const caseSensitive = options.caseSensitive ?? false;
  const checkFormat = options.checkFormat ?? true;
  const messages = { ...DEFAULT_MESSAGES, ...options.messages };

  const prefixAllow = compileMatchers(options.prefix?.allow, caseSensitive);
  const prefixDeny = compileMatchers(options.prefix?.deny, caseSensitive);
  // Domains are case-insensitive and are lowercased before matching.
  const suffixAllow = compileMatchers(options.suffix?.allow, false);
  const suffixDeny = compileMatchers(options.suffix?.deny, false);

  const knownPrefixes = options.knownPrefixes ?? true;
  const reserved = new Set(
    (knownPrefixes === true ? DEFAULT_KNOWN_PREFIXES : knownPrefixes || []).map(
      normalizeKnownPrefix
    )
  );

  const issue = (
    code: EmailIssueCode,
    ctx: Omit<MessageContext, 'code'>
  ): EmailIssue => {
    const message = messages[code];
    return {
      code,
      message:
        typeof message === 'function' ? message({ code, ...ctx }) : message,
    };
  };

  const matchesAny = (
    matchers: CompiledMatcher[],
    part: string,
    email: string
  ) => matchers.some((match) => match(part, email));

  const validate = (value: unknown): EmailValidationResult => {
    if (typeof value !== 'string') {
      return {
        success: false,
        issues: [
          issue('invalid_type', { email: value, prefix: '', suffix: '' }),
        ],
      };
    }

    const at = value.lastIndexOf('@');
    if (
      (checkFormat && !EMAIL_FORMAT.test(value)) ||
      at <= 0 ||
      at === value.length - 1
    ) {
      return {
        success: false,
        issues: [
          issue('invalid_format', { email: value, prefix: '', suffix: '' }),
        ],
      };
    }

    const prefix = value.slice(0, at);
    const suffix = value.slice(at + 1).toLowerCase();
    const ctx = { email: value, prefix, suffix };
    const issues: EmailIssue[] = [];

    if (matchesAny(prefixDeny, prefix, value)) {
      issues.push(issue('prefix_denied', ctx));
    } else if (reserved.has(normalizeKnownPrefix(prefix))) {
      issues.push(issue('prefix_reserved', ctx));
    } else if (prefixAllow.length && !matchesAny(prefixAllow, prefix, value)) {
      issues.push(issue('prefix_not_allowed', ctx));
    }

    if (matchesAny(suffixDeny, suffix, value)) {
      issues.push(issue('suffix_denied', ctx));
    } else if (suffixAllow.length && !matchesAny(suffixAllow, suffix, value)) {
      issues.push(issue('suffix_not_allowed', ctx));
    }

    return issues.length
      ? { success: false, issues }
      : { success: true, value, prefix, suffix };
  };

  const getError = (value: unknown) => validate(value).issues?.[0]?.message;

  return {
    validate,
    isValid: (value): value is string => validate(value).success,
    assert(value) {
      const result = validate(value);
      if (!result.success) throw new EmailValidationError(result.issues);
    },
    getError,

    rule: (value) => (isEmpty(value) ? true : (getError(value) ?? true)),

    zod: (value, ctx) => {
      for (const { message } of validate(value).issues ?? []) {
        ctx.addIssue({ code: 'custom', message });
      }
    },

    yup: {
      name: 'email-prefix-suffix',
      test: (value, ctx) => {
        if (isEmpty(value)) return true;
        const message = getError(value);
        return message === undefined ? true : ctx.createError({ message });
      },
    },

    joi: (value, helpers) => {
      const message = getError(value);
      return message === undefined
        ? value
        : helpers.message({ custom: message });
    },

    '~standard': {
      version: 1,
      vendor: 'email-prefix-suffix-validator',
      validate: (value) => {
        const result = validate(value);
        return result.success
          ? { value: result.value }
          : { issues: result.issues };
      },
    },
  };
}

/** One-off validation without keeping a validator instance around. */
export function validateEmail(
  value: unknown,
  options?: EmailValidatorOptions
): EmailValidationResult {
  return createEmailValidator(options).validate(value);
}
