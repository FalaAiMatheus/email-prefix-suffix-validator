export {
  DEFAULT_KNOWN_PREFIXES,
  KNOWN_PREFIXES,
  normalizeKnownPrefix,
} from './known-prefixes.ts';
export {
  createEmailValidator,
  validateEmail,
  EmailValidationError,
  type EmailValidator,
} from './validator.ts';
export type {
  EmailIssue,
  EmailIssueCode,
  EmailValidationResult,
  EmailValidatorOptions,
  Matcher,
  Message,
  MessageContext,
  PartRules,
  StandardSchemaV1,
} from './types.ts';
