import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonicModule, LoadingController, ToastController, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ClassroomService, ClassroomRequestData } from '../../../services/classroom.service';
import { BuildingService } from '../../../services/building.service';
import { Classroom } from '../../../models/classroom.model';
import { ClassroomType } from '../../../models/classroom-type.enum';
import { Building } from '../../../models/building.model';
import { AuthService } from '../../../services/auth.service';
import { Rol } from '../../../models/rol.model';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, catchError, tap, take } from 'rxjs/operators';
import { User } from '../../../models/user.model';
import { UserService } from '../../../services/user.service'; 


@Component({
  selector: 'app-classroom-form',
  templateUrl: './classroom-form.page.html',
  styleUrls: ['./classroom-form.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule, RouterModule]
})
export class ClassroomFormPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  classroomForm!: FormGroup;
  isEditMode = false;
  classroomId: string | null = null;
  pageTitle = 'Nueva Aula';
  isLoading = false;
  isLoadingInitialData = true;
  buildings: Building[] = [];
  userRole: Rol | null = null;
  studentUsers: User[] = [];

  public RolEnum = Rol;
  public ClassroomTypeEnum = ClassroomType;

  constructor(
    private fb: FormBuilder,
    private classroomService: ClassroomService,
    private buildingService: BuildingService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private userService: UserService 
  ) {}

  ngOnInit() {
    console.log("ClassroomFormPage: ngOnInit - INICIO. isLoadingInitialData:", this.isLoadingInitialData);
    this.isLoadingInitialData = true; 
    this.cdr.detectChanges();


    this.classroomForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      capacity: [null, [Validators.required, Validators.min(1)]],
      type: [ClassroomType.AULA, Validators.required],
      resources: [''],
      buildingId: [null, Validators.required]
    });
    console.log("ClassroomFormPage: classroomForm ha sido inicializado:", !!this.classroomForm);

    this.loadInitialData();
  }

  loadInitialData() {
    this.isLoadingInitialData = true;
    this.cdr.detectChanges();

    const observables: { [key: string]: Observable<any> } = {
      user: this.authService.getCurrentUser().pipe(take(1)),
      role: this.authService.getCurrentUserRole().pipe(take(1)),
      buildingsData: this.buildingService.getAllBuildings().pipe(
        tap(bldgs => console.log("ClassroomFormPage: Edificios recibidos en forkJoin:", bldgs)),
        catchError(err => {
          console.error("ClassroomFormPage: Error crítico cargando edificios:", err);
          this.presentToast('Error crítico: No se pudieron cargar los edificios.', 'danger');
          return of([] as Building[]);
        })
      )
    };

    this.authService.getCurrentUserRole().pipe(take(1)).subscribe(roleValue => {
      this.userRole = roleValue; 
      console.log("ClassroomFormPage: Rol obtenido en la suscripción externa:", this.userRole);

      if (this.userRole === Rol.COORDINADOR) {
        observables['studentUsersData'] = this.userService.getUsersByRole(Rol.ESTUDIANTE).pipe(
          catchError(err => {
            this.presentToast('Error al cargar la lista de estudiantes.', 'danger');
            return of([] as User[]);
          })
        );
      }

      forkJoin(observables).pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          console.log("ClassroomFormPage: forkJoin FINALIZE. Estado ANTERIOR de isLoadingInitialData:", this.isLoadingInitialData);
          this.isLoadingInitialData = false;
          console.log("ClassroomFormPage: forkJoin FINALIZE. Estado NUEVO de isLoadingInitialData:", this.isLoadingInitialData);
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: (results: any) => {
          console.log("ClassroomFormPage: forkJoin next - Resultados:", results);
          this.buildings = results.buildingsData || [];
          if (results.studentUsersData) { 
            this.studentUsers = results.studentUsersData;
          }

          if (this.userRole !== Rol.ADMIN) {
            console.log("ClassroomFormPage: Acceso denegado (dentro de forkJoin), el rol no es ADMIN.");
            this.presentToast('Acceso denegado. Solo los administradores pueden gestionar aulas.', 'danger');
         
            this.navCtrl.navigateBack('/app/dashboard');
            return; 
          }

          this.classroomId = this.route.snapshot.paramMap.get('id');
          if (this.classroomId) {
            this.isEditMode = true;
            this.pageTitle = 'Editar Aula';
            console.log('ClassroomFormPage: Modo Edición, ID de Aula:', this.classroomId);
            this.loadClassroomData(this.classroomId);
          } else {
            this.pageTitle = 'Nueva Aula';
            console.log('ClassroomFormPage: Modo Creación (dentro de forkJoin).');
          }
        },
        error: (err: Error) => {
          this.presentToast(`Error al cargar datos del formulario: ${err.message}`, 'danger');
          console.error("ClassroomFormPage: Error en el forkJoin principal:", err);
          this.navCtrl.navigateBack('/app/classrooms');
        }
      });
    });
  }


  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadClassroomData(id: string) {
    this.isLoading = true; 
    const loading = await this.loadingCtrl.create({ message: 'Cargando datos del aula...' });
    await loading.present();

    this.classroomService.getClassroomById(id).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false; 
        await loading.dismiss();
        this.cdr.detectChanges();
        console.log("ClassroomFormPage: loadClassroomData finalizado.");
      })
    ).subscribe({
      next: (classroom: Classroom) => {
        console.log("ClassroomFormPage: Datos del aula cargados para edición:", classroom);
        this.classroomForm.patchValue({
          name: classroom.name,
          capacity: classroom.capacity,
          type: classroom.type,
          resources: classroom.resources,
          buildingId: classroom.building?.id || classroom.buildingId
        });
      },
      error: async (err: Error) => {
        await this.presentToast(err.message || 'Error al cargar el aula.', 'danger');
        this.navCtrl.navigateBack('/app/classrooms');
      }
    });
  }

  async onSubmit() {
    if (!this.classroomForm || this.classroomForm.invalid) {
      if(this.classroomForm) this.markFormGroupTouched(this.classroomForm);
      await this.presentToast('Por favor, completa todos los campos requeridos.', 'warning');
      return;
    }

    this.isLoading = true;
    const loadingSubmit = await this.loadingCtrl.create({ message: this.isEditMode ? 'Actualizando aula...' : 'Creando aula...' });
    await loadingSubmit.present();

    const formValue = this.classroomForm.value;
    const classroomData: ClassroomRequestData = {
      name: formValue.name,
      capacity: formValue.capacity,
      type: formValue.type,
      resources: formValue.resources,
      buildingId: formValue.buildingId
    };

    let operation: Observable<Classroom | void>;
    if (this.isEditMode && this.classroomId) {
      operation = this.classroomService.updateClassroom(this.classroomId, classroomData);
    } else {
      operation = this.classroomService.createClassroom(classroomData);
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
        await this.presentToast(`Aula ${this.isEditMode ? 'actualizada' : 'creada'} correctamente.`, 'success');
        this.navCtrl.navigateBack('/app/classrooms');
      },
      error: async (err: Error) => {
        await this.presentToast(err.message || 'Error al guardar el aula.', 'danger');
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
      buttons: [{ text: 'OK', role: 'cancel'}]
    });
    await toast.present();
  }

  cancel() {
    this.navCtrl.navigateBack('/app/classrooms');
  }
}