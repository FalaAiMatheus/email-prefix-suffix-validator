# email-prefix-suffix-validator

Validate email addresses by **prefix** (local part, before `@`) and **suffix** (domain, after `@`) rules. Zero dependencies, and it works with any validation library: Zod, Yup, Joi, Valibot, Standard Schema, react-hook-form, and others.

```sh
pnpm add email-prefix-suffix-validator
```

## Usage

```ts
import { createEmailValidator } from 'email-prefix-suffix-validator';

const corporateEmail = createEmailValidator({
  prefix: { deny: ['admin', 'no-reply*', /^test\d*$/] },
  suffix: { allow: ['empresa.com.br', '*.empresa.com.br'] },
});

corporateEmail.isValid('joao@empresa.com.br'); // true
corporateEmail.isValid('joao@rh.empresa.com.br'); // true
corporateEmail.isValid('joao@gmail.com'); // false
corporateEmail.getError('admin@empresa.com.br'); // 'Email prefix "admin" is not allowed'
corporateEmail.validate('admin@gmail.com');
// { success: false, issues: [{ code: 'prefix_denied', ... }, { code: 'suffix_not_allowed', ... }] }
corporateEmail.assert('joao@gmail.com'); // throws EmailValidationError
```

### Matchers

Each `allow` / `deny` takes one matcher or an array of them:

| Matcher    | Example                            | Matches                                  |
| ---------- | ---------------------------------- | ---------------------------------------- |
| exact      | `'empresa.com'`                    | `empresa.com` only                       |
| glob (`*`) | `'*.edu.br'`, `'no-reply*'`        | `ufpe.edu.br`, `no-reply.sales`          |
| `RegExp`   | `/^test\d*$/`                      | tested against the part as-is            |
| function   | `(part, email) => part.length > 3` | whatever the function returns `true` for |

Rules:

- `deny` takes precedence over `allow`. The order of checks is your `deny`, then known prefixes, then your `allow`.
- When `allow` is set and not empty, the part must match at least one entry.
- Domains are lowercased before matching. String matchers on the prefix ignore case unless you pass `caseSensitive: true`.
- `'*.empresa.com'` matches subdomains only. To also match the apex domain, add `'empresa.com'` too.

### Known prefixes

By default, the validator blocks well-known non-personal prefixes and reports them as `prefix_reserved`. The comparison ignores case, `.`, `-`, `_` and `+tags`, so `'noreply'` also blocks `No-Reply`, `no.reply` and `noreply+x`.

| Group                    | Blocked by default | Examples                                                              |
| ------------------------ | ------------------ | --------------------------------------------------------------------- |
| `KNOWN_PREFIXES.system`  | yes                | `admin`, `root`, `postmaster`, `abuse`, `webmaster`, `mailer-daemon`  |
| `KNOWN_PREFIXES.noReply` | yes                | `noreply`, `do-not-reply`, `nao-responda`, `bounce`                   |
| `KNOWN_PREFIXES.role`    | no                 | `info`, `contact`, `support`, `sales`, `contato`, `suporte`, `vendas` |

```ts
import {
  createEmailValidator,
  DEFAULT_KNOWN_PREFIXES,
  KNOWN_PREFIXES,
} from 'email-prefix-suffix-validator';

createEmailValidator({ knownPrefixes: false }); // block none
createEmailValidator({
  knownPrefixes: [...DEFAULT_KNOWN_PREFIXES, ...KNOWN_PREFIXES.role], // stricter
});
createEmailValidator({
  knownPrefixes: DEFAULT_KNOWN_PREFIXES.filter((p) => p !== 'admin'), // looser
});
```

### Options

```ts
createEmailValidator({
  prefix: { allow, deny },
  suffix: { allow, deny },
  knownPrefixes: true, // true | false | string[]
  caseSensitive: false, // prefix string matchers
  checkFormat: true, // basic email format check; turn it off if your schema already checks the format
  messages: {
    suffix_not_allowed: ({ suffix }) => `Domínio ${suffix} não permitido`,
    invalid_format: 'E-mail inválido',
  },
});
```

Issue codes: `invalid_type`, `invalid_format`, `prefix_not_allowed`, `prefix_denied`, `prefix_reserved`, `suffix_not_allowed`, `suffix_denied`.

## Integrations

```ts
// Zod (v3 / v4)
z.string().email().superRefine(corporateEmail.zod);

// Yup (empty values pass, so .required() can handle them)
yup.string().required().test(corporateEmail.yup);

// Joi
Joi.string().custom(corporateEmail.joi);

// Valibot
v.pipe(
  v.string(),
  v.check(
    (email) => corporateEmail.isValid(email),
    (issue) => corporateEmail.getError(issue.input)!
  )
);

// Standard Schema (TanStack Form, tRPC, @hookform/resolvers/standard-schema, ...)
<form.Field name="email" validators={{ onChange: corporateEmail }} />;

// (value) => true | message: react-hook-form, VeeValidate, Vuetify/Quasar rules
register('email', { validate: corporateEmail.rule });
```

## License

MIT
