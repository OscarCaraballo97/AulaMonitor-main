// iMonitoringApp/src/app/pages/reservations/reservation-list/reservation-list.page.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonRefresher, IonRefresherContent,
  IonSegment, IonSegmentButton, IonLabel, IonBadge, IonList, IonCard, IonItem, IonIcon, IonButton, IonFooter,
  IonSpinner, IonSearchbar, IonSelect, IonSelectOption,
  PopoverController,
  // Removed IonInfiniteScroll and IonInfiniteScrollContent as per warning.
} from '@ionic/angular/standalone';
import { AlertController, LoadingController, NavController, ToastController } from '@ionic/angular';

import { ReservationService, ReservationListFilters, PaginatedReservations } from '../../../services/reservation.service';
import { AuthService, AuthData } from '../../../services/auth.service';
import { Reservation, ReservationStatus } from '../../../models/reservation.model';
import { ClassroomType as ReservationClassroomTypeEnum } from '../../../models/classroom-type.enum';
import { User } from '../../../models/user.model';
import { Rol } from '../../../models/rol.model';
import { Subject } from 'rxjs';
import { takeUntil, finalize, catchError } from 'rxjs/operators';

import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-reservation-list',
  templateUrl: './reservation-list.page.html',
  styleUrls: ['./reservation-list.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonRefresher, IonRefresherContent,
    IonSegment, IonSegmentButton, IonLabel, IonBadge, IonList, IonCard, IonItem, IonIcon, IonButton, IonFooter,
    IonSpinner, IonSearchbar, IonSelect, IonSelectOption,
    // Note: If you later add infinite scroll functionality, you will need to re-import these.
    // IonInfiniteScroll, IonInfiniteScrollContent,
    TitleCasePipe

  ]
})
export class ReservationListPage implements OnInit, OnDestroy, AfterViewInit {
  // @ViewChild('myReservationsInfiniteScroll') infiniteScrollMyReservations!: IonInfiniteScroll; // Keep if actually used for infinite scroll
  // @ViewChild('allSystemReservationsInfiniteScroll') infiniteScrollAllSystem!: IonInfiniteScroll; // Keep if actually used for infinite scroll

  currentUser: User | null = null;
  userRole: Rol | null = null;
  RolEnum = Rol;
  ReservationClassroomTypeEnum = ReservationClassroomTypeEnum;

  segmentValue: 'pending' | 'my-reservations' | 'all' = 'pending';

  pendingReservations: Reservation[] = [];
  isLoadingPending = false;
  showPendingSection = true;

  myReservations: Reservation[] = [];
  filteredMyReservations: Reservation[] = [];
  isLoadingMyReservations = false;

  allSystemReservations: Reservation[] = [];
  filteredAllSystemReservations: Reservation[] = [];
  isLoadingAllSystemReservations = false;
  searchTermAllSystemReservations: string = '';
  filterStatusAllSystem: ReservationStatus | 'ALL' = 'ALL';
  currentPageAllSystem = 0;
  totalPagesAllSystem = 0;

  searchTermMyReservations: string = '';
  filterStatus: ReservationStatus | 'ALL' = 'ALL';

  allStatusesForFilter = [
    { value: 'ALL' as const, label: 'Todos los estados' },
    { value: ReservationStatus.PENDIENTE, label: 'Pendiente' },
    { value: ReservationStatus.CONFIRMADA, label: 'Confirmada' },
    { value: ReservationStatus.RECHAZADA, label: 'Rechazada' },
    { value: ReservationStatus.CANCELADA, label: 'Cancelada' }
  ];

  errorMessage: string | null = null;

  currentPage = 0;
  itemsPerPage = 10;
  totalPages = 0;

  currentSortField: keyof Reservation = 'startTime';
  currentSortDirection: 'asc' | 'desc' = 'desc';

  private destroy$ = new Subject<void>();

