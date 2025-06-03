import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule, DatePipe, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {LoadingController, ToastController, AlertController, IonContent } from '@ionic/angular/standalone';
import { Subject, forkJoin, of, Observable } from 'rxjs';
import { takeUntil, catchError, finalize, map } from 'rxjs/operators';

import { AuthService, AuthData } from '../../services/auth.service';
import { ReservationService, ReservationListFilters } from '../../services/reservation.service';
import { ClassroomAvailabilitySummaryDTO, ClassroomService } from '../../services/classroom.service';
import { BuildingService } from '../../services/building.service';
import { UserService } from '../../services/user.service';

import { User } from '../../models/user.model';
import { Rol } from '../../models/rol.model';
import { Reservation, ReservationStatus, ReservationUserDetails, ReservationClassroomDetails } from '../../models/reservation.model';
import { ClassroomType as ReservationClassroomTypeEnum } from '../../models/classroom-type.enum';

import {
  IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonButton, IonIcon,
  IonRefresher, IonRefresherContent, IonSpinner, IonList, IonItem, IonLabel, IonBadge,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonGrid, IonRow, IonCol
} from '@ionic/angular/standalone';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule, IonicModule,
    IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonButton, IonIcon,
    IonRefresher, IonRefresherContent, IonSpinner, IonList, IonItem, IonLabel, IonBadge,
    IonCard, IonCardHeader, IonCardContent
],
  providers: [DatePipe]
})
export class DashboardPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content!: IonContent;
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  userRole: Rol | null = null;
  public RolEnum = Rol;
  public ReservationClassroomTypeEnum = ReservationClassroomTypeEnum;
  public ReservationStatusEnum = ReservationStatus;

  totalBuildings: number = 0;
  totalClassrooms: number = 0;
  totalUsers: number = 0;
  pendingReservationsCount: number = 0;
  classroomAvailabilitySummary: ClassroomAvailabilitySummaryDTO | null = null;
  upcomingReservations: Reservation[] = [];
  isLoading: boolean = true;
  showMyReservationsSection: boolean = true;
  isLoadingUpcomingReservations: boolean = false;
  greetings: string = '';

  constructor(
    private authService: AuthService,
    private reservationService: ReservationService,
    private classroomService: ClassroomService,
    private buildingService: BuildingService,
    private userService: UserService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef,
    private router: Router,
    public datePipe: DatePipe
  ) {
    this.setGreeting();
  }

  ngOnInit() {
    this.isLoading = true;
    this.authService.getCurrentUserWithRole().pipe(
      takeUntil(this.destroy$)
    ).subscribe((authData: AuthData | null) => {
      if (authData && authData.user && authData.role) {
        this.currentUser = authData.user;
        this.userRole = authData.role;
        this.loadDashboardData();
      } else {
        this.isLoading = false;
      }
      this.cdr.detectChanges();
    });
  }

  ionViewWillEnter() {
    if (this.currentUser && this.userRole && !this.isLoading) {
        this.loadDashboardData(true); 
    } else if (!this.currentUser || !this.userRole) {
        this.authService.loadToken();
    }
  }

  setGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) this.greetings = 'Buenos días';
    else if (hour < 18) this.greetings = 'Buenas tardes';
    else this.greetings = 'Buenas noches';
  }

  async loadDashboardData(isRefresh: boolean = false) {
    if (!this.currentUser || !this.userRole) {
      if (!isRefresh) this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    if (!isRefresh) this.isLoading = true;
    let loading: HTMLIonLoadingElement | undefined;
    if (!isRefresh || (isRefresh && this.upcomingReservations.length === 0 && this.pendingReservationsCount === 0) ){
        loading = await this.loadingCtrl.create({ message: isRefresh ? 'Actualizando...' : 'Cargando dashboard...' });
        await loading.present();
    }

    const observablesMap: { [key: string]: Observable<any> } = {};
    this.isLoadingUpcomingReservations = true;
    observablesMap['upcoming'] = this.reservationService.getMyUpcomingReservations(5).pipe(
        finalize(() => {this.isLoadingUpcomingReservations = false; this.cdr.detectChanges(); }),
        catchError(err => {
            this.presentToast(err.message || "Error al cargar próximas reservas.", "warning"); return of([] as Reservation[]);
        })
    );

    if (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) {
      observablesMap['buildingsCount'] = this.buildingService.getAllBuildings().pipe(map(b => b.length), catchError(() => of(0)));
      observablesMap['classroomsCount'] = this.classroomService.getAllClassrooms().pipe(map(c => c.length), catchError(() => of(0)));
      observablesMap['availabilitySummary'] = this.classroomService.getAvailabilitySummary().pipe(catchError(() => of(null)));
      const pendingFilters: ReservationListFilters = { status: ReservationStatus.PENDIENTE, sortField: 'startTime', sortDirection: 'desc' };
      observablesMap['pendingReservationsCount'] = this.reservationService.getAllReservations(pendingFilters).pipe(map(r => r.length), catchError(() => of(0)));
      if (this.userRole === Rol.ADMIN) {
        observablesMap['usersCount'] = this.userService.getAllUsers().pipe(map(u => u.length), catchError(() => of(0)));
      }
    }

    forkJoin(observablesMap).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        if (!isRefresh) this.isLoading = false;
        if (loading && loading.parentElement) {
           try { await loading.dismiss(); } catch(e) { console.error("Error dismissing loading (dashboard)", e); }
        }
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data: any) => {
        this.upcomingReservations = data['upcoming'] || [];
        if (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) {
          this.totalBuildings = data['buildingsCount'] ?? 0;
          this.totalClassrooms = data['classroomsCount'] ?? 0;
          this.classroomAvailabilitySummary = data['availabilitySummary'] || { available: 0, unavailable: 0, total: 0 };
          this.pendingReservationsCount = data['pendingReservationsCount'] ?? 0;
          if (this.userRole === Rol.ADMIN) {
            this.totalUsers = data['usersCount'] ?? 0;
          }
        }
        this.cdr.detectChanges();
      },
      error: (err: Error) => {
        this.isLoading = false; 
        this.presentToast(err.message || "Error cargando datos del dashboard.", "danger");
        this.cdr.detectChanges();
      }
    });
  }

  navigateTo(route: string) { this.router.navigateByUrl(route); }
  
  async viewReservationDetails(reservation: Reservation) {
     if (!reservation || !reservation.id) {
      this.presentToast('No se pueden mostrar los detalles: reserva no válida.', 'warning');
      return;
    }
    const startTime = reservation.startTime ? formatDate(new Date(reservation.startTime), 'dd/MM/yyyy, HH:mm', 'es-CO', 'America/Bogota') : 'N/A';
    const endTime = reservation.endTime ? formatDate(new Date(reservation.endTime), 'HH:mm', 'es-CO', 'America/Bogota') : 'N/A'; 
    const statusDisplay = reservation.status ? (reservation.status as string).charAt(0).toUpperCase() + (reservation.status as string).slice(1).toLowerCase() : 'N/A';
    const message = `
      <p><strong>Motivo:</strong> ${reservation.purpose || 'No especificado'}</p>
      <p><strong>Aula:</strong> ${reservation.classroom?.name || 'N/A'} (${reservation.classroom?.buildingName || 'N/A'})</p>
      <p><strong>Inicio:</strong> ${startTime}</p>
      <p><strong>Fin:</strong> ${endTime}</p>
      <p><strong>Estado:</strong> <span style="color:${this.getEventColor(reservation.status)}; font-weight:bold;">${statusDisplay}</span></p>
      <p><strong>Reservado por:</strong> ${reservation.user?.name || 'N/A'} (${reservation.user?.email || 'N/A'})</p>
      <p><small>ID Reserva: ${reservation.id}</small></p>
    `;
    const alert = await this.alertCtrl.create({ header: 'Detalles de la Reserva', message: message, buttons: ['OK'] });
    await alert.present();
  }

  getEventColor(status: ReservationStatus | undefined): string {
    switch (status) {
      case ReservationStatus.CONFIRMADA: return 'var(--ion-color-success, #2dd36f)';
      case ReservationStatus.PENDIENTE: return 'var(--ion-color-warning, #ffc409)';
      case ReservationStatus.CANCELADA: return 'var(--ion-color-danger, #eb445a)';
      case ReservationStatus.RECHAZADA: return 'var(--ion-color-medium, #808080)';
      default: return 'var(--ion-color-primary, #3880ff)';
    }
  }

  async handleRefresh(event?: any) {
    await this.loadDashboardData(true);
    if (event && event.target && typeof event.target.complete === 'function') {
      event.target.complete();
    }
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top', buttons: [{text:'OK',role:'cancel'}] });
    await toast.present();
  }
  
  toggleMyReservationsSection() {
    this.showMyReservationsSection = !this.showMyReservationsSection;
    this.cdr.detectChanges();
  }

  public doLogout() {
    this.authService.logout();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}