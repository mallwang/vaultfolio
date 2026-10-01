import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { RequestDetailComponent } from './request-detail.component';
import { RequestsTableComponent } from './requests-table.component';

/**
 * Child route `/app/admin/requests` (033): the table, or the detail of the request named by
 * `?id=` (the deep link of the admin alert mail).
 */
@Component({
  selector: 'app-requests',
  imports: [RequestsTableComponent, RequestDetailComponent],
  template: `
    @if (requestId(); as id) {
      <app-request-detail [id]="id" />
    } @else {
      <app-requests-table />
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 1100px;
      margin: 0 auto;
    }
  `,
})
export class RequestsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.queryParamMap.get('id'),
  });
  protected readonly requestId = computed(() => this.params() || null);
}
