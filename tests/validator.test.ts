import type { StandardSchemaV1 } from '@standard-schema/spec';
import Joi from 'joi';
import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as yup from 'yup';
import { z } from 'zod';
import {
  createEmailValidator,
  DEFAULT_KNOWN_PREFIXES,
  EmailValidationError,
  KNOWN_PREFIXES,
  validateEmail,
} from '../src/main.ts';

const corporate = createEmailValidator({
  prefix: { deny: ['admin', 'no-reply*', /^test\d*$/] },
  suffix: { allow: ['empresa.com.br', '*.empresa.com.br'] },
});

describe('core', () => {
  it('accepts emails that match the rules', () => {
    expect(corporate.validate('joao@empresa.com.br')).toEqual({
      success: true,
      value: 'joao@empresa.com.br',
      prefix: 'joao',
      suffix: 'empresa.com.br',
    });
    expect(corporate.isValid('maria@rh.empresa.com.br')).toBe(true);
    expect(corporate.isValid('Maria@EMPRESA.com.BR')).toBe(true);
  });

  it('rejects domains outside the allow list', () => {
    expect(corporate.validate('joao@gmail.com')).toEqual({
      success: false,
      issues: [
        {
          code: 'suffix_not_allowed',
          message: 'Email domain "gmail.com" is not allowed',
        },
      ],
    });
    expect(corporate.isValid('joao@empresa.com.br.evil.com')).toBe(false);
    expect(corporate.isValid('joao@fakeempresa.com.br')).toBe(false);
  });

  it('rejects denied prefixes (glob, exact, regex, case-insensitive)', () => {
    expect(corporate.getError('ADMIN@empresa.com.br')).toBe(
      'Email prefix "ADMIN" is not allowed'
    );
    expect(corporate.isValid('no-reply.vendas@empresa.com.br')).toBe(false);
    expect(corporate.isValid('test42@empresa.com.br')).toBe(false);
    expect(corporate.isValid('tester@empresa.com.br')).toBe(true);
  });

  it('reports prefix and suffix issues together', () => {
    const result = corporate.validate('admin@gmail.com');
    expect(result.issues?.map((i) => i.code)).toEqual([
      'prefix_denied',
      'suffix_not_allowed',
    ]);
  });

  it('deny wins over allow', () => {
    const validator = createEmailValidator({
      suffix: { allow: '*.edu.br', deny: 'aluno.*.edu.br' },
    });
    expect(validator.isValid('a@ufpe.edu.br')).toBe(true);
    expect(validator.isValid('a@aluno.ufpe.edu.br')).toBe(false);
    expect(validator.isValid('a@edu.br')).toBe(false);
  });

  it('supports prefix allow lists and case sensitivity', () => {
    const validator = createEmailValidator({
      prefix: { allow: 'dev.*' },
      caseSensitive: true,
    });
    expect(validator.isValid('dev.ana@x.com')).toBe(true);
    expect(validator.isValid('DEV.ana@x.com')).toBe(false);
    expect(validator.isValid('ana@x.com')).toBe(false);
  });

  it('supports function matchers', () => {
    const validator = createEmailValidator({
      prefix: { deny: (prefix) => prefix.includes('+') },
    });
    expect(validator.isValid('ana+spam@x.com')).toBe(false);
    expect(validator.isValid('ana@x.com')).toBe(true);
  });

  it('is not affected by global/sticky regex state', () => {
    const validator = createEmailValidator({ prefix: { allow: /^a/g } });
    expect(validator.isValid('ana@x.com')).toBe(true);
    expect(validator.isValid('ana@x.com')).toBe(true);
  });

  it('treats empty allow lists as no restriction', () => {
    expect(validateEmail('a@x.com', { suffix: { allow: [] } }).success).toBe(
      true
    );
  });

  it('validates type and format', () => {
    expect(corporate.validate(42).issues?.[0]?.code).toBe('invalid_type');
    for (const bad of ['', 'joao', 'joao@', '@empresa.com.br', 'a b@x.com']) {
      expect(corporate.validate(bad).issues?.[0]?.code).toBe('invalid_format');
    }
  });

  it('can skip the format check', () => {
    const validator = createEmailValidator({ checkFormat: false });
    expect(validator.isValid('a b@localhost')).toBe(true);
    expect(validator.isValid('joao@')).toBe(false);
  });

  it('supports custom messages', () => {
    const validator = createEmailValidator({
      suffix: { allow: 'empresa.com' },
      messages: {
        suffix_not_allowed: ({ suffix }) => `Domínio ${suffix} não permitido`,
        invalid_format: 'E-mail inválido',
      },
    });
    expect(validator.getError('a@gmail.com')).toBe(
      'Domínio gmail.com não permitido'
    );
    expect(validator.getError('nope')).toBe('E-mail inválido');
  });

  it('assert throws EmailValidationError', () => {
    expect(() => corporate.assert('a@gmail.com')).toThrow(EmailValidationError);
    expect(() => corporate.assert('a@empresa.com.br')).not.toThrow();
  });
});

