import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController, NavController } from '@ionic/angular';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule] 
})
export class VerifyEmailPage implements OnInit {
  verificationStatus: 'verifying' | 'success' | 'error' = 'verifying';
  message: string = 'Verificando tu correo electrónico...';

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private loadingController: LoadingController,
    private navCtrl: NavController
  ) { }

  async ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      const loading = await this.loadingController.create({ message: 'Verificando...' });
      await loading.present();
      this.authService.verifyEmail(token).subscribe({
        next: async (responseMessage) => {
          await loading.dismiss();
          this.verificationStatus = 'success';
          this.message = responseMessage;
        },
        error: async (error: Error) => {
          await loading.dismiss();
          this.verificationStatus = 'error';
          this.message = error.message || 'Error al verificar el correo. El token podría ser inválido o haber expirado.';
          console.error('Email verification error:', error);
        }
      });
    } else {
      this.verificationStatus = 'error';
      this.message = 'Token de verificación no encontrado en la URL.';
    }
  }

  navigateToLogin() {
    this.navCtrl.navigateRoot('/login');
  }
}