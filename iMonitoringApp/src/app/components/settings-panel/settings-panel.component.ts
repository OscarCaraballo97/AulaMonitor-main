import { Component, Output, EventEmitter } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-settings-panel',
  template: `
    <ion-header class="dark:bg-kwd-darker">
      <ion-toolbar class="dark:bg-kwd-darker dark:text-kwd-light">
        <ion-title class="text-xl font-medium text-gray-500 dark:text-kwd-light">Configuración</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()">
            <ion-icon slot="icon-only" name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding dark:bg-kwd-darker dark:text-kwd-light">
      <div class="p-4 space-y-4 md:p-8">
        <h6 class="text-lg font-medium text-gray-400 dark:text-kwd-light">Modo de Tema</h6>
        <div class="flex items-center space-x-4 sm:space-x-8">
          <button (click)="setLight()"
                  [ngClass]="{'border-kwd-blue-DEFAULT text-kwd-blue-DEFAULT dark:border-kwd-blue-500 dark:text-kwd-blue-100': !themeService.isDarkMode(), 'text-gray-500 dark:text-kwd-blue-500 border-gray-300 dark:border-kwd-blue-700': themeService.isDarkMode()}"
                  class="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 space-x-2 transition-colors border rounded-md hover:text-gray-900 hover:border-gray-900 dark:hover:text-kwd-blue-100 dark:hover:border-kwd-blue-500 focus:outline-none">
            <ion-icon name="sunny-outline" class="w-6 h-6"></ion-icon>
            <span>Claro</span>
          </button>
          <button (click)="setDark()"
                  [ngClass]="{'border-kwd-blue-DEFAULT text-kwd-blue-DEFAULT dark:border-kwd-blue-500 dark:text-kwd-blue-100': themeService.isDarkMode(), 'text-gray-500 dark:text-kwd-blue-500 border-gray-300 dark:border-kwd-blue-700': !themeService.isDarkMode()}"
                  class="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 space-x-2 transition-colors border rounded-md hover:text-gray-900 hover:border-gray-900 dark:hover:text-kwd-blue-100 dark:hover:border-kwd-blue-500 focus:outline-none">
            <ion-icon name="moon-outline" class="w-6 h-6"></ion-icon>
            <span>Oscuro</span>
          </button>
        </div>
      </div>
      </ion-content>
  `,
  standalone: true,
  imports: [IonicModule, CommonModule],
})
export class SettingsPanelComponent {
  @Output() closePanelRequest = new EventEmitter<void>();

  constructor(public themeService: ThemeService) {}

  setLight() { this.themeService.setTheme('light'); }
  setDark() { this.themeService.setTheme('dark'); }
  close() { this.closePanelRequest.emit(); }
}