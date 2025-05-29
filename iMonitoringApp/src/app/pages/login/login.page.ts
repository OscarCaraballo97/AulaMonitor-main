
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, AlertController, LoadingController, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AuthRequest } from '../../models/auth.model';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule, RouterModule],
})
export class LoginPage {
  loginForm: FormGroup;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      Object.values(this.loginForm.controls).forEach(control => control.markAsTouched());
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Ingresando...' });
    await loading.present();
    this.authService.login(this.loginForm.value as AuthRequest).subscribe({
      next: () => {
        loading.dismiss();
        this.navCtrl.navigateRoot('/app/dashboard', { animated: true, animationDirection: 'forward' });
      },
      error: async (err: Error) => {
        loading.dismiss();
        this.errorMessage = err.message;
        const alert = await this.alertCtrl.create({
          header: 'Error de Login',
          message: this.errorMessage,
          buttons: ['OK'],
        });
        await alert.present();
      },
    });
  }
  goToRegister() { this.router.navigate(['/register']); }
}