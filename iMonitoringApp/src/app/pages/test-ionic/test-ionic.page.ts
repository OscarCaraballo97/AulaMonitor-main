
import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common'; 

@Component({
  selector: 'app-test-ionic',
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Página de Prueba Ionic</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <h1>¡Hola Ionic!</h1>
      <p>Si ves esta página y los componentes Ionic de arriba y abajo, ¡es una buena señal!</p>
      <ion-item>
        <ion-label position="stacked">Campo de Prueba</ion-label>
        <ion-input placeholder="Escribe algo"></ion-input>
      </ion-item>
      <ion-button expand="block" color="secondary" class="ion-margin-top">
        Botón de Prueba
      </ion-button>
    </ion-content>

    <ion-footer>
        <ion-toolbar>
            <ion-title size="small">Pie de página de prueba</ion-title>
        </ion-toolbar>
    </ion-footer>
  `,
  standalone: true,
  imports: [
    IonicModule, 
    CommonModule
  ],
})
export class TestIonicPage {
  constructor() {
    console.log('TestIonicPage cargada y constructor ejecutado.');
  }
}