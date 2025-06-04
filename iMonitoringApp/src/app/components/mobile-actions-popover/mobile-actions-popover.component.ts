import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule, PopoverController } from '@ionic/angular';


@Component({
  selector: 'app-mobile-actions-popover',

  template: `
    <ion-list lines="none" class="dark:bg-kwd-darker dark:text-kwd-light">
      <ion-item button detail="false" (click)="dismiss('settings')">
        <ion-icon name="settings-outline" slot="start" aria-hidden="true"></ion-icon>
        <ion-label>Configuración</ion-label>
      </ion-item>
      <ion-item button detail="false" (click)="dismiss('theme')">
        <ion-icon name="contrast-outline" slot="start" aria-hidden="true"></ion-icon>
        <ion-label>Cambiar Tema</ion-label>
      </ion-item>
      <div class="my-1 border-t border-gray-200 dark:border-gray-700"></div>
      <ion-item button detail="false" (click)="dismiss('logout')" lines="none">
        <ion-icon name="log-out-outline" slot="start" color="danger" aria-hidden="true"></ion-icon>
        <ion-label color="danger">Cerrar Sesión</ion-label>
      </ion-item>
    </ion-list>
  `,
  styleUrls: ['./mobile-actions-popover.component.scss'], 
  standalone: true,
  imports: [
    IonicModule, 
    CommonModule

  ]
})
export class MobileActionsPopoverComponent implements OnInit {

  constructor(private popoverCtrl: PopoverController) { }

  ngOnInit() {}
  /**

   * @param action 
   */
  dismiss(action: string) {
    this.popoverCtrl.dismiss({
      action: action 
    });
  }
}