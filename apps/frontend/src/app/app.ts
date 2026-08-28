import { Component } from '@angular/core';
import { AppShellComponent } from './core/layout/app-shell/app-shell.component';

@Component({
  imports: [AppShellComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'frontend';
}
