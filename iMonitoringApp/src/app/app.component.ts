
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule, Platform } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonicModule, RouterModule, CommonModule],
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private themeService: ThemeService
  ) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.themeService.initializeTheme();
    });
  }
}