  constructor(
    private reservationService: ReservationService,
    private authService: AuthService,
    private router: Router,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private cdr: ChangeDetectorRef,
    private popoverCtrl: PopoverController,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.authService.getCurrentUserWithRole().pipe(takeUntil(this.destroy$)).subscribe(
      (authData: AuthData | null) => {
      if (authData?.user && authData?.role) {
        this.currentUser = authData.user;
        this.userRole = authData.role;
        this.determineInitialSegment();
        this.loadDataBasedOnSegment(true);
      } else {
        this.navCtrl.navigateRoot('/login');
      }
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit() {
  }

  determineInitialSegment() {
    const segmentFromQuery = this.route.snapshot.queryParamMap.get('segment') as 'pending' | 'my-reservations' | 'all';
    if (segmentFromQuery && (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR)) {
      this.segmentValue = segmentFromQuery;
    } else if (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) {
      this.segmentValue = 'all';
    } else {
      this.segmentValue = 'my-reservations';
    }
  }

  ionViewWillEnter() {
  }

  segmentChanged(event: any) {
    this.segmentValue = event.detail.value;
    this.currentPage = 0;
    this.currentPageAllSystem = 0;
    this.myReservations = [];
    this.filteredMyReservations = [];
    this.pendingReservations = [];
    this.allSystemReservations = [];
    this.filteredAllSystemReservations = [];
    this.loadDataBasedOnSegment(true);
  }

  loadDataBasedOnSegment(isRefresh = false, event?: any) {
    if (this.segmentValue === 'pending' && (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR)) {
      this.loadPendingReservations(isRefresh, event);
    } else if (this.segmentValue === 'all' && (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR)) {
      this.loadAllSystemReservations(isRefresh, event);
    } else {
      this.loadMyReservations(isRefresh, event);
    }
  }

  async loadPendingReservations(isRefresh = false, event?: any) {
    if (!this.currentUser || !(this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR)) return;

    this.isLoadingPending = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    const filters: ReservationListFilters = { status: ReservationStatus.PENDIENTE, sortField: 'startTime', sortDirection: 'desc' };
    this.reservationService.getAllReservations(filters)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingPending = false;
          if (event && event.target && typeof event.target.complete === 'function') {
            event.target.complete();
          }
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (reservations: Reservation[]) => {
          this.pendingReservations = reservations || [];
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse | any) => {
          this.errorMessage = err.error?.message || err.message || 'Error al cargar reservas pendientes.';
          this.pendingReservations = [];
          this.presentToast(this.errorMessage || 'Ocurrió un error desconocido', 'danger');
          this.cdr.detectChanges();
        }
      });
  }

  private isPaginatedResponse(response: any): response is PaginatedReservations {
    return response && Array.isArray(response.data) && typeof response.totalPages === 'number';
  }

  async loadMyReservations(isRefresh = false, event?: any) {
    if (!this.currentUser) return;

    if (isRefresh || this.currentPage === 0) {
      this.myReservations = [];
      this.filteredMyReservations = [];
      this.currentPage = 0;
    }

    this.isLoadingMyReservations = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    this.reservationService.getMyReservations(
        this.currentSortField,
        this.currentSortDirection,
        this.currentPage,
        this.itemsPerPage,
        this.filterStatus === 'ALL' ? undefined : this.filterStatus,
        false
    ).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response: PaginatedReservations) => {
        this.isLoadingMyReservations = false;
        const newReservations = response.data || [];
        this.totalPages = response.totalPages || 1;

        this.myReservations = (isRefresh || this.currentPage === 0) ? [...newReservations] : [...this.myReservations, ...newReservations];
        this.filterMyReservationsList();

        if (event && event.target && typeof event.target.complete === 'function') {
          event.target.complete();
        }
        
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse | any) => {
        this.isLoadingMyReservations = false;
        this.errorMessage = err.error?.message || err.message || 'Error al cargar tus reservas.';
        this.myReservations = [];
        this.filterMyReservationsList();
        if (event && event.target && typeof event.target.complete === 'function') {
          event.target.complete();
        }
        
        this.presentToast(this.errorMessage || 'Error desconocido al cargar mis reservas', 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  async loadAllSystemReservations(isRefresh = false, event?: any) {
    if (!this.currentUser || !(this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR)) return;

    if (isRefresh || this.currentPageAllSystem === 0) {
      this.allSystemReservations = [];
      this.filteredAllSystemReservations = [];
      this.currentPageAllSystem = 0;
      
    }

    this.isLoadingAllSystemReservations = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    const filters: ReservationListFilters = {
      status: this.filterStatusAllSystem === 'ALL' ? undefined : this.filterStatusAllSystem,
      sortField: 'startTime',
      sortDirection: 'desc',
      page: this.currentPageAllSystem,
      size: this.itemsPerPage
    };

    this.reservationService.getAllReservations(filters)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingAllSystemReservations = false;
          if (event && event.target && typeof event.target.complete === 'function') {
            event.target.complete();
          }
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response: Reservation[] | PaginatedReservations) => {
          let newReservations: Reservation[] = [];
          
          if (this.isPaginatedResponse(response)) {
             newReservations = response.data || [];
             this.totalPagesAllSystem = response.totalPages || 1;
          } else if (Array.isArray(response)) { 
             newReservations = response || [];
            
             this.totalPagesAllSystem = 1; 
          } else {
            console.error('Formato de respuesta inesperado para todas las reservas:', response);
            newReservations = [];
            this.totalPagesAllSystem = 1;
          }

          this.allSystemReservations = (isRefresh || this.currentPageAllSystem === 0) ? [...newReservations] : [...this.allSystemReservations, ...newReservations];
          this.filterAllSystemReservationsList();

          
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse | any) => {
          this.isLoadingAllSystemReservations = false;
          this.errorMessage = err.error?.message || err.message || 'Error al cargar todas las reservas.';
          this.allSystemReservations = [];
          this.filterAllSystemReservationsList();
          
          this.presentToast(this.errorMessage || 'Error desconocido', 'danger');
          this.cdr.detectChanges();
        }
      });
  }

