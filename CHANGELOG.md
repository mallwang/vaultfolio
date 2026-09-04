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