describe('known prefixes', () => {
  const validator = createEmailValidator();

  it('blocks system and no-reply prefixes by default', () => {
    for (const email of [
      'postmaster@x.com',
      'Admin@x.com',
      'no-reply@x.com',
      'No_Reply@x.com',
      'do.not.reply@x.com',
      'nao-responda@x.com',
      'mailer-daemon@x.com',
      'webmaster+tag@x.com',
    ]) {
      expect(validator.validate(email).issues?.[0]?.code, email).toBe(
        'prefix_reserved'
      );
    }
    expect(validator.getError('root@x.com')).toBe(
      'Email prefix "root" is reserved, use a personal address'
    );
  });

  it('does not block personal or role prefixes by default', () => {
    for (const email of ['joao@x.com', 'administrativo@x.com', 'info@x.com']) {
      expect(validator.isValid(email), email).toBe(true);
    }
  });

  it('can be disabled, extended or narrowed', () => {
    expect(validateEmail('admin@x.com', { knownPrefixes: false }).success).toBe(
      true
    );

    const strict = createEmailValidator({
      knownPrefixes: [...DEFAULT_KNOWN_PREFIXES, ...KNOWN_PREFIXES.role],
    });
    expect(strict.isValid('contato@x.com')).toBe(false);
    expect(strict.isValid('support@x.com')).toBe(false);

    const custom = createEmailValidator({ knownPrefixes: ['no-reply'] });
    expect(custom.isValid('noreply@x.com')).toBe(false);
    expect(custom.isValid('admin@x.com')).toBe(true);
  });

  it('user deny rules are reported before known prefixes', () => {
    expect(corporate.validate('admin@empresa.com.br').issues?.[0]?.code).toBe(
      'prefix_denied'
    );
  });
});

describe('adapters', () => {
  it('zod', () => {
    const schema = z.object({ email: z.string().superRefine(corporate.zod) });
    expect(schema.safeParse({ email: 'a@empresa.com.br' }).success).toBe(true);
    const result = schema.safeParse({ email: 'admin@gmail.com' });
    expect(result.error?.issues.map((i) => [i.path, i.message])).toEqual([
      [['email'], 'Email prefix "admin" is not allowed'],
      [['email'], 'Email domain "gmail.com" is not allowed'],
    ]);
  });

  it('yup', async () => {
    const schema = yup.object({
      email: yup.string().required().test(corporate.yup),
      optional: yup.string().test(corporate.yup),
    });
    await expect(
      schema.validate({ email: 'a@empresa.com.br' })
    ).resolves.toBeTruthy();
    await expect(schema.validate({ email: 'a@gmail.com' })).rejects.toThrow(
      'Email domain "gmail.com" is not allowed'
    );
  });

  it('joi', () => {
    const schema = Joi.string().custom(corporate.joi);
    expect(schema.validate('a@empresa.com.br').error).toBeUndefined();
    expect(schema.validate('a@gmail.com').error?.message).toBe(
      'Email domain "gmail.com" is not allowed'
    );
  });

  it('valibot', () => {
    const schema = v.pipe(
      v.string(),
      v.check(
        (email) => corporate.isValid(email),
        (issue) => corporate.getError(issue.input)!
      )
    );
    expect(v.safeParse(schema, 'a@empresa.com.br').success).toBe(true);
    expect(v.safeParse(schema, 'a@gmail.com').issues?.[0]?.message).toBe(
      'Email domain "gmail.com" is not allowed'
    );
  });

  it('standard schema', async () => {
    expectTypeOf(corporate).toExtend<StandardSchemaV1<string, string>>();
    const std = corporate['~standard'];
    expect(await std.validate('a@empresa.com.br')).toEqual({
      value: 'a@empresa.com.br',
    });
    expect((await std.validate('a@gmail.com')).issues?.length).toBe(1);
  });

  it('rule (react-hook-form, vee-validate, vuetify...)', () => {
    expect(corporate.rule('')).toBe(true);
    expect(corporate.rule(undefined)).toBe(true);
    expect(corporate.rule('a@empresa.com.br')).toBe(true);
    expect(corporate.rule('a@gmail.com')).toBe(
      'Email domain "gmail.com" is not allowed'
    );
  });
});