  loadMoreAllSystemReservations(event: any) {
    if (this.currentPageAllSystem < (this.totalPagesAllSystem - 1)) {
      this.currentPageAllSystem++;
      this.loadAllSystemReservations(false, event);
    } else {
      if (event && event.target && typeof event.target.complete === 'function') {
        event.target.complete();
      }
      
    }
  }

  
  filterAllSystemReservationsList() {
    if (!this.allSystemReservations) {
        this.filteredAllSystemReservations = [];
        this.cdr.detectChanges();
        return;
    }
    let tempReservations = [...this.allSystemReservations];
    
    this.filteredAllSystemReservations = [...tempReservations];
    this.cdr.detectChanges();
  }

  loadMoreMyReservations(event: any) {
    if (this.currentPage < (this.totalPages -1 )) {
      this.currentPage++;
      this.loadMyReservations(false, event);
    } else {
      if (event && event.target && typeof event.target.complete === 'function') {
        event.target.complete();
      }
      
    }
  }

  filterMyReservationsList() {
    if (!this.myReservations) {
        this.filteredMyReservations = [];
        this.cdr.detectChanges();
        return;
    }
    let tempReservations = [...this.myReservations];
    if (this.filterStatus && this.filterStatus !== 'ALL') {
      tempReservations = tempReservations.filter(
        (res) => res.status === this.filterStatus
      );
    }
    if (this.searchTermMyReservations && this.searchTermMyReservations.trim() !== '') {
      const searchTermLower = this.searchTermMyReservations.toLowerCase().trim();
      tempReservations = tempReservations.filter((res) => {
        const purposeMatch = res.purpose?.toLowerCase().includes(searchTermLower);
        const classroomNameMatch = res.classroom?.name?.toLowerCase().includes(searchTermLower);
        const userNameMatch = res.user?.name?.toLowerCase().includes(searchTermLower);
        return purposeMatch || classroomNameMatch || userNameMatch;
      });
    }
    this.filteredMyReservations = [...tempReservations];
    this.cdr.detectChanges();
  }

  onSearchMyReservations(event: any) {
    this.filterMyReservationsList();
  }

  onFilterChange(event: any) {
    this.filterMyReservationsList();
  }

  get currentFilterStatusMessage(): string {
    if (this.filterStatus === 'ALL' || !this.filterStatus) return '';
    const foundStatus = this.allStatusesForFilter.find(s => s.value === this.filterStatus);
    return foundStatus ? ` con el estado: ${foundStatus.label.toLowerCase()}` : ` con un estado desconocido`;
  }

