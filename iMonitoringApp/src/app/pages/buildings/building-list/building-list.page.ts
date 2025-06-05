import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController, NavController, IonRefresher } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { BuildingService } from '../../../services/building.service';
import { BuildingDTO } from '../../../models/building.model';
import { AuthService } from '../../../services/auth.service';
import { Rol } from '../../../models/rol.model';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-building-list',
  templateUrl: './building-list.page.html',
  styleUrls: ['./building-list.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
})
export class BuildingListPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  buildings: BuildingDTO[] = [];
  isLoading = false;
  userRole: Rol | null = null;
  public RolEnum = Rol;
  errorMessage: string | null = null;

  constructor(
    private buildingService: BuildingService,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.getCurrentUserRole()
      .pipe(takeUntil(this.destroy$))
      .subscribe((role: Rol | null) => {
        this.userRole = role;
        this.cdr.detectChanges();
      });
  }

  ionViewWillEnter() {
    this.loadBuildings();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadBuildings(event?: any) {
    this.isLoading = true;
    this.errorMessage = null;
    let loadingOverlay: HTMLIonLoadingElement | undefined;

    if (!event) {
      loadingOverlay = await this.loadingCtrl.create({ message: 'Cargando edificios...' });
      await loadingOverlay.present();
    }

    this.buildingService.getAllBuildings()
      .pipe(
        takeUntil(this.destroy$),
        finalize(async () => {
          this.isLoading = false;
          if (loadingOverlay) {
            try { await loadingOverlay.dismiss(); } catch(e) { console.warn("Error dismissing loading", e); }
          }
          if (event && event.target && typeof event.target.complete === 'function') {
            (event.target as IonRefresher).complete();
          }
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (data: BuildingDTO[]) => {
          this.buildings = data;
        },
        error: async (err: HttpErrorResponse | Error) => {
          const message = (err instanceof HttpErrorResponse) ? err.error?.message || err.message : err.message;
          
          this.errorMessage = message || 'Error al cargar edificios.';
          await this.presentToast(this.errorMessage!, 'danger');
        }
      });
  }

  canManageBuildings(): boolean {
    return this.userRole === Rol.ADMIN;
  }

  navigateToAddBuilding() {
    this.router.navigate(['/app/buildings/new']);
  }

  navigateToEditBuilding(buildingId?: string) {
    if (!buildingId) return;
    this.router.navigate(['/app/buildings/edit', buildingId]);
  }

  async confirmDelete(building: BuildingDTO) {
    if (!building.id || !this.canManageBuildings()) return;

    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de eliminar el edificio "${building.name}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'text-gray-700 dark:text-gray-300' },
        {
          text: 'Eliminar',
          cssClass: 'text-kwd-red',
          handler: () => this.deleteBuilding(building.id!),
        },
      ],
      cssClass: 'kwd-alert dark:kwd-alert-dark',
    });
    await alert.present();
  }

  private async deleteBuilding(id: string) {
    const loading = await this.loadingCtrl.create({ message: 'Eliminando...' });
    await loading.present();

    this.buildingService.deleteBuilding(id)
    .pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
         try { await loading.dismiss(); } catch(e) { console.warn("Error dismissing loading", e); }
      })
    )
    .subscribe({
      next: async () => {
        await this.presentToast('Edificio eliminado exitosamente.', 'success');
        this.loadBuildings();
      },
      error: async (err: HttpErrorResponse | Error) => {
        const message = (err instanceof HttpErrorResponse) ? err.error?.message || err.message : err.message;
        await this.presentToast(message || 'Error al eliminar edificio.', 'danger');
      }
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', duration: number = 3000) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: duration,
      color: color,
      position: 'top',
      buttons: [{text:'OK',role:'cancel'}]
    });
    await toast.present();
  }

  handleRefresh(event: any) {
    this.loadBuildings(event);
  }
}