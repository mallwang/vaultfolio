import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { IconComponent } from '../../shared/icon/icon.component';
import { SUPPORTED_LANGUAGES } from '@vaultfolio/api-contract';
import type { LanguageCode } from '@vaultfolio/api-contract';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ProfileService } from '../profile/profile.service';

/** `null` represents "Use default" (design.md) — the unset state (research.md #3). */
const USE_DEFAULT = '__use_default__';

/**
 * Settings > Preferences (013-multilanguage-support, US2): the "Email
 * correspondence language" control (design.md "Email correspondence
 * language setting"), independent of the display-language switcher in the
 * header (FR-009). Pre-fills from `I18nService`'s current display language
 * only when unset (research.md #3 — a client-side convenience, never
 * auto-saved), and only becomes the stored value once the user saves it.
 */
@Component({
  selector: 'app-preferences',
  imports: [
    ButtonModule,
    CardModule,
    FormsModule,
    SelectModule,
    TagModule,
    ToastModule,
    TranslatePipe,
    IconComponent,
  ],
  providers: [MessageService, TranslatePipe],
  templateUrl: './preferences.component.html',
  styleUrl: './preferences.component.css',
})
export class PreferencesComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly i18nService = inject(I18nService);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslatePipe);

  protected readonly languageOptions = [
    { code: USE_DEFAULT, label: 'preferences.language.useDefault' },
    ...SUPPORTED_LANGUAGES.map((language) => ({ code: language.code, label: language.label })),
  ];

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  /** The select's bound value — `USE_DEFAULT` stands in for the `null`/unset state. */
  protected readonly selectedCode = signal<string>(USE_DEFAULT);
  /** The last-saved value from the server, used to know whether the fallback note applies. */
  protected readonly emailLanguage = signal<LanguageCode | null>(null);

  ngOnInit(): void {
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.emailLanguage.set(profile.emailLanguage);
        // research.md #3: pre-fill with the current display language only
        // when nothing is explicitly set yet — a suggested starting value,
        // not an implicit write.
        this.selectedCode.set(profile.emailLanguage ?? this.i18nService.language());
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected get isUnset(): boolean {
    return this.emailLanguage() === null;
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const emailLanguage: LanguageCode | null =
      this.selectedCode() === USE_DEFAULT ? null : this.selectedCode();
    this.saving.set(true);
    this.profileService.updateEmailLanguage({ emailLanguage }).subscribe({
      next: (profile) => {
        this.saving.set(false);
        this.emailLanguage.set(profile.emailLanguage);
        this.selectedCode.set(profile.emailLanguage ?? USE_DEFAULT);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.transform('preferences.language.saved'),
        });
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.transform('preferences.language.saveError'),
        });
      },
    });
  }
}
