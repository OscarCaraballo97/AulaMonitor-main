import { Component, EnvironmentInjector, inject } from '@angular/core';
import { IonicModule, IonicRouteStrategy, Platform, NavController } from '@ionic/angular';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  ellipsisVerticalOutline, logOutOutline, moonOutline, sunnyOutline, homeOutline,
  calendarOutline, addCircleOutline, timeOutline, peopleOutline, businessOutline,
  schoolOutline, peopleCircleOutline, listCircleOutline, personOutline, createOutline,
  trashOutline, chevronDownOutline, chevronUpOutline, searchOutline, bookmarkOutline,
  flaskOutline, megaphoneOutline, easelOutline, settingsOutline, contrastOutline,
  mailOutline, lockClosedOutline, keyOutline, personAddOutline,

  documentTextOutline,
  folderOpenOutline,

  closeCircleOutline,
  checkmarkCircleOutline
} from 'ionicons/icons';
import { AuthService } from './services/auth.service';
import { App } from '@capacitor/app';
import { Router, RouterModule } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'], 
  standalone: true,
  imports: [IonicModule, RouterModule],
})
export class AppComponent {
  private platform = inject(Platform);
  private authService = inject(AuthService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private navCtrl = inject(NavController); 

  constructor() {
    addIcons({
      ellipsisVerticalOutline, logOutOutline, moonOutline, sunnyOutline, homeOutline,
      calendarOutline, addCircleOutline, timeOutline, peopleOutline, businessOutline,
      schoolOutline, peopleCircleOutline, listCircleOutline, personOutline, createOutline,
      trashOutline, chevronDownOutline, chevronUpOutline, searchOutline, bookmarkOutline,
      flaskOutline, megaphoneOutline, easelOutline, settingsOutline, contrastOutline,
      mailOutline, lockClosedOutline, keyOutline, personAddOutline,
      documentTextOutline, folderOpenOutline,
      closeCircleOutline, checkmarkCircleOutline
    });
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.themeService.initializeTheme();

      App.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          App.exitApp();
        } else {
          this.navCtrl.back();
        }
      });
    });
  }
}