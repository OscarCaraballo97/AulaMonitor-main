import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, formatDate } from '@angular/common';
import { IonicModule, LoadingController, NavController, ToastController, AlertController } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { Subject, forkJoin, of, Observable } from 'rxjs';
import { takeUntil, finalize, catchError, map } from 'rxjs/operators';
import { AuthService, AuthData } from '../../services/auth.service';
import { ReservationService, PaginatedReservations } from '../../services/reservation.service';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { Rol } from '../../models/rol.model';
import { Reservation, ReservationStatus } from '../../models/reservation.model';
import { BuildingService } from '../../services/building.service';
import { ClassroomService } from '../../services/classroom.service';
import { BuildingDTO } from '../../models/building.model';
import { Classroom } from '../../models/classroom.model';
import { ClassroomType as ReservationClassroomTypeEnum } from '../../models/classroom-type.enum';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
  providers: [DatePipe]
})
export class DashboardPage implements OnInit, OnDestroy {
  currentUser: User | null = null;
  userRole: Rol | null = null;
  RolEnum = Rol;
  ReservationStatusEnum = ReservationStatus;
  ReservationClassroomTypeEnum = ReservationClassroomTypeEnum;

  totalUsers = 0;
  totalBuildings = 0;
  totalClassrooms = 0;
  totalReservations = 0;
  pendingReservationsCount = 0;
  upcomingReservationsCount = 0;
  myRecentReservations: Reservation[] = [];
  upcomingReservations: Reservation[] = [];
  isLoading = false;
  errorMessage: string | null = null;