  handleRefresh(event: any) {
    this.currentPage = 0;
    this.currentPageAllSystem = 0;
    this.loadDataBasedOnSegment(true, event);
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

  get canCreateReservation(): boolean {
    return this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR || this.userRole === Rol.PROFESOR || this.userRole === Rol.ESTUDIANTE || this.userRole === Rol.TUTOR;
  }

  canManageStatus(reservation: Reservation): boolean {
    if (!this.currentUser || !this.userRole) return false;
    if (this.userRole === Rol.ADMIN) return true;
    if (this.userRole === Rol.COORDINADOR && reservation.user?.role === Rol.ESTUDIANTE) return true;
    return false;
  }

  canEditReservation(reservation: Reservation): boolean {
    if (!this.currentUser || !this.userRole) return false;
    if (this.userRole === Rol.ADMIN) return true;
    if (this.currentUser.id === reservation.user?.id && reservation.status === ReservationStatus.PENDIENTE) return true;
    if (this.userRole === Rol.COORDINADOR && reservation.user?.role === Rol.ESTUDIANTE &&
        (reservation.status === ReservationStatus.PENDIENTE || reservation.status === ReservationStatus.CONFIRMADA)) {
        return true;
    }
    return false;
  }

  canCancelReservation(reservation: Reservation): boolean {
    if (!this.currentUser) return false;
    if (this.userRole === Rol.ADMIN) return true;
    if (this.currentUser.id === reservation.user?.id &&
        (reservation.status === ReservationStatus.PENDIENTE || reservation.status === ReservationStatus.CONFIRMADA)) {
      return true;
    }
    if (this.userRole === Rol.COORDINADOR && reservation.user?.role === Rol.ESTUDIANTE &&
        (reservation.status === ReservationStatus.PENDIENTE || reservation.status === ReservationStatus.CONFIRMADA)) {
        return true;
    }
    return false;
  }

  navigateToAddReservation() {
    this.router.navigate(['/app/reservations/new']);
  }

  navigateToEditReservation(reservationId?: string) {
    if (reservationId) {
      this.router.navigate(['/app/reservations/edit', reservationId]);
    } else {
      console.error("ID de reserva no definido para editar.");
      this.presentToast("No se pudo navegar a editar: ID de reserva no definido.", "danger");
    }
  }

  async viewReservationDetails(reservation: Reservation) {
     if (!reservation || !reservation.id) {
      this.presentToast('No se pueden mostrar los detalles: reserva no válida.', 'warning');
      return;
    }

    const startTimeStr = reservation.startTime || '';
    const endTimeStr = reservation.endTime || '';

    const startTimeForFormat = (startTimeStr && !startTimeStr.endsWith('Z')) ? startTimeStr + 'Z' : startTimeStr;
    const endTimeForFormat = (endTimeStr && !endTimeStr.endsWith('Z')) ? endTimeStr + 'Z' : endTimeStr;

    const startTime = reservation.startTime ? formatDate(new Date(startTimeForFormat), 'dd/MM/yyyy, HH:mm', 'es-CO', 'America/Bogota') : 'N/A';
    const endTime = reservation.endTime ? formatDate(new Date(endTimeForFormat), 'HH:mm', 'es-CO', 'America/Bogota') : 'N/A';
    const statusDisplay = reservation.status ? (reservation.status as string).charAt(0).toUpperCase() + (reservation.status as string).slice(1).toLowerCase().replace('_', ' ') : 'N/A';

    const message = `<b>Motivo:</b> ${reservation.purpose || 'No especificado'}<br>` +
                   `<b>Aula:</b> ${reservation.classroom?.name || 'N/A'} (${reservation.classroom?.buildingName || 'N/A'})<br>` +
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

  async confirmAction(reservation: Reservation, action: 'confirm' | 'reject' | 'cancel') {
    let headerText = '';
    let messageText = `¿Estás seguro de que deseas ${action === 'confirm' ? 'confirmar' : (action === 'reject' ? 'rechazar' : 'cancelar')} esta reserva?`;
    let confirmHandler: () => void;

    switch (action) {
      case 'confirm':
        headerText = 'Confirmar Reserva';
        confirmHandler = () => this.updateStatus(reservation, ReservationStatus.CONFIRMADA);
        break;
      case 'reject':
        headerText = 'Rechazar Reserva';
        confirmHandler = () => this.updateStatus(reservation, ReservationStatus.RECHAZADA);
        break;
      case 'cancel':
        headerText = 'Cancelar Reserva';
        confirmHandler = () => this.updateStatus(reservation, ReservationStatus.CANCELADA);
        break;
      default:
        return;
    }

    const alert = await this.alertCtrl.create({
      header: headerText,
      message: messageText,
      buttons: [
        { text: 'No', role: 'cancel' },
        { text: 'Sí', handler: confirmHandler }
      ]
    });
    await alert.present();
  }

  async updateStatus(reservation: Reservation, status: ReservationStatus) {
    if (!reservation || !reservation.id) {
      this.presentToast('Error: No se puede actualizar el estado de una reserva inválida.', 'danger');
      return;
    }
    const loading = await this.loadingCtrl.create({ message: 'Actualizando estado...' });
    await loading.present();
    this.reservationService.updateReservationStatus(reservation.id, status)
      .pipe(takeUntil(this.destroy$), finalize(() => loading.dismiss()))
      .subscribe({
        next: () => {
          this.presentToast(`Reserva ${status.toLowerCase()} exitosamente.`, 'success');
          this.loadDataBasedOnSegment(true);
        },
        error: (err: HttpErrorResponse | any) => this.presentToast(err.message || `Error al ${status.toLowerCase()} la reserva.`, 'danger')
      });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', duration: number = 3000) {
    const toast = await this.toastCtrl.create({
        message,
        duration,
        color,
        position: 'top',
        buttons: [{text:'OK',role:'cancel'}]
    });
    toast.present();
  }

  togglePendingSection() {
    this.showPendingSection = !this.showPendingSection;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}