## 0.0.9 (2026-09-08)

### 🚀 Features

- **account:** i18n reset-password screen, show email, and make Turnstile optional ([#52](https://github.com/mallwang/vaultfolio/pull/52))
- **frontend:** i18n browser tab titles and remove legacy route redirects ([#53](https://github.com/mallwang/vaultfolio/pull/53))
- **frontend-domain-klaro:** add Klaro nav entry and info page ([#54](https://github.com/mallwang/vaultfolio/pull/54))

## 0.0.8 (2026-09-08)

### 🚀 Features

- **account-overview:** add account overview CRUD feature end-to-end ([#42](https://github.com/mallwang/vaultfolio/pull/42))
- **frontend:** add forgot-password link to sign-in and i18n account screens ([#49](https://github.com/mallwang/vaultfolio/pull/49))
- **turnstile:** add Cloudflare Turnstile bot protection to signup and forgot-password ([#47](https://github.com/mallwang/vaultfolio/pull/47))

### 🩹 Fixes

- resolve SonarQube-flagged code quality issues across the codebase ([#44](https://github.com/mallwang/vaultfolio/pull/44))

## 0.0.7 (2026-09-06)

### 🚀 Features

- **frontend:** extract domain libraries and add per-account domain scopes ([#35](https://github.com/mallwang/vaultfolio/pull/35))
- **frontend:** extension-point mechanisms for Dashboard, Settings and Admin ([#36](https://github.com/mallwang/vaultfolio/pull/36))
- **frontend:** add locale-aware date/time formatting and admin UX polish ([#38](https://github.com/mallwang/vaultfolio/pull/38))
- **frontend-domain:** add five placeholder domains ([#37](https://github.com/mallwang/vaultfolio/pull/37))
- **holdings:** add per-asset-type holdings breakdown charts ([#39](https://github.com/mallwang/vaultfolio/pull/39))

### 🩹 Fixes

- **frontend:** enable HMR for symlinked workspace libs in dev server ([#41](https://github.com/mallwang/vaultfolio/pull/41))

## 0.0.6 (2026-09-04)

### 🚀 Features

- **frontend:** two-column layout for settings profile and preferences pages ([#25](https://github.com/mallwang/vaultfolio/pull/25))
- **frontend:** add locale-aware number and date formatting ([#26](https://github.com/mallwang/vaultfolio/pull/26))
- **frontend:** add collapsible sidebar with icon-only mode ([#27](https://github.com/mallwang/vaultfolio/pull/27))
- **frontend:** improve holding form UX and add PrimeNG tooltips across admin UI ([#34](https://github.com/mallwang/vaultfolio/pull/34))
- **holdings:** rename Gold/Bitcoin asset types and add name field ([#28](https://github.com/mallwang/vaultfolio/pull/28))
- **holdings:** add DEPOSIT_MONEY asset type for cash/bank balances ([#31](https://github.com/mallwang/vaultfolio/pull/31))

### 🩹 Fixes

- **frontend:** fix dark-mode chart legibility for pie labels and legend ([#29](https://github.com/mallwang/vaultfolio/pull/29))

## 0.0.5 (2026-09-01)

### 🚀 Features

- **frontend:** move holdings distribution to dashboard allocation ([#23](https://github.com/mallwang/vaultfolio/pull/23))
- **frontend:** migrate holdings distribution chart to ECharts ([#24](https://github.com/mallwang/vaultfolio/pull/24))
- **notifications:** add localized email notifications library ([#22](https://github.com/mallwang/vaultfolio/pull/22))

## 0.0.4 (2026-09-01)

### 🚀 Features

- **accounts:** add admin account management and invitation flow ([#11](https://github.com/mallwang/vaultfolio/pull/11))
- **auth:** add authentication, sessions, and per-user data isolation ([#10](https://github.com/mallwang/vaultfolio/pull/10))
- **branding:** add Vaultfolio branding (logo, favicon, teal theme, page titles) ([#16](https://github.com/mallwang/vaultfolio/pull/16))
- **frontend:** move authenticated routes under /app with a persistent header ([#14](https://github.com/mallwang/vaultfolio/pull/14))
- **frontend:** add light/dark theme toggle to the app header ([#15](https://github.com/mallwang/vaultfolio/pull/15))
- **frontend:** move admin sections into a dedicated admin area with role-gated nav ([#18](https://github.com/mallwang/vaultfolio/pull/18))
- **frontend:** add multilanguage support with English/German i18n ([#19](https://github.com/mallwang/vaultfolio/pull/19))
- **frontend:** make header language selector flag-only ([#20](https://github.com/mallwang/vaultfolio/pull/20))
- **frontend:** replace PrimeIcons with Material Symbols Outlined ([#21](https://github.com/mallwang/vaultfolio/pull/21))
- **profile:** add self-service profile, password, and account management ([#13](https://github.com/mallwang/vaultfolio/pull/13))
- **signups:** add self-service sign-up with admin approval ([#12](https://github.com/mallwang/vaultfolio/pull/12))

## 0.0.3 (2026-08-28)

### 🚀 Features

- **db:** migrate database from PostgreSQL to embedded SQLite ([#7](https://github.com/mallwang/vaultfolio/pull/7))
- **frontend:** scaffold PrimeNG app shell with navigation and placeholder areas ([#5](https://github.com/mallwang/vaultfolio/pull/5))
- **frontend:** proxy API calls through nginx and support Docker Hub deploys ([#9](https://github.com/mallwang/vaultfolio/pull/9))
- **holdings:** add manual holdings entry with asset-type-specific forms ([#6](https://github.com/mallwang/vaultfolio/pull/6))

## 0.0.2 (2026-08-28)

### 🚀 Features

- **tech-stack:** scaffold Nx monorepo with NestJS/Angular/Postgres and health-check slice ([#2](https://github.com/mallwang/vaultfolio/pull/2))
