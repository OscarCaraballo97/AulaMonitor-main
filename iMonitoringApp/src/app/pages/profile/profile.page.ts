import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, LoadingController, ToastController, NavController, AlertController, ActionSheetController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { Subject } from 'rxjs';
import { takeUntil, filter, finalize } from 'rxjs/operators';
import { AuthResponse } from '../../models/auth.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule]
})
export class ProfilePage implements OnInit, OnDestroy {
  profileForm!: FormGroup;
  changePasswordForm!: FormGroup;
  currentUser: User | null = null;
  private destroy$ = new Subject<void>();
  isLoading = false;
  isEditing = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.getCurrentUser().pipe(
      takeUntil(this.destroy$),
      filter(user => user !== null)
    ).subscribe(user => {
      this.currentUser = user;
      this.initProfileForm();
    });
    this.initChangePasswordForm();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initProfileForm() {
    this.profileForm = this.fb.group({
      name: [this.currentUser?.name || '', Validators.required],
      email: [this.currentUser?.email || '', [Validators.required, Validators.email]],
      avatarUrl: [this.currentUser?.avatarUrl || '']
    });
    if (!this.isEditing) {
        this.profileForm.disable();
    }
  }

  initChangePasswordForm() {
    this.changePasswordForm = this.fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmNewPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator('newPassword', 'confirmNewPassword') });
  }

  passwordMatchValidator(controlName: string, matchingControlName: string) {
    return (formGroup: FormGroup) => {
      const control = formGroup.controls[controlName];
      const matchingControl = formGroup.controls[matchingControlName];
      if (matchingControl.errors && !matchingControl.errors['passwordMismatch']) return;
      if (control.value !== matchingControl.value) matchingControl.setErrors({ passwordMismatch: true });
      else matchingControl.setErrors(null);
    };
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.isEditing) this.profileForm.enable();
    else {
      this.profileForm.disable();
      this.initProfileForm();
    }
  }

  async saveProfile() {
    if (!this.currentUser || !this.currentUser.id) {
      await this.presentToast('Error: Usuario no identificado.', 'danger');
      return;
    }
    if (this.profileForm.invalid) {
      await this.presentToast('Por favor, completa los campos requeridos.', 'warning');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: 'Guardando perfil...' });
    await loading.present();

    const updatedData: Partial<User> = {
      name: this.profileForm.value.name,
      email: this.profileForm.value.email,
      avatarUrl: this.profileForm.value.avatarUrl
    };

    this.userService.updateUser(this.currentUser.id, updatedData).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        try { if (loading) await loading.dismiss(); } catch (e) { console.warn('SaveProfile: Loading controller issue', e); }
      })
    ).subscribe({
      next: async (updatedUser) => {
        this.authService.updateCurrentUser(updatedUser);
        this.currentUser = updatedUser;
        this.isEditing = false;
        this.profileForm.disable();
        await this.presentToast('Perfil actualizado exitosamente.', 'success');
      },
      error: async (err: Error) => {
        await this.presentToast(err.message || 'Error al actualizar el perfil.', 'danger');
      }
    });
  }

  async changePassword() {
    if (!this.currentUser || !this.currentUser.id) {
      await this.presentToast('Error: Usuario no identificado.', 'danger');
      return;
    }
    if (this.changePasswordForm.invalid) {
      await this.presentToast('Por favor, completa todos los campos de contraseña.', 'warning');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: 'Cambiando contraseña...' });
    await loading.present();

    const passwordData = {
        oldPassword: this.changePasswordForm.value.oldPassword,
        newPassword: this.changePasswordForm.value.newPassword
    };

    this.userService.updateUserPassword(this.currentUser.id, passwordData)
    .pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        try { if (loading) await loading.dismiss(); } catch (e) { console.warn('ChangePassword: Loading controller issue', e); }
      })
    )
    .subscribe({
        next: async (responseMessage: string) => {
            await this.presentToast(responseMessage || 'Contraseña cambiada exitosamente.', 'success');
            this.changePasswordForm.reset();
        },
        error: async (err: Error) => {
            await this.presentToast(err.message || 'Error al cambiar la contraseña.', 'danger');
        }
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
    const toast = await this.toastCtrl.create({
      message, duration: 3000, color, position: 'top', icon: iconName
    });
    await toast.present();
  }

  handleAvatarError(event: Event) {
    const element = event.target as HTMLImageElement;
    if (element) element.src = 'assets/icon/user-default.png';
  }

  async openAvatarOptions() {
    if (!this.isEditing) return;
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Cambiar Avatar',
      buttons: [
        {
          text: 'Ingresar URL de imagen',
          icon: 'link-outline',
          handler: async () => {
            await this.promptForAvatarUrl();
          }
        },
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async promptForAvatarUrl() {
    const alert = await this.alertCtrl.create({
      header: 'URL del Avatar',
      inputs: [
        {
          name: 'avatarUrl',
          type: 'url',
          placeholder: 'https://ejemplo.com/imagen.png',
          value: this.profileForm.get('avatarUrl')?.value || ''
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar URL',
          handler: (data) => {
            if (data.avatarUrl) {
              this.profileForm.get('avatarUrl')?.setValue(data.avatarUrl);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  goBack() {

    this.navCtrl.back({ animated: true, animationDirection: 'back' });

  }
}