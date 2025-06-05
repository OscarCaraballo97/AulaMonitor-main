import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonicModule, LoadingController, ToastController, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';

import { BuildingService } from '../../../services/building.service';
import { BuildingDTO } from '../../../models/building.model';
import { AuthService } from '../../../services/auth.service';
import { Rol } from '../../../models/rol.model';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, catchError, tap } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-building-form',
  templateUrl: './building-form.page.html',
  styleUrls: ['./building-form.page.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    ReactiveFormsModule,
    RouterModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BuildingFormPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  buildingForm!: FormGroup;
  isEditMode = false;
  buildingId: string | null = null;
  pageTitle = 'Nuevo Edificio';
  isLoading = false;
  isLoadingInitialData = true;
  userRole: Rol | null = null;
  public RolEnum = Rol;

  constructor(
    private fb: FormBuilder,
    private buildingService: BuildingService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    this.isLoadingInitialData = true;
    this.cdr.detectChanges();

    this.buildingForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      location: ['', [Validators.required, Validators.minLength(3)]]
    });

    this.authService.currentUserRole.pipe(
      takeUntil(this.destroy$),
      tap((role: Rol | null) => { 
        this.userRole = role;
        if (this.userRole !== Rol.ADMIN) {
          this.presentToast('Acceso denegado. Solo los administradores pueden gestionar edificios.', 'danger');
          this.navCtrl.navigateBack('/app/dashboard');
          return;
        }
      }),
      catchError(error => {
        this.presentToast('Error al obtener el rol del usuario.', 'danger');
        this.navCtrl.navigateBack('/app/dashboard');
        return of(null);
      }),
      finalize(() => {
        this.isLoadingInitialData = false;
        this.cdr.detectChanges();
      })
    ).subscribe(() => {
      if (this.userRole === Rol.ADMIN) {
        this.buildingId = this.route.snapshot.paramMap.get('id');
        if (this.buildingId) {
          this.isEditMode = true;
          this.pageTitle = 'Editar Edificio';
          this.loadBuildingData(this.buildingId);
        } else {
          this.pageTitle = 'Nuevo Edificio';
        }
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadBuildingData(id: string) {
    this.isLoading = true;
    this.isLoadingInitialData = true;
    const loading = await this.loadingCtrl.create({ message: 'Cargando datos del edificio...' });
    await loading.present();

    this.buildingService.getBuildingById(id).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        this.isLoadingInitialData = false;
        await loading.dismiss();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (building: BuildingDTO) => {
        this.buildingForm.patchValue({
          name: building.name,
          location: building.location
        });
      },
      error: async (err: HttpErrorResponse | Error) => {
        const message = (err instanceof HttpErrorResponse) ? err.error?.message || err.message : err.message;
        await this.presentToast(message || 'Error al cargar el edificio.', 'danger');
        this.navCtrl.navigateBack('/app/buildings');
      }
    });
  }

  async onSubmit() {
    if (!this.buildingForm || this.buildingForm.invalid) {
      if (this.buildingForm) this.markFormGroupTouched(this.buildingForm);
      await this.presentToast('Por favor, completa todos los campos requeridos.', 'warning');
      return;
    }

    this.isLoading = true;
    const loadingSubmit = await this.loadingCtrl.create({ message: this.isEditMode ? 'Actualizando edificio...' : 'Creando edificio...' });
    await loadingSubmit.present();

    const formValue = this.buildingForm.value;
    let buildingData: BuildingDTO;

    if (this.isEditMode && this.buildingId) {
      buildingData = {
        id: this.buildingId,
        name: formValue.name,
        location: formValue.location
      };
    } else {

      buildingData = {
        id: this.buildingId || '',
        name: formValue.name,
        location: formValue.location
      };

      if (!this.isEditMode) {
        buildingData = {
          name: formValue.name,
          location: formValue.location
        } as BuildingDTO;
      }
    }


    let operation: Observable<BuildingDTO>;
    if (this.isEditMode && this.buildingId) {
      operation = this.buildingService.updateBuilding(this.buildingId, buildingData);
    } else {

      operation = this.buildingService.createBuilding(formValue as BuildingDTO);
    }

    operation.pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        await loadingSubmit.dismiss();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: async () => {
        await this.presentToast(`Edificio ${this.isEditMode ? 'actualizado' : 'creado'} correctamente.`, 'success');
        this.navCtrl.navigateBack('/app/buildings');
      },
      error: async (err: HttpErrorResponse | Error) => {
        const message = (err instanceof HttpErrorResponse) ? err.error?.message || err.message : err.message;
        await this.presentToast(message || 'Error al guardar el edificio.', 'danger');
      }
    });
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) this.markFormGroupTouched(control);
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3500,
      color,
      position: 'top',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await toast.present();
  }

  cancel() {
    this.navCtrl.navigateBack('/app/buildings');
  }
}