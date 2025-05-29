
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule, AlertController, LoadingController, ToastController, NavController, IonRefresher } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { BuildingService } from '../../../services/building.service';
import { Building } from '../../../models/building.model';
import { AuthService } from '../../../services/auth.service';
import { Rol } from '../../../models/rol.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-building-list',
  templateUrl: './building-list.page.html',
  styleUrls: ['./building-list.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
})
export class BuildingListPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  buildings: Building[] = [];
  isLoading = false;
  userRole: Rol | null = null;
  errorMessage: string = '';

  constructor(
    private buildingService: BuildingService,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
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

  async loadBuildings(event?: CustomEvent) {
    this.isLoading = true;
    this.errorMessage = '';
    let loadingOverlay: HTMLIonLoadingElement | undefined;

    if (!event) {
      loadingOverlay = await this.loadingCtrl.create({ message: 'Cargando edificios...' });
      await loadingOverlay.present();
    }

    this.buildingService.getAllBuildings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: Building[]) => {
          this.buildings = data;
        },
        error: async (err: Error) => {
          this.errorMessage = err.message || 'Error al cargar edificios.';
          await this.presentToast(this.errorMessage, 'danger', 'warning-outline');
        },
        complete: async () => {
          this.isLoading = false;
          if (loadingOverlay) await loadingOverlay.dismiss();
          if (event && event.target) (event.target as unknown as IonRefresher).complete();
          this.cdr.detectChanges();
        }
      });
  }

  canManageBuildings(): boolean {
    return this.userRole === Rol.ADMIN || this.userRole === Rol.PROFESOR;
  }

  navigateToAddBuilding() {
    this.navCtrl.navigateForward('/app/buildings/new');
  }

  navigateToEditBuilding(buildingId?: string) {
    if (!buildingId) return;
    this.navCtrl.navigateForward(`/app/buildings/edit/${buildingId}`);
  }

  async confirmDelete(building: Building) {
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
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: async () => {
        await this.presentToast('Edificio eliminado exitosamente.', 'success', 'checkmark-circle-outline');
        this.loadBuildings(); 
      },
      error: async (err: Error) => {
        await this.presentToast(err.message || 'Error al eliminar edificio.', 'danger', 'warning-outline');
      },
      complete: async () => {
        await loading.dismiss();
      }
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3500,
      color: color,
      position: 'top',
      icon: iconName,
      cssClass: `kwd-toast kwd-toast-${color}`
    });
    await toast.present();
  }

  handleRefresh(event: CustomEvent) {
    this.loadBuildings(event);
  }
}