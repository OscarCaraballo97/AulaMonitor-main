import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonicModule, LoadingController, ToastController, NavController, AlertController } from '@ionic/angular';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil, catchError, tap, take, finalize } from 'rxjs/operators'; // Asegúrate que finalize esté aquí

import { Calendar, CalendarOptions, EventInput, EventClickArg, DateSelectArg, EventApi } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';

import { ClassroomService } from '../../../services/classroom.service';
import { ReservationService } from '../../../services/reservation.service';
import { AuthService } from '../../../services/auth.service';
import { Classroom } from '../../../models/classroom.model';
import { Reservation, ReservationStatus } from '../../../models/reservation.model';
import { User } from '../../../models/user.model';
import { Rol } from '../../../models/rol.model';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-classroom-availability',
  templateUrl: './classroom-availability.page.html',
  styleUrls: ['./classroom-availability.page.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    RouterModule,
  ]
})
export class ClassroomAvailabilityPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('calendarEl') calendarEl!: ElementRef<HTMLDivElement>;

  private destroy$ = new Subject<void>();

  allClassrooms: Classroom[] = [];
  selectedClassroomId: string | null = null;
  currentUser: User | null = null;
  userRole: Rol | null = null;

  calendarApi?: Calendar;
  calendarOptions!: CalendarOptions;
  isLoadingCalendar = true;
  isLoadingClassrooms = true;
  currentReservations: Reservation[] = [];
  
  public RolEnum = Rol;
  public ReservationStatusEnum = ReservationStatus;

  get selectedClassroomName(): string | undefined {
    if (!this.selectedClassroomId || !this.allClassrooms) {
      return undefined;
    }
    const foundClassroom = this.allClassrooms.find(c => c.id === this.selectedClassroomId);
    return foundClassroom?.name;
  }

  constructor(
    private classroomService: ClassroomService,
    private reservationService: ReservationService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    console.log("ClassroomAvailabilityPage: ngOnInit - INICIO");
    this.authService.currentUser.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUser = user;
      this.userRole = user?.role || null;
      console.log("ClassroomAvailabilityPage: Usuario y Rol actualizados:", this.currentUser, this.userRole);
    });

    this.loadInitialData();
    console.log("ClassroomAvailabilityPage: ngOnInit - FIN");
  }

  async loadInitialData() {
    console.log("ClassroomAvailabilityPage: loadInitialData - INICIO");
    this.isLoadingClassrooms = true;
    this.cdr.detectChanges();

    try {
      this.allClassrooms = await firstValueFrom(this.classroomService.getAllClassrooms().pipe(takeUntil(this.destroy$)));
      console.log("ClassroomAvailabilityPage: Aulas cargadas para el selector:", this.allClassrooms);

      const params = await firstValueFrom(this.route.queryParams.pipe(take(1)));
      const classroomIdFromParams = params['classroomId'];

      if (classroomIdFromParams && this.allClassrooms.some(c => c.id === classroomIdFromParams)) {
        this.selectedClassroomId = classroomIdFromParams;
        console.log("ClassroomAvailabilityPage: Aula preseleccionada desde queryParams:", this.selectedClassroomId);
      } else if (this.allClassrooms.length > 0) {
        // No preseleccionar
      } else {
        console.warn("ClassroomAvailabilityPage: No hay aulas disponibles para seleccionar.");
        this.presentToast("No hay aulas disponibles para mostrar disponibilidad.", "warning");
      }
    } catch (error: any) {
      console.error("ClassroomAvailabilityPage: Error cargando aulas para el selector:", error);
      this.presentToast('Error al cargar la lista de aulas: ' + (error?.message || 'Error desconocido'), 'danger');
    } finally {
      this.isLoadingClassrooms = false;
      this.cdr.detectChanges();
    }
  }

  ngAfterViewInit() {
    console.log("ClassroomAvailabilityPage: ngAfterViewInit - INICIO");
    if (this.calendarEl && this.calendarEl.nativeElement) {
      this.initializeCalendar();
    } else {
      console.warn("ClassroomAvailabilityPage: calendarEl no disponible inmediatamente en ngAfterViewInit, reintentando...");
      setTimeout(() => {
        if (this.calendarEl && this.calendarEl.nativeElement) {
          this.initializeCalendar();
        } else {
          console.error("ClassroomAvailabilityPage: Fallo crítico al encontrar calendarEl después del reintento.");
          this.presentToast("Error al inicializar el calendario.", "danger");
          this.isLoadingCalendar = false;
          this.cdr.detectChanges();
        }
      }, 100);
    }
    console.log("ClassroomAvailabilityPage: ngAfterViewInit - FIN");
  }

  initializeCalendar() {
    console.log("ClassroomAvailabilityPage: initializeCalendar - INICIO. Aula seleccionada actual:", this.selectedClassroomId);
    if (this.calendarApi) {
      console.log("ClassroomAvailabilityPage: El calendario ya está inicializado. Destruyendo para reinicializar.");
      this.calendarApi.destroy();
      this.calendarApi = undefined;
    }
    
    this.isLoadingCalendar = true;
    this.cdr.detectChanges();

    this.calendarOptions = {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      initialView: 'timeGridWeek',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
      },
      locale: esLocale,
      weekends: true,
      editable: this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR,
      selectable: this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR || this.userRole === Rol.PROFESOR,
      selectMirror: true,
      dayMaxEvents: true, 
      events: this.getEventsFunction.bind(this),
      eventClick: this.handleEventClick.bind(this),
      select: this.handleDateSelect.bind(this),
      loading: (isLoading) => console.log("FullCalendar loading state:", isLoading),
      datesSet: (arg) => console.log("FullCalendar datesSet, view:", arg.view.type, "start:", arg.startStr, "end:", arg.endStr),
      allDaySlot: false,
      slotMinTime: "07:00:00",
      slotMaxTime: "22:00:00",
      height: 'auto',
      contentHeight: 'auto',
      nowIndicator: true,
      businessHours: {
        daysOfWeek: [ 1, 2, 3, 4, 5 ], 
        startTime: '08:00',
        endTime: '18:00',
      }
    };

    if (this.calendarEl && this.calendarEl.nativeElement) {
      this.calendarApi = new Calendar(this.calendarEl.nativeElement, this.calendarOptions);
      this.calendarApi.render();
      console.log("ClassroomAvailabilityPage: Calendario renderizado.");
      this.isLoadingCalendar = false;
      this.cdr.detectChanges();
      
      if (this.selectedClassroomId) {
        console.log("ClassroomAvailabilityPage: Aula ya seleccionada después de inicializar calendario, llamando a refetchEvents.");
        this.calendarApi.refetchEvents();
      }
    } else {
      console.error("ClassroomAvailabilityPage: No se pudo inicializar el calendario, calendarEl.nativeElement es nulo en initializeCalendar.");
      this.isLoadingCalendar = false;
      this.cdr.detectChanges();
    }
  }
  
  async onClassroomChange(event: any) {
    const newClassroomId = event.detail.value;
    console.log(`ClassroomAvailabilityPage: onClassroomChange - Nueva aula seleccionada: ${newClassroomId}`);
    
    this.selectedClassroomId = newClassroomId;
    this.currentReservations = []; 

    if (this.selectedClassroomId) {
      if (this.calendarApi) {
        console.log("ClassroomAvailabilityPage: onClassroomChange - Calendar API disponible, llamando a refetchEvents().");
        this.calendarApi.refetchEvents();
      } else {
        console.warn('ClassroomAvailabilityPage: onClassroomChange - Calendar API no disponible. Intentando inicializar.');
        if (this.calendarEl && this.calendarEl.nativeElement) {
            this.initializeCalendar();
        }
      }
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { classroomId: this.selectedClassroomId },
        queryParamsHandling: 'merge',
      });
    } else {
      console.log("ClassroomAvailabilityPage: onClassroomChange - No hay aula seleccionada. Limpiando eventos del calendario.");
      if (this.calendarApi) {
        this.calendarApi.removeAllEvents();
      }
    }
    this.cdr.detectChanges();
  }

  getEventsFunction(fetchInfo: any, successCallback: (events: EventInput[]) => void, failureCallback: (error: any) => void): void {
    console.log("ClassroomAvailabilityPage: getEventsFunction - Llamada. FetchInfo:", fetchInfo);
    if (!this.selectedClassroomId) {
      console.warn("ClassroomAvailabilityPage: getEventsFunction - No hay aula seleccionada, devolviendo array vacío.");
      successCallback([]);
      return;
    }

    const start = fetchInfo.startStr;
    const end = fetchInfo.endStr;
    console.log(`ClassroomAvailabilityPage: getEventsFunction - Cargando reservas para aula ${this.selectedClassroomId} desde ${start} hasta ${end}`);
    
    this.reservationService.getReservationsByClassroomAndDateRange(this.selectedClassroomId, start, end) 
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reservations: Reservation[]) => {
          console.log(`ClassroomAvailabilityPage: getEventsFunction - Reservas recibidas para aula ${this.selectedClassroomId}:`, reservations);
          this.currentReservations = reservations;
          const newEvents = reservations.map(res => ({
            id: res.id,
            title: `${res.purpose || 'Reserva'} (${res.user?.name || 'N/A'})`,
            start: res.startTime,
            end: res.endTime,
            backgroundColor: this.getEventColor(res.status),
            borderColor: this.getEventColor(res.status),
            classNames: res.status === ReservationStatus.PENDIENTE ? ['event-pending'] : [],
            extendedProps: {
              status: res.status,
              userId: res.user?.id,
              userName: res.user?.name,
              userEmail: res.user?.email,
              classroomName: this.allClassrooms.find(c => c.id === res.classroomId)?.name || res.classroom?.name || 'N/A',
              purpose: res.purpose
            }
          }));
          console.log("ClassroomAvailabilityPage: getEventsFunction - Eventos procesados para calendario:", newEvents);
          successCallback(newEvents);
        },
        error: (err: Error | HttpErrorResponse) => {
          console.error(`ClassroomAvailabilityPage: getEventsFunction - Error cargando reservas para aula ${this.selectedClassroomId}:`, err);
          this.presentToast('Error al cargar las reservas: ' + (err.message || 'Error desconocido'), 'danger');
          failureCallback(err);
        }
      });
  }

  async handleEventClick(clickInfo: EventClickArg) {
    console.log("ClassroomAvailabilityPage: handleEventClick - Evento clickeado:", clickInfo.event);
    const event = clickInfo.event;
    const props = event.extendedProps;
    const startTime = event.start ? formatDate(event.start, 'medium', 'es-CO', 'America/Bogota') : 'N/A';
    const endTime = event.end ? formatDate(event.end, 'medium', 'es-CO', 'America/Bogota') : 'N/A';

    let message = `
      <strong>Motivo:</strong> ${props['purpose'] || event.title || 'No especificado'}<br>
      <strong>Inicio:</strong> ${startTime}<br>
      <strong>Fin:</strong> ${endTime}<br>
      <strong>Aula:</strong> ${props['classroomName'] || 'N/A'}<br>
      <strong>Estado:</strong> ${props['status'] ? (props['status'] as string).charAt(0).toUpperCase() + (props['status'] as string).slice(1).toLowerCase() : 'N/A'}<br> 
      <strong>Reservado por:</strong> ${props['userName'] || 'N/A'} (${props['userEmail'] || 'N/A'})
    `;

    const alertButtons: any[] = [ { text: 'Cerrar', role: 'cancel' } ];
    const canModify = this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR || (this.currentUser && this.currentUser.id === props['userId']);
    
    if (canModify && event.id) {
      const reservationId = event.id;
      if (props['status'] !== ReservationStatus.CANCELADA && props['status'] !== ReservationStatus.RECHAZADA) {
        alertButtons.unshift({
          text: 'Cancelar Reserva',
          cssClass: 'alert-button-danger',
          handler: () => this.confirmCancelReservation(reservationId, props['purpose'] || event.title || 'esta reserva')
        });
      }
    }
    
    const alert = await this.alertCtrl.create({
      header: 'Detalles de la Reserva',
      message: message,
      buttons: alertButtons,
      cssClass: 'custom-alert-message'
    });
    await alert.present();
  }
  
  async confirmCancelReservation(reservationId: string, eventName: string) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Cancelación',
      message: `¿Estás seguro de que quieres cancelar la reserva para "${eventName}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Sí, Cancelar',
          cssClass: 'alert-button-danger',
          handler: async () => {
            const loading = await this.loadingCtrl.create({ message: 'Cancelando reserva...' });
            await loading.present();
            this.reservationService.cancelMyReservation(reservationId).pipe( 
              takeUntil(this.destroy$),
              finalize(() => loading.dismiss()) 
            ).subscribe({
              next: () => {
                this.presentToast('Reserva cancelada exitosamente.', 'success');
                if (this.calendarApi) this.calendarApi.refetchEvents();
              },
              error: (err: Error | HttpErrorResponse | any) => this.presentToast('Error al cancelar la reserva: ' + (err.message || 'Error desconocido'), 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async handleDateSelect(selectInfo: DateSelectArg) {
    console.log("ClassroomAvailabilityPage: handleDateSelect - Rango seleccionado:", selectInfo);
    if (!this.selectedClassroomId) {
      this.presentToast("Por favor, selecciona un aula primero.", "warning");
      selectInfo.view.calendar.unselect();
      return;
    }
    if (this.userRole !== Rol.ADMIN && this.userRole !== Rol.COORDINADOR && this.userRole !== Rol.PROFESOR) {
      this.presentToast("No tienes permisos para crear reservas.", "warning");
      selectInfo.view.calendar.unselect();
      return;
    }

    this.router.navigate(['/app/reservations/new'], {
      queryParams: {
        classroomId: this.selectedClassroomId,
        startTime: selectInfo.startStr,
        endTime: selectInfo.endStr,
        allDay: selectInfo.allDay.toString()
      }
    });
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

  async presentToast(message: string, color: 'success' | 'danger' | 'warning' | 'medium') {
    const toast = await this.toastCtrl.create({ message, duration: 3500, color, position: 'top', buttons: [{ text: 'OK', role: 'cancel'}] });
    toast.present();
  }

  ngOnDestroy() {
    console.log("ClassroomAvailabilityPage: ngOnDestroy - INICIO");
    this.destroy$.next();
    this.destroy$.complete();
    if (this.calendarApi) {
      this.calendarApi.destroy();
      console.log("ClassroomAvailabilityPage: Calendario destruido.");
      this.calendarApi = undefined;
    }
    console.log("ClassroomAvailabilityPage: ngOnDestroy - FIN");
  }
}