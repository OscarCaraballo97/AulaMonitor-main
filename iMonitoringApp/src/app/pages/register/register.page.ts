import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LoadingController, ToastController, NavController } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Rol } from '../../models/rol.model';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule, RouterModule]
})
export class RegisterPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  registerForm!: FormGroup;
  isLoading = false;
  RolEnum = Rol; 
  errorMessage: string | null = null; 

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      role: [Rol.ESTUDIANTE, Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  passwordMatchValidator(formGroup: FormGroup) {
    const password = formGroup.get('password')?.value;
    const confirmPassword = formGroup.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  async onSubmit() {
    this.errorMessage = null;
    if (this.registerForm.invalid) {
      this.markFormGroupTouched(this.registerForm);
      this.errorMessage = 'Por favor, completa todos los campos requeridos y asegúrate de que las contraseñas coincidan.';
      await this.presentToast(this.errorMessage, 'warning');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: 'Registrando...' });
    await loading.present();

    const formValue = this.registerForm.value;
    const registerData = {
      name: formValue.name,
      email: formValue.email,
      password: formValue.password,
      role: formValue.role
    };

    this.authService.register(registerData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(async () => {
          this.isLoading = false;
          await loading.dismiss();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: async (response) => {
          const successMessage = '¡Registro exitoso! Por favor, revisa tu correo electrónico para verificar tu cuenta.';
          await this.presentToast(successMessage, 'success');
          this.router.navigate(['/login']);
        },
        error: async (err: HttpErrorResponse | Error) => {
          this.errorMessage = (err instanceof HttpErrorResponse) ? err.error?.message || err.message : err.message;
          await this.presentToast(this.errorMessage || 'Error en el registro. Inténtalo de nuevo.', 'danger');
        }
      });
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await toast.present();
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}