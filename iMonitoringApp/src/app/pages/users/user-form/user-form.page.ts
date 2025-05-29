import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { IonicModule, LoadingController, ToastController, NavController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { Rol } from '../../../models/rol.model';
import { Subject, Observable } from 'rxjs';
import { takeUntil, finalize, filter } from 'rxjs/operators';

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.page.html',
  styleUrls: ['./user-form.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule, RouterModule]
})
export class UserFormPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  userForm!: FormGroup;
  isEditMode = false;
  userId: string | null = null;
  isLoading = false;
  errorMessage: string = '';
  pageTitle = 'Nuevo Usuario';

  currentUser: User | null = null;
  loggedInUserRole: Rol | null = null;

  public rolesForSelect: { key: string, value: Rol }[] = [];
  public RolEnum = Rol;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    console.log("UserFormPage: ngOnInit - INICIO");
    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: [''], 
      role: [Rol.ESTUDIANTE, Validators.required],
      avatarUrl: ['']
    });
    console.log("UserFormPage: userForm ha sido inicializado:", !!this.userForm);

    this.authService.getCurrentUser().pipe(takeUntil(this.destroy$)).subscribe(user => {
        this.currentUser = user;
        this.loggedInUserRole = user?.role || null;
        this.setupRolesForSelect();
        this.cdr.detectChanges(); 
    });

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.userId = params.get('id');
      if (this.userId) {
        this.isEditMode = true;
        this.pageTitle = 'Editar Usuario';
        this.userForm.get('password')?.clearValidators();
        this.userForm.get('password')?.updateValueAndValidity();
        this.loadUserData(this.userId);
      } else {
        this.isEditMode = false;
        this.pageTitle = 'Nuevo Usuario';
        this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
        this.userForm.get('password')?.updateValueAndValidity();
      }
       this.cdr.detectChanges();
    });
  }

  setupRolesForSelect() {
    if (this.loggedInUserRole === Rol.ADMIN) {
      this.rolesForSelect = Object.keys(Rol)
        .filter(key => isNaN(Number(key))) 
        .map(key => ({ key: key.replace('_', ' '), value: Rol[key as keyof typeof Rol] }));
    } else if (this.loggedInUserRole === Rol.COORDINADOR) {
     
      this.rolesForSelect = Object.keys(Rol)
        .filter(key => isNaN(Number(key)) && [Rol.ESTUDIANTE, Rol.TUTOR, Rol.PROFESOR].includes(Rol[key as keyof typeof Rol]))
        .map(key => ({ key: key.replace('_', ' '), value: Rol[key as keyof typeof Rol] }));
    } else {
      this.rolesForSelect = []; 
    }
    console.log("UserFormPage: rolesForSelect configurados:", this.rolesForSelect);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadUserData(id: string) {
    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: 'Cargando usuario...' });
    await loading.present();

    this.userService.getUserById(id).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        await loading.dismiss();
      })
    ).subscribe({
      next: (user) => {
        this.userForm.patchValue({
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl
        });

        if (this.loggedInUserRole !== Rol.ADMIN && this.userForm.get('role')) {
            this.userForm.get('role')?.disable();
        }
        this.cdr.detectChanges();
      },
      error: async (err) => {
        this.errorMessage = err.message || 'Error al cargar datos del usuario.';
        await this.presentToast(this.errorMessage, 'danger');
        this.navCtrl.navigateBack('/app/users');
      }
    });
  }

  async onSubmit() {
    if (!this.userForm || this.userForm.invalid) {
      if(this.userForm) this.markFormGroupTouched(this.userForm);
      await this.presentToast('Por favor, corrige los errores.', 'warning');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const loading = await this.loadingCtrl.create({ message: this.isEditMode ? 'Actualizando...' : 'Creando...' });
    await loading.present();

    const userData = this.userForm.getRawValue();
    if (!this.isEditMode && !userData.password) {
        this.isLoading = false;
        await loading.dismiss();
        await this.presentToast('La contraseña es requerida para nuevos usuarios.', 'warning');
        this.userForm.get('password')?.markAsTouched();
        return;
    }
    if (this.isEditMode && (userData.password === null || userData.password === '')) {
        delete userData.password;
    }

    let operation: Observable<User>;
    if (this.isEditMode && this.userId) {
      operation = this.userService.updateUser(this.userId, userData);
    } else {
      operation = this.userService.createUser(userData as User); 
    }

    operation.pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        await loading.dismiss();
      })
    ).subscribe({
      next: async () => {
        const message = this.isEditMode ? 'Usuario actualizado exitosamente.' : 'Usuario creado exitosamente.';
        await this.presentToast(message, 'success');
        this.navCtrl.navigateBack('/app/users');
      },
      error: async (err) => {
        this.errorMessage = err.message || (this.isEditMode ? 'Error al actualizar.' : 'Error al crear.');
        await this.presentToast(this.errorMessage, 'danger');
      }
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

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top', icon: iconName });
    await toast.present();
  }

  cancel() {
    this.navCtrl.navigateBack('/app/users');
  }
}
