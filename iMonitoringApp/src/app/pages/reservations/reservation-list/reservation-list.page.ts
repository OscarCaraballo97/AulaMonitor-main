import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { IonicModule, LoadingController, ToastController, AlertController, NavController } from '@ionic/angular';
import { CommonModule, formatDate } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms'; 
import { Observable, Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';


import { Reservation, ReservationStatus } from '../../../models/reservation.model';
import { User } from '../../../models/user.model';
import { Rol } from '../../../models/rol.model';
import { ReservationService } from '../../../services/reservation.service';
import { AuthService } from '../../../services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-reservation-list',
  templateUrl: './reservation-list.page.html',
  styleUrls: ['./reservation-list.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule, FormsModule] 
})
export class ReservationListPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  pendingReservations: Reservation[] = [];
  myReservations: Reservation[] = [];
  filteredMyReservations: Reservation[] = [];
  
  isLoadingPending = false;
  isLoadingMyReservations = false;
  isLoading = false; 
  
  currentUser: User | null = null;
  userRole: Rol | null = null;
  
  segmentValue: 'pending' | 'my-reservations' = 'pending';
  searchTermMyReservations: string = '';


  showPendingSection: boolean = true;
  filterStatus: ReservationStatus | 'ALL' = 'ALL'; 
  

  allStatusesForFilter: { label: string, value: ReservationStatus | 'ALL' }[] = [
    { label: 'Todas', value: 'ALL' },
    { label: 'Pendientes', value: ReservationStatus.PENDIENTE },
    { label: 'Confirmadas', value: ReservationStatus.CONFIRMADA },
    { label: 'Canceladas', value: ReservationStatus.CANCELADA },
    { label: 'Rechazadas', value: ReservationStatus.RECHAZADA }

  ];
  
  public ReservationStatusEnum = ReservationStatus;
  public RolEnum = Rol;
  errorMessage: string | null = null;

  constructor(
    private reservationService: ReservationService,
    private authService: AuthService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    console.log("ReservationListPage: ngOnInit");
    this.authService.currentUser.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUser = user;
      this.userRole = user?.role || null;
      console.log("ReservationListPage: Usuario actual:", this.currentUser);
      this.determineInitialSegment();
      this.loadDataBasedOnSegment();
    });
  }

  ionViewWillEnter() {
    console.log("ReservationListPage: ionViewWillEnter");

    this.loadDataBasedOnSegment();
  }
  
  determineInitialSegment() {
    if (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) {
      this.segmentValue = 'pending';
      this.showPendingSection = true;
    } else {
      this.segmentValue = 'my-reservations';
      this.showPendingSection = false; 
    }
    console.log("ReservationListPage: Segmento inicial determinado:", this.segmentValue);
  }

  segmentChanged(event: any) {
    this.segmentValue = event.detail.value;
    this.filterStatus = 'ALL'; 
    this.searchTermMyReservations = '';
    console.log("ReservationListPage: Segmento cambiado a:", this.segmentValue);
    this.loadDataBasedOnSegment();
  }

  loadDataBasedOnSegment() {
    console.log("ReservationListPage: loadDataBasedOnSegment - Segmento actual:", this.segmentValue);
    this.errorMessage = null;
    if (this.segmentValue === 'pending' && (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR)) {
      this.loadPendingReservations();
    } else if (this.segmentValue === 'my-reservations') {
      this.loadMyReservations();
    } else {
      this.pendingReservations = [];
      this.myReservations = [];
      this.filteredMyReservations = [];
      this.cdr.detectChanges();
    }
  }

  async loadPendingReservations() {
    if (this.userRole !== Rol.ADMIN && this.userRole !== Rol.COORDINADOR) {
      this.pendingReservations = [];
      this.isLoadingPending = false;
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingPending = true;
    this.errorMessage = null;
    const loading = await this.loadingCtrl.create({ message: 'Cargando pendientes...' });
    await loading.present();
    console.log("ReservationListPage: loadPendingReservations - Llamando al servicio...");

    this.reservationService.getAllReservations({ status: ReservationStatus.PENDIENTE })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingPending = false;
          if (loading) loading.dismiss().catch(err => console.error("Error dismissing loading (pending)", err));
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (data) => {
          this.pendingReservations = data;
          console.log('ReservationListPage: Reservas pendientes cargadas:', this.pendingReservations);
          if (this.pendingReservations.length === 0) {
            console.log("ReservationListPage: No hay reservas pendientes para mostrar.");
          }
        },
        error: (err: HttpErrorResponse | Error) => { 
          console.error('ReservationListPage: Error cargando reservas pendientes:', err);
          this.errorMessage = err.message || 'Error desconocido al cargar reservas pendientes.';
          this.presentToast(this.errorMessage, 'danger');
        }
      });
  }

  async loadMyReservations(status: ReservationStatus | 'ALL' = this.filterStatus) {
    this.isLoadingMyReservations = true;
    this.errorMessage = null;
    const loading = await this.loadingCtrl.create({ message: 'Cargando mis reservas...' });
    await loading.present();
    console.log("ReservationListPage: loadMyReservations - Llamando al servicio con filtro de estado:", status);

    const filters: any = { sort: 'startTime,desc' };
    if (status !== 'ALL') {
      filters.status = status;
    }
        
    this.reservationService.getMyReservations(filters) 
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingMyReservations = false;
          if (loading) loading.dismiss().catch(err => console.error("Error dismissing loading (my reservations)", err));
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (data) => {
          this.myReservations = data;
          this.filterMyReservationsList(this.searchTermMyReservations);
          console.log('ReservationListPage: Mis reservas cargadas:', this.myReservations);
          if (this.myReservations.length === 0) {
            console.log("ReservationListPage: No tienes reservas para mostrar con el filtro actual.");
          }
        },
        error: (err: HttpErrorResponse | Error) => { 
          console.error('ReservationListPage: Error cargando mis reservas:', err);
          this.errorMessage = err.message || 'Error desconocido al cargar mis reservas.';
          this.presentToast(this.errorMessage, 'danger');
        }
      });
  }

  onSearchMyReservations(event: any) {
    this.searchTermMyReservations = event.detail.value || '';
    this.filterMyReservationsList(this.searchTermMyReservations);
  }

  filterMyReservationsList(term: string) {
    const searchTerm = term.toLowerCase().trim();
    if (!searchTerm) {
      this.filteredMyReservations = [...this.myReservations];
    } else {
      this.filteredMyReservations = this.myReservations.filter(res => 
        (res.purpose && res.purpose.toLowerCase().includes(searchTerm)) ||
        (res.classroom?.name && res.classroom.name.toLowerCase().includes(searchTerm)) ||
        (res.status && res.status.toString().toLowerCase().includes(searchTerm)) ||
        (res.user?.name && res.user.name.toLowerCase().includes(searchTerm))
      );
    }
    console.log("ReservationListPage: filteredMyReservations después de búsqueda:", this.filteredMyReservations);
    this.cdr.detectChanges();
  }

  onFilterChange(event: any) {
    this.filterStatus = event.detail.value;
    console.log("ReservationListPage: Filtro de estado cambiado a:", this.filterStatus);
    if (this.segmentValue === 'my-reservations') {
      this.loadMyReservations(this.filterStatus);
    } else if (this.segmentValue === 'pending') {
      if (this.filterStatus === 'ALL' || this.filterStatus === ReservationStatus.PENDIENTE) {
         this.loadPendingReservations();
      } else {
        this.pendingReservations = []; 
        console.log("ReservationListPage: Filtro no aplicable a pendientes, lista de pendientes vaciada.");
      }
    }
  }
  
  togglePendingSection() {
    this.showPendingSection = !this.showPendingSection;
  }

  get canCreateReservation(): boolean {
    return !!this.currentUser; 
  }

  navigateToAddReservation() {
    this.navCtrl.navigateForward('/app/reservations/new');
  }

  canEditReservation(reservation: Reservation): boolean {
    if (!this.currentUser) return false;
    if (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) return true;
    return reservation.userId === this.currentUser.id && reservation.status === ReservationStatus.PENDIENTE;
  }

  canCancelReservation(reservation: Reservation): boolean {
    if (!this.currentUser) return false;
    if (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) return true;
    return reservation.userId === this.currentUser.id && 
           (reservation.status === ReservationStatus.PENDIENTE || reservation.status === ReservationStatus.CONFIRMADA);
  }
  
  canManageStatus(reservation: Reservation): boolean {
    return this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR;
  }

  async confirmAction(reservation: Reservation, action: 'confirm' | 'reject' | 'cancel') {
    if (!reservation.id) {
      this.presentToast('Error: ID de reserva no disponible.', 'danger');
      return;
    }

    let newStatus: ReservationStatus | undefined;
    let actionText: string;
    let confirmButtonText: string;
    let alertHeader: string;

    switch (action) {
      case 'confirm':
        newStatus = ReservationStatus.CONFIRMADA;
        actionText = 'confirmar';
        alertHeader = 'Confirmar Reserva';
        confirmButtonText = 'Sí, Confirmar';
        break;
      case 'reject':
        newStatus = ReservationStatus.RECHAZADA;
        actionText = 'rechazar';
        alertHeader = 'Rechazar Reserva';
        confirmButtonText = 'Sí, Rechazar';
        break;
      case 'cancel':
        actionText = 'cancelar';
        alertHeader = 'Cancelar Reserva';
        confirmButtonText = 'Sí, Cancelar';
        break;
      default:
        console.error('Acción no válida:', action);
        return;
    }

    const alert = await this.alertCtrl.create({
      header: alertHeader,
      message: `¿Estás seguro de que quieres ${actionText} la reserva para "${reservation.purpose || 'el aula ' + reservation.classroom?.name}"?`,
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: confirmButtonText,
          cssClass: action === 'reject' || action === 'cancel' ? 'alert-button-danger' : '',
          handler: async () => {
            const loading = await this.loadingCtrl.create({ message: 'Procesando...' });
            await loading.present();
            
            let operation$: Observable<Reservation>;

            if (action === 'cancel') {
              operation$ = this.reservationService.cancelMyReservation(reservation.id!);
            } else {
              operation$ = this.reservationService.updateReservationStatus(reservation.id!, newStatus!);
            }

            operation$.pipe(
                takeUntil(this.destroy$),
                finalize(() => {
                    if (loading) loading.dismiss().catch(err => console.error("Error dismissing loading (confirmAction)", err));
                })
              )
              .subscribe({
                next: (updatedRes) => {
                  this.presentToast(`Reserva ${actionText}a exitosamente.`, 'success');

                  if (this.segmentValue === 'pending' && (action === 'confirm' || action === 'reject')) {
                    this.loadPendingReservations();
                  }
              
                  this.loadMyReservations(this.filterStatus); 
                  if((this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR)) {
                    this.loadPendingReservations(); 
                  }
                  console.log(`Reserva ${actionText}a:`, updatedRes);
                },
                error: (err: HttpErrorResponse | Error | any) => { 
                  console.error(`Error al ${actionText} la reserva:`, err);
                  this.presentToast(err.message || `Error al ${actionText} la reserva.`, 'danger');
                  this.loadDataBasedOnSegment();
                }
              });
          }
        }
      ]
    });
    await alert.present();
  }
  
  navigateToEditReservation(reservationId?: string) {
    if (!reservationId) return;
    this.navCtrl.navigateForward(`/app/reservations/edit/${reservationId}`);
  }
  
  async viewReservationDetails(reservation: Reservation) {
    if (!reservation || !reservation.id) return;
  
    const startTime = reservation.startTime ? formatDate(new Date(reservation.startTime), 'medium', 'es-CO', 'America/Bogota') : 'N/A';
    const endTime = reservation.endTime ? formatDate(new Date(reservation.endTime), 'medium', 'es-CO', 'America/Bogota') : 'N/A';
    const statusDisplay = reservation.status ? (reservation.status as string).charAt(0).toUpperCase() + (reservation.status as string).slice(1).toLowerCase() : 'N/A';
  
    let message = `
      <strong>Motivo:</strong> ${reservation.purpose || 'No especificado'}<br>
      <strong>Aula:</strong> ${reservation.classroom?.name || 'N/A'} (${reservation.classroom?.building?.name || 'N/A'})<br>
      <strong>Inicio:</strong> ${startTime}<br>
      <strong>Fin:</strong> ${endTime}<br>
      <strong>Estado:</strong> <span style="color:${this.getEventColor(reservation.status)}; font-weight:bold;">${statusDisplay}</span><br>
      <strong>Reservado por:</strong> ${reservation.user?.name || 'N/A'} (${reservation.user?.email || 'N/A'})
    `;
  
    const alert = await this.alertCtrl.create({
      header: 'Detalles de la Reserva',
      message: message,
      buttons: ['OK']
    });
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

  async handleRefresh(event: any) {
    console.log('Refrescando listas con Pull-to-refresh...');
    try {
      await this.loadDataBasedOnSegment();
    } finally {
      if (event && event.target && typeof event.target.complete === 'function') {
        event.target.complete();
      }
    }
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning' | 'primary' | 'secondary' | 'tertiary' | 'light' | 'medium' | 'dark') {
    const toast = await this.toastCtrl.create({ 
      message, 
      duration: 3500, 
      color, 
      position: 'top',
      buttons: [{text: 'OK', role: 'cancel'}]
    });
    toast.present();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}