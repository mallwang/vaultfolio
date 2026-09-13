/**
 * Barrel for the decorated DTO classes under this folder — one file per
 * `libs/api-contract` module, existing solely so `@nestjs/swagger` has
 * runtime-reflectable classes to point controller signatures at (research.md
 * #1). `libs/api-contract`'s plain interfaces remain the actual type-checked
 * shape; these classes are a presentation-layer mirror, not a replacement.
 */
export * from './auth';
export * from './accounts';
export * from './holdings';
export * from './invitations';
export * from './signups';
export * from './profile';
export * from './account-overview';
export * from './error-response';
