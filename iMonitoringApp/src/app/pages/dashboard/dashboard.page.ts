import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { IonicModule, ToastController, AlertController, LoadingController, NavController } from '@ionic/angular';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Rol } from '../../models/rol.model';
import { User } from '../../models/user.model';
import { BuildingService } from '../../services/building.service';
import { ReservationService } from '../../services/reservation.service';
import { ClassroomService, ClassroomAvailabilitySummaryDTO } from '../../services/classroom.service';
import { Reservation, ReservationStatus } from '../../models/reservation.model';
import { Subject, forkJoin, of, combineLatest } from 'rxjs';
import { takeUntil, map, catchError, filter, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
  providers: [DatePipe]
})
export class DashboardPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  userRole: Rol | null = null;
  currentUser: User | null = null;
  isLoadingRole = true;
  isLoadingData = false;

  totalBuildings: number | string = '-';
  classroomAvailability: ClassroomAvailabilitySummaryDTO | null = null;
  reservationsToApprove: Reservation[] = [];
  isLoadingReservationsToApprove = false;

  myUpcomingReservations: Reservation[] = [];
  isLoadingMyReservations = false;
  showMyReservationsSection = false;

  public RolEnum = Rol;
  public ReservationStatusEnum = ReservationStatus;

  constructor(
    private authService: AuthService,
    private buildingService: BuildingService,
    private reservationService: ReservationService,
    private classroomService: ClassroomService,
    private cdr: ChangeDetectorRef,
    public datePipe: DatePipe,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController
  ) {
    console.log('>>> DashboardPage: Constructor ejecutado');
  }

  ngOnInit() {
    console.log('>>> DashboardPage: ngOnInit INICIADO');
    this.isLoadingRole = true;
    this.cdr.detectChanges();

    combineLatest([
      this.authService.getCurrentUserRole(),
      this.authService.getCurrentUser()
    ]).pipe(
      takeUntil(this.destroy$),
      filter(([role, user]) => role !== null) 
    ).subscribe(([role, user]: [Rol | null, User | null]) => {
      console.log('>>> DashboardPage: Rol y Usuario recibidos ->', { role: JSON.stringify(role), user: user ? JSON.stringify(user) : 'null' });
      this.userRole = role;
      this.currentUser = user; 
      this.isLoadingRole = false;
      this.loadDashboardDataBasedOnRole();
      this.cdr.detectChanges();
    });
    console.log('>>> DashboardPage: ngOnInit COMPLETADO (suscripciones configuradas)');
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboardDataBasedOnRole() {
    if (!this.userRole) {
      this.resetData();
      return;
    }
    this.isLoadingData = true;

    if (this.userRole === Rol.ADMIN) {
      this.fetchAdminDashboardData();
    } else if (this.userRole === Rol.PROFESOR) {
      this.fetchProfesorGeneralDashboardData();
    } else if (this.userRole === Rol.TUTOR) {
      this.fetchTutorGeneralDashboardData();
    } else if (this.userRole === Rol.ESTUDIANTE) {
      this.isLoadingData = false; 
      this.cdr.detectChanges();
    } else {
      this.isLoadingData = false;
      this.cdr.detectChanges();
    }
  }

  resetData() {
    this.totalBuildings = '-';
    this.classroomAvailability = null;
    this.reservationsToApprove = [];
    this.isLoadingReservationsToApprove = false;
    this.myUpcomingReservations = [];
    this.isLoadingMyReservations = false;
    this.showMyReservationsSection = false;
    this.isLoadingData = false;
    this.isLoadingRole = true; 
    this.userRole = null;
    this.currentUser = null;
    this.cdr.detectChanges();
  }

  fetchAdminDashboardData() {
    console.log(">>> DashboardPage: fetchAdminDashboardData() llamado para ADMIN.");
    this.isLoadingData = true;
    this.isLoadingReservationsToApprove = true;

    type AdminDashboardResults = {
        buildings: number | 'Error';
        availability: ClassroomAvailabilitySummaryDTO | null;
        pending: Reservation[];
    };

    forkJoin({
      buildings: this.buildingService.getAllBuildings().pipe(map(b => b.length), catchError(() => { this.totalBuildings = 'Error'; return of('Error' as const); })),
      availability: this.classroomService.getAvailabilitySummary().pipe(catchError(() => { this.classroomAvailability = null; return of(null); })),
      pending: this.reservationService.getAllReservations({ status: ReservationStatus.PENDIENTE }).pipe(catchError(() => {this.reservationsToApprove = []; return of([] as Reservation[]); }))
    }).pipe(
        takeUntil(this.destroy$),
        finalize(() => {
            this.isLoadingData = false;
            this.isLoadingReservationsToApprove = false;
            this.cdr.detectChanges();
        })
    ).subscribe((results: AdminDashboardResults) => {
        if (results.buildings !== 'Error') this.totalBuildings = results.buildings;
        this.classroomAvailability = results.availability;
        this.reservationsToApprove = results.pending;
        console.log(">>> DashboardPage: Datos de ADMIN cargados.", results);
      });
  }

  fetchProfesorGeneralDashboardData() {
    console.log(">>> DashboardPage: fetchProfesorGeneralDashboardData() llamado para PROFESOR.");
    this.isLoadingData = true;
    this.classroomService.getAvailabilitySummary().pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoadingData = false;
        this.cdr.detectChanges();
      }),
      catchError(() => {
        this.classroomAvailability = null;
        this.presentToast("Error al cargar disponibilidad de aulas.", "danger");
        return of(null);
      })
    ).subscribe((availability: ClassroomAvailabilitySummaryDTO | null) => {
      this.classroomAvailability = availability;
      console.log(">>> DashboardPage: Datos generales de PROFESOR cargados.", { availability });
    });
  }
  
  fetchTutorGeneralDashboardData() {
    this.fetchProfesorGeneralDashboardData();
  }

  async toggleMyReservationsSection() {
    this.showMyReservationsSection = !this.showMyReservationsSection;
    if (this.showMyReservationsSection && this.myUpcomingReservations.length === 0) {
      this.loadMyUpcomingReservations();
    }
    this.cdr.detectChanges();
  }

  async loadMyUpcomingReservations() {
    if (!this.currentUser?.id) {
      this.showMyReservationsSection = false; 
      this.isLoadingMyReservations = false;
      this.cdr.detectChanges();
      return;
    }
    this.isLoadingMyReservations = true;
    this.cdr.detectChanges();

    this.reservationService.getMyUpcomingReservations(3).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoadingMyReservations = false;
        this.cdr.detectChanges();
      }),
      catchError((err: Error) => {
        this.myUpcomingReservations = [];
        this.presentToast("Error al cargar tus próximas reservas.", "danger");
        return of([]);
      })
    ).subscribe({
      next: (reservations: Reservation[]) => {
        this.myUpcomingReservations = reservations;
      }
    });
  }

  async confirmReservationAction(reservationId: string, newStatus: ReservationStatus.CONFIRMADA | ReservationStatus.RECHAZADA) {
    const actionText = newStatus === ReservationStatus.CONFIRMADA ? 'aprobar' : 'rechazar';
    const alert = await this.alertCtrl.create({
      header: `Confirmar Acción`,
      message: `¿Estás seguro de que quieres ${actionText} esta reserva?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
          cssClass: newStatus === ReservationStatus.RECHAZADA ? 'text-kwd-red' : 'text-kwd-green',
          handler: () => this.processReservationAction(reservationId, newStatus),
        },
      ],
    });
    await alert.present();
  }

  private async processReservationAction(reservationId: string, newStatus: ReservationStatus.CONFIRMADA | ReservationStatus.RECHAZADA) {
    const loading = await this.loadingCtrl.create({ message: 'Procesando...' });
    await loading.present();

    this.reservationService.updateReservationStatus(reservationId, newStatus)
      .pipe(
        takeUntil(this.destroy$),
        finalize(async () => {
          await loading.dismiss();
        })
      )
      .subscribe({
        next: async () => {
          await this.presentToast(`Reserva ${newStatus === ReservationStatus.CONFIRMADA ? 'aprobada' : 'rechazada'} exitosamente.`, 'success');
          if (this.userRole === Rol.ADMIN) {
            this.fetchAdminDashboardData();
          }
        },
        error: async (err: Error) => {
          await this.presentToast(err.message || 'Error al procesar la reserva.', 'danger');
        }
      });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
    const toast = await this.toastCtrl.create({ 
      message: message,
      duration: 3000,
      color: color,
      position: 'top',
      icon: iconName
    });
    await toast.present();
  }
}
