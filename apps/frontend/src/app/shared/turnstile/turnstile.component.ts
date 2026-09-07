import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  output,
} from '@angular/core';

@Component({
  selector: 'app-turnstile',
  standalone: true,
  template: `<div #container></div>`,
})
export class TurnstileComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) siteKey!: string;
  @Input({ required: true }) action!: string;

  readonly tokenChange = output<string | null>();

  @ViewChild('container', { static: true }) private readonly container!: ElementRef<HTMLElement>;

  private widgetId: string | undefined;

  ngAfterViewInit(): void {
    if (!window.turnstile) {
      return;
    }
    this.widgetId = window.turnstile.render(this.container.nativeElement, {
      sitekey: this.siteKey,
      action: this.action,
      callback: (token: string) => this.tokenChange.emit(token),
      'expired-callback': () => this.tokenChange.emit(null),
      'error-callback': () => this.tokenChange.emit(null),
    });
  }

  reset(): void {
    if (window.turnstile && this.widgetId !== undefined) {
      window.turnstile.reset(this.widgetId);
    }
  }

  ngOnDestroy(): void {
    if (window.turnstile && this.widgetId !== undefined) {
      window.turnstile.remove(this.widgetId);
    }
  }
}
