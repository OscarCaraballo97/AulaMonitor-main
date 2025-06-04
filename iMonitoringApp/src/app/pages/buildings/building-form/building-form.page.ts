import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {LoadingController, ToastController, NavController } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { BuildingService } from '../../../services/building.service';
import { BuildingDTO, BuildingRequestDTO } from '../../../models/building.model';
import { AuthService } from '../../../services/auth.service';
import { Rol } from '../../../models/rol.model';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, finalize, catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-building-form',
  templateUrl: './building-form.page.html',
  styleUrls: ['./building-form.page.scss'],
  standalone: true,
  imports: [
    IonicModule, // IonicModule se importa de '@ionic/angular' si no usas componentes standalone específicos
    CommonModule, 
    ReactiveFormsModule, 
    RouterModule
  ],
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

  constructor(
    private fb: FormBuilder,
    private buildingService: BuildingService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.isLoadingInitialData = true;
    this.cdr.detectChanges();

    this.buildingForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      location: [''], 
    });

    this.authService.getCurrentUserRole()
      .pipe(takeUntil(this.destroy$))
      .subscribe((role: Rol | null) => {
        this.userRole = role;
        if (!this.canManageBuildings()) {
          this.presentToast('Acceso denegado. No tienes permiso para gestionar edificios.', 'danger');
          this.navCtrl.navigateBack('/app/dashboard', { animationDirection: 'back' });
          this.isLoadingInitialData = false; 
          this.cdr.detectChanges();
          return;
        }

        this.buildingId = this.route.snapshot.paramMap.get('id');
        if (this.buildingId) {
          this.isEditMode = true;
          this.pageTitle = 'Editar Edificio';
          this.loadBuildingData(this.buildingId);
        } else {
          this.pageTitle = 'Nuevo Edificio';
          this.isLoadingInitialData = false;
        }
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  canManageBuildings(): boolean {
    if (!this.userRole) return false;
    return this.userRole === Rol.ADMIN;
  }

  async loadBuildingData(id: string) {
    this.isLoading = true;
    this.cdr.detectChanges();
    const loading = await this.loadingCtrl.create({ message: 'Cargando datos del edificio...' });
    await loading.present();

    this.buildingService.getBuildingById(id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(async () => {
          this.isLoading = false;
          this.isLoadingInitialData = false;
          try { await loading.dismiss(); } catch(e) { console.warn("Error al descartar loading en loadBuildingData", e); }
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (building: BuildingDTO) => { 
          this.buildingForm.patchValue({
            name: building.name,
            location: building.location || '' 
          });
        },
        error: async (err: HttpErrorResponse | Error) => {
          const message = (err instanceof HttpErrorResponse) ? err.error?.message || err.message : err.message;
          await this.presentToast(message || 'Error al cargar datos del edificio.', 'danger');
          this.navCtrl.navigateBack('/app/buildings');
        }
      });
  }
  
  async onSubmit() {
    if (!this.buildingForm || this.buildingForm.invalid) {
      if(this.buildingForm) this.markFormGroupTouched(this.buildingForm);
      await this.presentToast('Por favor, completa todos los campos requeridos.', 'warning');
      return;
    }
    if (!this.canManageBuildings()) {
      await this.presentToast('Acción no permitida.', 'danger');
      return;
    }

    this.isLoading = true; 
    this.cdr.detectChanges();
    const loadingSubmit = await this.loadingCtrl.create({ message: this.isEditMode ? 'Actualizando edificio...' : 'Creando edificio...' });
    await loadingSubmit.present();

    const buildingData: BuildingRequestDTO = {
        name: this.buildingForm.value.name,
        location: this.buildingForm.value.location || undefined 
    };
    let operation: Observable<BuildingDTO>; // CORREGIDO

    if (this.isEditMode && this.buildingId) {
      operation = this.buildingService.updateBuilding(this.buildingId, buildingData);
    } else {
      operation = this.buildingService.createBuilding(buildingData);
    }

    operation.pipe(
      takeUntil(this.destroy$),
      finalize(async () => { 
        this.isLoading = false;
        try { await loadingSubmit.dismiss(); } catch(e) { console.warn("Error al descartar loading en onSubmit finalize:", e); }
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: async (response: BuildingDTO) => { 
        const successMsg = `Edificio ${this.isEditMode ? 'actualizado' : 'creado'} correctamente.`;
        await this.presentToast(successMsg, 'success');
        this.navCtrl.navigateBack('/app/buildings', { animated: true });
      },
      error: async (err: HttpErrorResponse | Error) => {
        const message = (err instanceof HttpErrorResponse) ? err.error?.message || err.message : err.message;
        await this.presentToast(message || 'Error al guardar el edificio.', 'danger');
      },
    });
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', duration: number = 3000) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: duration,
      color: color,
      position: 'top',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await toast.present();
  }

  cancel() {
    this.navCtrl.navigateBack('/app/buildings', { animated: true });
  }
}