import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {LoadingController, ToastController, NavController, AlertController } from '@ionic/angular/standalone';
import { CommonModule, formatDate, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Subject, forkJoin, of, combineLatest } from 'rxjs';
import { takeUntil, catchError, tap, take, finalize, map, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { ClassroomService } from '../../../services/classroom.service';
import { ReservationService, ReservationListFilters } from '../../../services/reservation.service';
import { AuthService } from '../../../services/auth.service';
import { Classroom } from '../../../models/classroom.model';
import { Reservation, ReservationStatus } from '../../../models/reservation.model';
import { User } from '../../../models/user.model';
import { Rol } from '../../../models/rol.model';
import { HttpErrorResponse } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';

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
  ],
  providers: [DatePipe]
})
export class ClassroomAvailabilityPage implements OnInit, OnDestroy {


  private destroy$ = new Subject<void>();

  allClassrooms: Classroom[] = [];
  selectedClassroomId: string | null = null;
  currentUser: User | null = null;
  userRole: Rol | null = null;

  isLoadingClassrooms = true;
  isLoadingTimes = false; 
  existingReservationsForDay: Reservation[] = [];
  
  public RolEnum = Rol;
  public ReservationStatusEnum = ReservationStatus;


  selectedDateForTimeSlots: string = ''; 
  minDate: string;
  maxDate: string; 
  availableStartTimes: { value: string, display: string }[] = [];
  readonly SLOT_DURATION_MINUTES = 45;

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
    private cdr: ChangeDetectorRef,
    public datePipe: DatePipe
  ) {
    const today = new Date();
    this.minDate = formatDate(today, 'yyyy-MM-dd', 'en-US'); 
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(today.getFullYear() + 1);
    this.maxDate = formatDate(oneYearFromNow, 'yyyy-MM-dd', 'en-US'); 
  }

  ngOnInit() {
    this.authService.currentUser.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUser = user;
      this.userRole = user?.role || null;
    });

    this.loadInitialData();
  }

  async loadInitialData() {
    this.isLoadingClassrooms = true;
    this.cdr.detectChanges();

    try {
      this.allClassrooms = await firstValueFrom(this.classroomService.getAllClassrooms().pipe(takeUntil(this.destroy$)));

      const params = await firstValueFrom(this.route.queryParams.pipe(take(1)));
      const classroomIdFromParams = params['classroomId'];

      if (classroomIdFromParams && this.allClassrooms.some(c => c.id === classroomIdFromParams)) {
        this.selectedClassroomId = classroomIdFromParams;
      } else if (this.allClassrooms.length > 0) {
        
      } else {
        this.presentToast("No hay aulas disponibles para mostrar disponibilidad.", "warning");
      }

     
      const dateFromParams = this.route.snapshot.queryParamMap.get('date');
      if (dateFromParams) {
        this.selectedDateForTimeSlots = dateFromParams;
      } else {
        
        this.selectedDateForTimeSlots = formatDate(new Date(), 'yyyy-MM-dd', 'en-US');
      }

    
      if (this.selectedClassroomId && this.selectedDateForTimeSlots) {
        this.loadAvailabilityData(this.selectedClassroomId, this.selectedDateForTimeSlots);
      }

    } catch (error: any) {
      this.presentToast('Error al cargar la lista de aulas: ' + (error?.message || 'Error desconocido'), 'danger');
    } finally {
      this.isLoadingClassrooms = false;
      this.cdr.detectChanges();
    }
  }

  

  async onClassroomChange(event: any) {
    const newClassroomId = event.detail.value;
    this.selectedClassroomId = newClassroomId;
    this.existingReservationsForDay = []; 
    this.availableStartTimes = [];

    if (this.selectedClassroomId && this.selectedDateForTimeSlots) {
      await this.loadAvailabilityData(this.selectedClassroomId, this.selectedDateForTimeSlots);
    } else {
      this.router.navigate([], { 
        relativeTo: this.route,
        queryParams: { classroomId: this.selectedClassroomId },
        queryParamsHandling: 'merge',
      });
    }
    this.cdr.detectChanges();
  }

  async onDateChange(event: any) {
    const newDateISO = event.detail.value;
    if (newDateISO) {
      this.selectedDateForTimeSlots = formatDate(new Date(newDateISO), 'yyyy-MM-dd', 'en-US');
      if (this.selectedClassroomId && this.selectedDateForTimeSlots) {
        await this.loadAvailabilityData(this.selectedClassroomId, this.selectedDateForTimeSlots);
      }
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { date: this.selectedDateForTimeSlots },
        queryParamsHandling: 'merge',
      });
    }
    this.cdr.detectChanges();
  }

  async loadAvailabilityData(classroomId: string, dateISO: string) {
    this.isLoadingTimes = true;
    this.existingReservationsForDay = [];
    this.availableStartTimes = [];
    this.cdr.detectChanges();

    const dayStartUTC = `${dateISO}T00:00:00.000Z`;
    const dayEndUTC = `${dateISO}T23:59:59.999Z`;

    try {
      const reservations = await firstValueFrom(
        this.reservationService.getReservationsByClassroomAndDateRange(classroomId, dayStartUTC, dayEndUTC)
          .pipe(takeUntil(this.destroy$))
      );
      this.existingReservationsForDay = reservations.filter(r => 
        r.status === ReservationStatus.CONFIRMADA || r.status === ReservationStatus.PENDIENTE
      );
      this.generateAvailableTimeSlots();
    } catch (err: any) {
      this.presentToast('Error al cargar reservas para la fecha seleccionada: ' + (err.message || 'Error desconocido'), 'danger');
      this.existingReservationsForDay = [];
      this.availableStartTimes = [];
    } finally {
      this.isLoadingTimes = false;
      this.cdr.detectChanges();
    }
  }

  generateAvailableTimeSlots() {
    this.availableStartTimes = [];
    if (!this.selectedClassroomId || !this.selectedDateForTimeSlots) {
      return;
    }

    const slots: { value: string, display: string }[] = [];
    const openingHour = 7; 
    let dayClosingHour = 22; 
    const dateParts = this.selectedDateForTimeSlots.split('-').map(Number);
    const localYear = dateParts[0];
    const localMonth = dateParts[1] - 1; 
    const localDay = dateParts[2];
    
    
    const selectedDateObjectForDayCheck = new Date(localYear, localMonth, localDay);
    const dayOfWeek = selectedDateObjectForDayCheck.getDay(); 

    if (dayOfWeek === 0) { 
        this.availableStartTimes = []; 
        this.presentToast("Los domingos no son días hábiles para reservas.", "warning");
        return; 
    } else if (dayOfWeek === 6) { 
        dayClosingHour = 12; 
    }

    const now = new Date();
    const todayLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedDateLocalMidnight = new Date(localYear, localMonth, localDay);
    const isSelectedDateToday = selectedDateLocalMidnight.getTime() === todayLocalMidnight.getTime();

    for (let hour = openingHour; hour < dayClosingHour; hour++) {
      for (let minute = 0; minute < 60; minute += this.SLOT_DURATION_MINUTES) {
        const slotStartLocalTime = new Date(localYear, localMonth, localDay, hour, minute);
        
       
        if (isSelectedDateToday && slotStartLocalTime.getTime() < now.getTime()) {
          continue;
        }

        const potentialSlotEndLocalTime = new Date(slotStartLocalTime.getTime() + this.SLOT_DURATION_MINUTES * 60 * 1000);
        
        
        if (potentialSlotEndLocalTime.getFullYear() > localYear ||
            potentialSlotEndLocalTime.getMonth() > localMonth ||
            potentialSlotEndLocalTime.getDate() > localDay ||
            (potentialSlotEndLocalTime.getHours() > dayClosingHour) ||
            (potentialSlotEndLocalTime.getHours() === dayClosingHour && potentialSlotEndLocalTime.getMinutes() > 0 && dayOfWeek !== 6)) { // Ajuste para el sábado
          continue;
        }
        
        if (dayOfWeek === 6 && potentialSlotEndLocalTime.getHours() >= 12 && potentialSlotEndLocalTime.getMinutes() > 0) {
            continue; 
        }


        let isThisIndividualSlotAvailable = true;
        if (this.existingReservationsForDay) {
          for (const res of this.existingReservationsForDay) {
            const resStartTime = new Date(res.startTime).getTime();
            const resEndTime = new Date(res.endTime).getTime();
            const slotStartTimeForComparison = slotStartLocalTime.getTime();
            const slotEndTimeForComparison = potentialSlotEndLocalTime.getTime();
            
            
            if (slotStartTimeForComparison < resEndTime && slotEndTimeForComparison > resStartTime) {
              isThisIndividualSlotAvailable = false;
              break;
            }
          }
        }
        if (isThisIndividualSlotAvailable) {
          slots.push({
            value: slotStartLocalTime.toISOString(), 
            display: this.datePipe.transform(slotStartLocalTime, 'h:mm a', 'America/Bogota') || '' // Formato de hora am/pm
          });
        }
      }
    }
    this.availableStartTimes = slots;
    this.cdr.detectChanges();
  }

  async handleSlotSelect(startTimeISO: string) {
    if (!this.selectedClassroomId) {
      this.presentToast("Por favor, selecciona un aula primero.", "warning");
      return;
    }
    if (this.userRole !== Rol.ADMIN && this.userRole !== Rol.COORDINADOR && this.userRole !== Rol.PROFESOR && this.userRole !== Rol.ESTUDIANTE && this.userRole !== Rol.TUTOR) {
      this.presentToast("No tienes permisos para crear reservas.", "warning");
      return;
    }

    const selectedStartTime = new Date(startTimeISO);
    const endTime = new Date(selectedStartTime.getTime() + this.SLOT_DURATION_MINUTES * 60 * 1000); // Asume 1 bloque

    this.router.navigate(['/app/reservations/new'], {
      queryParams: {
        classroomId: this.selectedClassroomId,
        startTime: selectedStartTime.toISOString(),
        endTime: endTime.toISOString(),
        allDay: 'false' 
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

  async presentToast(message: string, color: 'success' | 'danger' | 'warning' | 'medium', duration: number = 3500) {
    const toast = await this.toastCtrl.create({ message, duration, color, position: 'top', buttons: [{ text: 'OK', role: 'cancel'}] });
    toast.present();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}