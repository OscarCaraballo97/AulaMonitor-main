import { enableProdMode, importProvidersFrom, LOCALE_ID } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules, withComponentInputBinding } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';
import { provideHttpClient, withInterceptors } from '@angular/common/http'; 

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { environment } from './environments/environment';
import { jwtInterceptorFn } from './app/interceptor/jwt.interceptor';

import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es'; 
import localeEsCo from '@angular/common/locales/es-CO'; 

registerLocaleData(localeEs, 'es');
registerLocaleData(localeEsCo, 'es-CO');

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    importProvidersFrom(IonicModule.forRoot({})),
    importProvidersFrom(IonicStorageModule.forRoot()),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    provideHttpClient(withInterceptors([jwtInterceptorFn])),
    { provide: LOCALE_ID, useValue: 'es-CO' }
  ],
});