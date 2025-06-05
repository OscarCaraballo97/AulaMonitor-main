import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonRefresher, IonRefresherContent,
  IonSegment, IonSegmentButton, IonLabel, IonBadge, IonList, IonCard, IonItem, IonIcon, IonButton, IonFooter,
  IonSpinner, IonSearchbar, IonSelect, IonSelectOption,
  PopoverController,
  IonInfiniteScroll, IonInfiniteScrollContent,
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
    IonInfiniteScroll, IonInfiniteScrollContent,
    TitleCasePipe
  ],
  providers: [DatePipe] 
})
export class ReservationListPage implements OnInit, OnDestroy, AfterViewInit {
  currentUser: User | null = null;
  userRole: Rol | null = null;
  RolEnum = Rol;
  ReservationClassroomTypeEnum = ReservationClassroomTypeEnum;
  ReservationStatusEnum = ReservationStatus;

  segmentValue: 'pending' | 'my-reservations' | 'list' = 'my-reservations';

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
    private route: ActivatedRoute,
    public datePipe: DatePipe 
  ) {}

  ngOnInit() {
    console.log('ReservationListPage: ngOnInit - START');
    this.authService.getCurrentUserWithRole().pipe(takeUntil(this.destroy$)).subscribe(
      (authData: AuthData | null) => {
      if (authData?.user && authData?.role) {
        this.currentUser = authData.user;
        this.userRole = authData.role;
        console.log('ReservationListPage: User role detected:', this.userRole);
        this.determineInitialSegment();
        this.loadDataBasedOnSegment(true);
      } else {
        console.warn('ReservationListPage: User not authenticated or role not found. Redirecting to login.');
        this.navCtrl.navigateRoot('/login');
      }
      this.cdr.detectChanges();
    });
    console.log('ReservationListPage: ngOnInit - END');
  }

  ngAfterViewInit() {
  }

  determineInitialSegment() {
    const segmentFromQuery = this.route.snapshot.queryParamMap.get('segment') as 'pending' | 'my-reservations' | 'list';
    const currentPath = this.router.url;
    console.log('determineInitialSegment: currentPath:', currentPath, 'segmentFromQuery:', segmentFromQuery, 'userRole:', this.userRole);

    if (currentPath.includes('/reservations/list') && (this.userRole === this.RolEnum.ADMIN || this.userRole === this.RolEnum.COORDINADOR)) {
        this.segmentValue = 'list';
        console.log('determineInitialSegment: Set to "list" based on route and role.');
    } else if (segmentFromQuery && (this.userRole === this.RolEnum.ADMIN || this.userRole === this.RolEnum.COORDINADOR)) {
      this.segmentValue = segmentFromQuery;
      console.log('determineInitialSegment: Set to queryParam "'+ segmentFromQuery +'" based on query and role.');
    } else if (this.userRole === this.RolEnum.ADMIN || this.userRole === this.RolEnum.COORDINADOR) {
      this.segmentValue = 'my-reservations';
      console.log('determineInitialSegment: Defaulted to "my-reservations" for ADMIN/COORDINATOR.');
    } else {
      this.segmentValue = 'my-reservations'; 
      console.log('determineInitialSegment: Defaulted to "my-reservations" for non-ADMIN/COORDINATOR roles.');
    }
    this.cdr.detectChanges(); 
    console.log('Final determined initial segment:', this.segmentValue);
  }

  ionViewWillEnter() {
    console.log('ReservationListPage: ionViewWillEnter. Reloading data based on segment:', this.segmentValue);
    this.loadDataBasedOnSegment(true);
  }

  segmentChanged(event: any) {
    this.segmentValue = event.detail.value;
    console.log('Segment changed to:', this.segmentValue);

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
    this.errorMessage = null;
    console.log('loadDataBasedOnSegment: Loading data for segment:', this.segmentValue, 'isRefresh:', isRefresh);

    if (this.segmentValue === 'pending' && (this.userRole === this.RolEnum.ADMIN || this.userRole === this.RolEnum.COORDINADOR)) {
      this.loadPendingReservations(isRefresh, event);
    } else if (this.segmentValue === 'list' && (this.userRole === this.RolEnum.ADMIN || this.userRole === this.RolEnum.COORDINADOR)) {
      this.loadAllSystemReservations(isRefresh, event);
    } else {
      this.loadMyReservations(isRefresh, event);
    }
  }

  async loadPendingReservations(isRefresh = false, event?: any) {
    if (!this.currentUser || !(this.userRole === this.RolEnum.ADMIN || this.userRole === this.RolEnum.COORDINADOR)) {
      console.warn('Unauthorized access attempt to pending reservations. User:', this.currentUser?.id, 'Role:', this.userRole);
      if (event && event.target) (event.target as unknown as IonRefresher).complete();
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingPending = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    console.log('Loading pending reservations...');
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
        next: (pageResponse: PaginatedReservations) => {
          this.pendingReservations = pageResponse.content || [];
          console.log('Loaded pending reservations:', this.pendingReservations.length, this.pendingReservations);
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse | any) => {
          this.errorMessage = err.error?.message || err.message || 'Error al cargar reservas pendientes.';
          this.pendingReservations = [];
          this.presentToast(this.errorMessage || 'Ocurrió un error desconocido', 'danger');
          console.error('Error loading pending reservations:', err);
          this.cdr.detectChanges();
        }
      });
  }

  private isPaginatedResponse(response: any): response is PaginatedReservations {
    return response && Array.isArray(response.content) && typeof response.totalPages === 'number' && typeof response.totalElements === 'number';
  }

  async loadMyReservations(isRefresh = false, event?: any) {
    if (!this.currentUser) {
      console.warn('Cannot load my reservations: currentUser is null.');
      if (event && event.target) (event.target as unknown as IonRefresher).complete();
      this.cdr.detectChanges();
      return;
    }

    if (isRefresh || this.currentPage === 0) {
      this.myReservations = [];
      this.filteredMyReservations = [];
      this.currentPage = 0;
      console.log('Resetting my reservations data for refresh or initial load.');
    }

    this.isLoadingMyReservations = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    console.log('Loading my reservations for page:', this.currentPage, 'size:', this.itemsPerPage, 'status filter:', this.filterStatus);
    this.reservationService.getMyReservations(
        this.currentSortField,
        this.currentSortDirection,
        this.currentPage,
        this.itemsPerPage,
        this.filterStatus === 'ALL' ? undefined : this.filterStatus,
        false
    ).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoadingMyReservations = false;
        if (event && event.target && typeof event.target.complete === 'function') {
          event.target.complete();
        }
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (response: PaginatedReservations) => {
        const newReservations = response.content || [];
        this.totalPages = response.totalPages || 1;

        this.myReservations = (isRefresh || this.currentPage === 0) ? [...newReservations] : [...this.myReservations, ...newReservations];
        console.log('Loaded my reservations (raw):', this.myReservations.length, this.myReservations);
        this.filterMyReservationsList();

        console.log('Total pages for my reservations:', this.totalPages);
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse | any) => {
        this.errorMessage = err.error?.message || err.message || 'Error al cargar tus reservas.';
        this.myReservations = [];
        this.filterMyReservationsList();
        this.presentToast(this.errorMessage || 'Ocurrió un error desconocido', 'danger');
        console.error('Error loading my reservations:', err);
        this.cdr.detectChanges();
      }
    });
  }

  async loadAllSystemReservations(isRefresh = false, event?: any) {
    if (!this.currentUser || !(this.userRole === this.RolEnum.ADMIN || this.userRole === this.RolEnum.COORDINADOR)) {
      console.warn('Unauthorized access attempt to all system reservations. User:', this.currentUser?.id, 'Role:', this.userRole);
      if (event && event.target) (event.target as unknown as IonRefresher).complete();
      this.cdr.detectChanges();
      return;
    }

    if (isRefresh || this.currentPageAllSystem === 0) {
      this.allSystemReservations = [];
      this.filteredAllSystemReservations = [];
      this.currentPageAllSystem = 0;
      console.log('Resetting all system reservations data for refresh or initial load.');
    }

    this.isLoadingAllSystemReservations = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    console.log('Loading all system reservations for page:', this.currentPageAllSystem, 'size:', this.itemsPerPage, 'status filter:', this.filterStatusAllSystem);
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
        next: (response: PaginatedReservations) => {
          let newReservations: Reservation[] = response.content || [];
          let totalPagesFetched: number = response.totalPages || 1;

          this.allSystemReservations = (isRefresh || this.currentPageAllSystem === 0)
            ? [...newReservations]
            : [...this.allSystemReservations, ...newReservations];
          this.totalPagesAllSystem = totalPagesFetched;

          console.log('Loaded all system reservations (raw):', this.allSystemReservations.length, this.allSystemReservations, 'Total Pages:', this.totalPagesAllSystem);
          this.filterAllSystemReservationsList();

          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse | any) => {
          this.errorMessage = err.error?.message || err.message || 'Error al cargar todas las reservas.';
          this.allSystemReservations = [];
          this.filterAllSystemReservationsList();
          this.presentToast(this.errorMessage || 'Ocurrió un error desconocido', 'danger');
          console.error('Error loading all system reservations:', err);
          this.cdr.detectChanges();
        }
      });
  }

  loadMoreAllSystemReservations(event: any) {
    if (this.currentPageAllSystem < (this.totalPagesAllSystem - 1)) {
      console.log('Loading more all system reservations. Current page:', this.currentPageAllSystem, 'Total pages:', this.totalPagesAllSystem);
      this.currentPageAllSystem++;
      this.loadAllSystemReservations(false, event);
    } else {
      console.log('No more pages for all system reservations. All data loaded.');
      if (event && event.target && typeof event.target.complete === 'function') {
        event.target.complete();
      }
    }
  }

  filterAllSystemReservationsList() {
    console.log('Filtering all system reservations list. Current search term:', this.searchTermAllSystemReservations, 'Status filter:', this.filterStatusAllSystem);
    if (!this.allSystemReservations) {
        this.filteredAllSystemReservations = [];
        this.cdr.detectChanges();
        return;
    }
    let tempReservations = [...this.allSystemReservations];

    if (this.searchTermAllSystemReservations && this.searchTermAllSystemReservations.trim() !== '') {
        const searchTermLower = this.searchTermAllSystemReservations.toLowerCase().trim();
        tempReservations = tempReservations.filter((res) => {
            const purposeMatch = res.purpose?.toLowerCase().includes(searchTermLower);
            const classroomNameMatch = res.classroom?.name?.toLowerCase().includes(searchTermLower);
            const userNameMatch = res.user?.name?.toLowerCase().includes(searchTermLower);
            const userEmailMatch = res.user?.email?.toLowerCase().includes(searchTermLower);
            return purposeMatch || classroomNameMatch || userNameMatch || userEmailMatch;
        });
        console.log('After search term filter (All System):', tempReservations.length);
    }

    if (this.filterStatusAllSystem && this.filterStatusAllSystem !== 'ALL') {
        tempReservations = tempReservations.filter(
            (res) => res.status === this.filterStatusAllSystem
        );
        console.log('After status filter (All System):', tempReservations.length);
    }

    this.filteredAllSystemReservations = [...tempReservations];
    console.log('Final filtered all system reservations:', this.filteredAllSystemReservations.length);
    this.cdr.detectChanges();
  }

  loadMoreMyReservations(event: any) {
    if (this.currentPage < (this.totalPages -1 )) {
      console.log('Loading more my reservations. Current page:', this.currentPage, 'Total pages:', this.totalPages);
      this.currentPage++;
      this.loadMyReservations(false, event);
    } else {
      console.log('No more pages for my reservations. All data loaded.');
      if (event && event.target && typeof event.target.complete === 'function') {
        event.target.complete();
      }
    }
  }

  filterMyReservationsList() {
    console.log('Filtering my reservations list. Current search term:', this.searchTermMyReservations, 'Status filter:', this.filterStatus);
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
      console.log('After status filter (My Reservations):', tempReservations.length);
    }
    if (this.searchTermMyReservations && this.searchTermMyReservations.trim() !== '') {
      const searchTermLower = this.searchTermMyReservations.toLowerCase().trim();
      tempReservations = tempReservations.filter((res) => {
        const purposeMatch = res.purpose?.toLowerCase().includes(searchTermLower);
        const classroomNameMatch = res.classroom?.name?.toLowerCase().includes(searchTermLower);
        const userNameMatch = res.user?.name?.toLowerCase().includes(searchTermLower);
        const userEmailMatch = res.user?.email?.toLowerCase().includes(searchTermLower);
        return purposeMatch || classroomNameMatch || userNameMatch || userEmailMatch;
      });
      console.log('After search term filter (My Reservations):', tempReservations.length);
    }
    this.filteredMyReservations = [...tempReservations];
    console.log('Final filtered my reservations:', this.filteredMyReservations.length);
    this.cdr.detectChanges();
  }

  onSearchMyReservations(event: any) {
    this.filterMyReservationsList();
  }

  onFilterChange(event: any) {
    this.filterMyReservationsList();
  }

  onSearchAllSystemReservations(event: any) {
    this.currentPageAllSystem = 0;
    this.allSystemReservations = [];
    this.loadAllSystemReservations(true);
  }

  onFilterStatusAllSystemChange(event: any) {
      this.currentPageAllSystem = 0;
      this.allSystemReservations = [];
      this.loadAllSystemReservations(true);
  }

  get currentFilterStatusMyReservationsMessage(): string {
    if (this.filterStatus === 'ALL' || !this.filterStatus) return '';
    const foundStatus = this.allStatusesForFilter.find(s => s.value === this.filterStatus);
    return foundStatus ? ` con el estado: ${foundStatus.label.toLowerCase()}` : ` con un estado desconocido`;
  }

  get currentFilterStatusAllSystemMessage(): string {
    if (this.filterStatusAllSystem === 'ALL' || !this.filterStatusAllSystem) return '';
    const foundStatus = this.allStatusesForFilter.find(s => s.value === this.filterStatusAllSystem);
    return foundStatus ? ` con el estado: ${foundStatus.label.toLowerCase()}` : ` con un estado desconocido`;
  }

  handleRefresh(event: any) {
    console.log('Refresh initiated. Resetting pages and reloading data.');
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

  canCreateReservation(): boolean {
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
    if (this.currentUser.id === reservation.user?.id &&
        (reservation.status === ReservationStatus.PENDIENTE || reservation.status === ReservationStatus.CONFIRMADA)) return true;
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
    if (!reservationId) {
      console.error("ID de reserva no definido para editar.");
      this.presentToast("No se pudo navegar a editar: ID de reserva no definido.", "danger");
      return;
    }
    this.router.navigate(['/app/reservations/edit', reservationId]);
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

    const startTime = reservation.startTime ? this.datePipe.transform(new Date(startTimeForFormat), 'dd/MM/yyyy, HH:mm', 'America/Bogota', 'es-CO') : 'N/A';
    const endTime = reservation.endTime ? this.datePipe.transform(new Date(endTimeForFormat), 'HH:mm', 'America/Bogota', 'es-CO') : 'N/A';
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
        error: (err: HttpErrorResponse | any) => {
          const message = err.error?.message || err.message;
          this.presentToast(message || `Error al ${status.toLowerCase()} la reserva.`, 'danger');
          console.error(`Error updating reservation status to ${status}:`, err);
        }
      });
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

  togglePendingSection() {
    this.showPendingSection = !this.showPendingSection;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}