  showMyReservationsSection: boolean = true;
  isLoadingUpcomingReservations: boolean = false;
  classroomAvailabilitySummary: { availableNow: number; total: number; } | null = null;


  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private reservationService: ReservationService,
    private userService: UserService,
    private buildingService: BuildingService,
    private classroomService: ClassroomService,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private cdr: ChangeDetectorRef,
    private router: Router,
    public datePipe: DatePipe,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.authService.getCurrentUserWithRole().pipe(takeUntil(this.destroy$)).subscribe(
      (authData: AuthData | null) => {
        if (authData?.user && authData?.role) {
          this.currentUser = authData.user;
          this.userRole = authData.role;
          this.loadDashboardData();
        } else {
          this.presentToast('No se pudo obtener la información del usuario. Redirigiendo a login.', 'danger');
          this.navCtrl.navigateRoot('/login');
        }
        this.cdr.detectChanges();
      }
    );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get greetings(): string {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Buenos días';
    } else if (hour < 18) {
      return 'Buenas tardes';
    } else {
      return 'Buenas noches';
    }
  }

  handleRefresh(event?: any) {
    console.log('Refresh initiated.');
    this.errorMessage = null;
    this.loadDashboardData().finally(() => {
      if (event && event.target && typeof event.target.complete === 'function') {
        event.target.complete();
      }
    });
  }

  async loadDashboardData() {
    this.isLoading = true;
    this.isLoadingUpcomingReservations = true;
    const loading = await this.loadingCtrl.create({
      message: 'Cargando datos del panel...',
    });
    await loading.present();

    const observablesMap: { [key: string]: Observable<any> } = {};

    observablesMap['myRecentReservations'] = this.reservationService.getMyReservations(
      'startTime',
      'desc',
      0,
      5,
      undefined,
      false
    ).pipe(
        map((pageResponse: PaginatedReservations) => pageResponse.content),
        catchError(err => {
            console.error('Error loading my recent reservations:', err);
            this.presentToast('Error al cargar mis reservas recientes.', 'danger');
            return of([]);
        })
    );


    observablesMap['upcomingReservationsList'] = this.reservationService.getMyReservations(
      'startTime',
      'asc',
      0,
      5,
      undefined,
      true
    ).pipe(
        map((pageResponse: PaginatedReservations) => pageResponse.content),
        catchError(err => {
            console.error('Error loading upcoming reservations list:', err);
            return of([]);
        }),
        finalize(() => {
          this.isLoadingUpcomingReservations = false;
          this.cdr.detectChanges();
        })
    );


    if (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) {
      observablesMap['pendingReservations'] = this.reservationService.getAllReservations({ status: ReservationStatus.PENDIENTE, page: 0, size: 1 }).pipe(
        map((pageResponse: PaginatedReservations) => pageResponse.totalElements),
        catchError(err => {
            console.error('Error loading pending reservations count:', err);
            return of(0);
        })
      );
      observablesMap['totalReservations'] = this.reservationService.getAllReservations({ page: 0, size: 1 }).pipe(
        map((pageResponse: PaginatedReservations) => pageResponse.totalElements),
        catchError(err => {
            console.error('Error loading total reservations count:', err);
            return of(0);
        })
      );
      observablesMap['allUsers'] = this.userService.getAllUsers().pipe(
        map(users => users.length),
        catchError(err => {
            console.error('Error loading total users count:', err);
            return of(0);
        })
      );
      observablesMap['allBuildings'] = this.buildingService.getAllBuildings().pipe(
        map(buildings => buildings.length),
        catchError(err => {
            console.error('Error loading total buildings count:', err);
            return of(0);
        })
      );
      observablesMap['allClassrooms'] = this.classroomService.getAllClassrooms().pipe(
        map(classrooms => classrooms.length),
        catchError(err => {
            console.error('Error loading total classrooms count:', err);
            return of(0);
        })
      );

      observablesMap['classroomAvailabilitySummary'] = this.classroomService.getAvailabilitySummary().pipe(
        catchError(err => {
          console.error('Error loading classroom availability summary:', err);
          return of({ availableNow: 0, occupiedNow: 0, total: 0 });
        })
      );
    }

    forkJoin(observablesMap).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        await loading.dismiss();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (results: any) => {
        this.myRecentReservations = results['myRecentReservations'] || [];
        this.upcomingReservations = results['upcomingReservationsList'] || [];
        this.upcomingReservationsCount = this.upcomingReservations.length;

        if (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) {
          this.pendingReservationsCount = results['pendingReservations'] || 0;
          this.totalReservations = results['totalReservations'] || 0;
          this.totalUsers = results['allUsers'] || 0;
          this.totalBuildings = results['allBuildings'] || 0;
          this.totalClassrooms = results['allClassrooms'] || 0;
          this.classroomAvailabilitySummary = results['classroomAvailabilitySummary'];
        }
        this.errorMessage = null;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Dashboard data loading error:', err);
        this.errorMessage = err.message || 'Error al cargar algunos datos del panel.';
        this.presentToast(this.errorMessage ?? 'Ocurrió un error desconocido.', 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  toggleMyReservationsSection() {
    this.showMyReservationsSection = !this.showMyReservationsSection;
    this.cdr.detectChanges();
  }

  async viewReservationDetails(reservation: Reservation) {
     if (!reservation || !reservation.id) {
      this.presentToast('No se pueden mostrar los detalles: reserva no válida.', 'warning');
      return;
    }

    const startTimeStr = reservation.startTime?.toString() || '';
    const endTimeStr = reservation.endTime?.toString() || '';

    const startTimeForFormat = (startTimeStr && !startTimeStr.endsWith('Z')) ? startTimeStr + 'Z' : startTimeStr;
    const endTimeForFormat = (endTimeStr && !endTimeStr.endsWith('Z')) ? endTimeStr + 'Z' : endTimeStr;

    const startTime = reservation.startTime ? this.datePipe.transform(new Date(startTimeForFormat), 'dd/MM/yyyy, HH:mm', 'America/Bogota', 'es-CO') : 'N/A';
    const endTime = reservation.endTime ? this.datePipe.transform(new Date(endTimeForFormat), 'HH:mm', 'America/Bogota', 'es-CO') : 'N/A';
    const statusDisplay = reservation.status ? (reservation.status as string).charAt(0).toUpperCase() + (reservation.status as string).slice(1).toLowerCase().replace('_', ' ') : 'N/A';


    const message = `<b>Motivo:</b> ${reservation.purpose || 'No especificado'}<br>` +
                   `<b>Aula:</b> ${reservation.classroom?.name || 'N/A'} (${reservation.classroom?.building?.name || 'N/A'})<br>` + // Acceso correcto a building.name
                   `<b>Inicio:</b> ${startTime}<br>` +
                   `<b>Fin:</b> ${endTime}<br>` +
                   `<b>Estado:</b> ${statusDisplay}<br>` +
                   `<b>Reservado por:</b> ${reservation.user?.name || 'N/A'} (${reservation.user?.email || 'N/A'})<br>` +
                   `<b>ID Reserva:</b> ${reservation.id}`;

    const alert = await this.alertCtrl.create({
      header: 'Detalles de la Reserva',
      message: message,
      buttons: ['OK'],
      mode: 'ios',
      cssClass: 'reservation-detail-alert'
    });
    await alert.present();
  }

  getEventColor(status?: ReservationStatus): string {
    if (!status) return '#808080';
    switch (status) {
      case ReservationStatus.CONFIRMADA: return 'var(--ion-color-success, #2dd36f)';
      case ReservationStatus.PENDIENTE: return 'var(--ion-color-warning, #ffc409)';
      case ReservationStatus.CANCELADA: return 'var(--ion-color-danger, #eb445a)';
      case ReservationStatus.RECHAZADA: return 'var(--ion-color-medium, #92949c)';
      default: return 'var(--ion-color-primary, #3880ff)';
    }
  }

  doLogout() {
    console.log('DashboardPage - doLogout() method calling authService.logout()');
    this.authService.logout();
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', duration: number = 3000) {
    const toast = await this.toastCtrl.create({
      message,
      duration,
      color,
      position: 'top',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await toast.present();
  }
}