import { CanActivate, Injectable } from '@nestjs/common';
import { FeedbackCryptoService } from './feedback-crypto.service';
import { FeedbackUnavailableException } from './feedback.exceptions';

/** Fails the feedback routes closed with `503 feedback_unavailable` while the key is unavailable. */
@Injectable()
export class FeedbackAvailableGuard implements CanActivate {
  constructor(private readonly crypto: FeedbackCryptoService) {}

  canActivate(): boolean {
    if (!this.crypto.available) throw new FeedbackUnavailableException();
    return true;
  }
}
