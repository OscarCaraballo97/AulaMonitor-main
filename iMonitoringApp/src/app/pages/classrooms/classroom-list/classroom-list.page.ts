import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule, AlertController, LoadingController, ToastController, NavController, IonRefresher } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ClassroomService, ClassroomRequestData } from '../../../services/classroom.service';
import { Classroom } from '../../../models/classroom.model';
import { AuthService } from '../../../services/auth.service';
import { Rol } from '../../../models/rol.model';
import { Subject, Observable } from 'rxjs'; 
import { takeUntil, finalize, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-classroom-list',
  templateUrl: './classroom-list.page.html',
  styleUrls: ['./classroom-list.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule]
})
export class ClassroomListPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  classrooms: Classroom[] = [];
  isLoading = false;
  userRole: Rol | null = null;
  public RolEnum = Rol;
  errorMessage: string = ''; 

  constructor(
    private classroomService: ClassroomService,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.authService.getCurrentUserRole()
      .pipe(takeUntil(this.destroy$))
      .subscribe(role => {
        this.userRole = role;
        this.cdr.detectChanges();
      });
  }

  ionViewWillEnter() {
    this.loadClassrooms();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadClassrooms(event?: CustomEvent) {
    this.isLoading = true;
    this.errorMessage = ''; 
    let loadingOverlay: HTMLIonLoadingElement | undefined;
    if (!event) {
      loadingOverlay = await this.loadingCtrl.create({ message: 'Cargando aulas...' });
      await loadingOverlay.present();
    }

    this.classroomService.getAllClassrooms()
      .pipe(
        takeUntil(this.destroy$),
        finalize(async () => {
          this.isLoading = false;
          if (loadingOverlay) await loadingOverlay.dismiss();
          if (event && event.target) (event.target as unknown as IonRefresher).complete();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (data: Classroom[]) => {
          this.classrooms = data;
        },
        error: async (err: Error) => {
          this.errorMessage = err.message || 'Error cargando aulas.';
          await this.presentToast(this.errorMessage, 'danger');
        }
      });
  }

  canManageClassrooms(): boolean {
    return this.userRole === Rol.ADMIN;
  }

  navigateToAddClassroom() {
    this.navCtrl.navigateForward('/app/classrooms/new');
  }

  navigateToEditClassroom(classroomId: string | undefined) {
    if (!classroomId) return;
    this.navCtrl.navigateForward(`/app/classrooms/edit/${classroomId}`);
  }
  
  navigateToViewAvailability(classroomId: string | undefined) {
    if(!classroomId) return;
    this.navCtrl.navigateForward(`/app/classrooms/availability/${classroomId}`);
  }


  getBuildingNamePlaceholder(buildingId: string | undefined): string {
    if (!buildingId) return 'N/A';
    return `Edificio ID: ${buildingId}`;
  }

  async confirmDelete(classroom: Classroom) { 
    if (!classroom || !classroom.id) return;
    const classroomId = classroom.id;
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de que quieres eliminar el aula "${classroom.name || classroomId}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          cssClass: 'text-kwd-red',
          handler: () => this.deleteClassroom(classroomId)
        }
      ]
    });
    await alert.present();
  }

  private async deleteClassroom(id: string) {
    const loading = await this.loadingCtrl.create({ message: 'Eliminando aula...' });
    await loading.present();
    this.classroomService.deleteClassroom(id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(async () => await loading.dismiss())
      )
      .subscribe({
        next: async () => {
          await this.presentToast('Aula eliminada correctamente.', 'success');
          this.loadClassrooms(); 
        },
        error: async (err: Error) => {
          await this.presentToast(err.message || 'Error al eliminar el aula.', 'danger');
        }
      });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    await toast.present();
  }

  handleRefresh(event: CustomEvent) {
    this.loadClassrooms(event);
  }
}
