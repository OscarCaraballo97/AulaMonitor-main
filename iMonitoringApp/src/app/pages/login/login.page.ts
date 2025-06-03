import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { 
  AlertController, 
  LoadingController, 
  NavController 
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { LoginCredentials, AuthResponse } from '../../models/auth.model'; 
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule, RouterModule],
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string = '';
  toastCtrl: any;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      
      password: ['', [Validators.required]], 
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      Object.values(this.loginForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsTouched();
        }
      });
      this.presentToast('Por favor, completa todos los campos correctamente.', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Ingresando...' });
    await loading.present();
    this.errorMessage = '';

    const credentials: LoginCredentials = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password 
    };

    this.authService.login(credentials).subscribe({
      next: (response: AuthResponse) => {
        loading.dismiss();
        if (response && response.token) {
          this.navCtrl.navigateRoot('/app/dashboard', { animated: true, animationDirection: 'forward' });
        } else {
          this.errorMessage = 'Respuesta de login inválida.';
          this.presentErrorAlert('Error de Login', this.errorMessage);
        }
      },
      error: async (err: Error) => {
        loading.dismiss();
        this.errorMessage = err.message;
        this.presentErrorAlert('Error de Login', this.errorMessage);
      },
    });
  }

  goToRegister() { this.router.navigate(['/register']); }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top', icon: iconName });
    await toast.present();
  }

  async presentErrorAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
        header: header,
        message: message,
        buttons: ['OK'],
    });
    await alert.present();
  }
}