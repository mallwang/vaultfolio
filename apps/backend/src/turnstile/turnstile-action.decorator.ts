import { SetMetadata } from '@nestjs/common';

export const TURNSTILE_ACTION_KEY = 'turnstile_action';

export const TurnstileAction = (action: string) => SetMetadata(TURNSTILE_ACTION_KEY, action);
