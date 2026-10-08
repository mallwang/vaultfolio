import {
  Component,
  ViewChild,
  computed,
  effect,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_SUBJECT_MAX,
} from '@vaultfolio/api-contract';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { I18nService, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { environment } from '../../../../environments/environment';
import { TurnstileComponent } from '../../../shared/turnstile/turnstile.component';
import { FeedbackStore } from '../feedback.store';

@Component({
  selector: 'app-feedback-dialog',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectButtonModule,
    TextareaModule,
    TranslatePipe,
    TurnstileComponent,
  ],
  templateUrl: './feedback-dialog.component.html',
  styleUrl: './feedback-dialog.component.css',
})
export class FeedbackDialogComponent {
  protected readonly store = inject(FeedbackStore);
  private readonly i18n = inject(I18nService);

  @ViewChild('turnstileRef') private readonly turnstileRef?: TurnstileComponent;

  protected readonly subjectMax = FEEDBACK_SUBJECT_MAX;
  protected readonly messageMax = FEEDBACK_MESSAGE_MAX;
  protected readonly siteKey = window.__env?.turnstileSiteKey ?? environment.turnstileSiteKey;
  protected readonly token = signal<string | null>(null);
  protected readonly confirming = signal(false);
  protected readonly subjectTouched = signal(false);
  protected readonly messageTouched = signal(false);

  protected readonly categories = computed(() => {
    this.i18n.language();
    return FEEDBACK_CATEGORIES.map((value) => ({
      value,
      label: this.i18n.translate(`feedback.categories.${value}`),
    }));
  });

  protected readonly invalid = computed(
    () => this.store.subject().trim() === '' || this.store.message().trim() === '',
  );
  protected readonly canSend = computed(
    () =>
      !this.invalid() &&
      (!this.siteKey || !!this.token()) &&
      !this.store.pending() &&
      !this.store.limited(),
  );

  protected readonly dots = computed(() => {
    const q = this.store.quota();
    return q ? Array.from({ length: q.limit }, (_, i) => i < q.remaining) : [];
  });

  protected readonly resetTime = computed(() => {
    const at = this.store.quota()?.resetAt;
    return at
      ? new Date(at).toLocaleTimeString(this.i18n.language(), {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
  });

  constructor() {
    effect(() => {
      if (!this.store.open()) {
        this.token.set(null);
        this.confirming.set(false);
        this.subjectTouched.set(false);
        this.messageTouched.set(false);
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.store.open() || this.store.pending()) return;
    if (this.confirming()) this.confirming.set(false);
    else this.cancel();
  }

  protected cancel(): void {
    if (this.store.pending()) return;
    if (this.store.hasText()) this.confirming.set(true);
    else this.store.discard();
  }

  protected keepDraft(): void {
    this.store.keepDraft();
  }

  protected discard(): void {
    this.store.discard();
  }

  protected async send(): Promise<void> {
    if (!this.canSend()) return;
    const ok = await this.store.send(this.token());
    if (!ok) {
      this.token.set(null);
      this.turnstileRef?.reset();
    }
  }
}
