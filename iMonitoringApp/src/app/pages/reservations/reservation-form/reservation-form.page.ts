import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LoadingController, NavController, ToastController, AlertController } from '@ionic/angular/standalone';
import { CommonModule, DatePipe } from '@angular/common';
import { ReservationService } from '../../../services/reservation.service';
import { ClassroomService } from '../../../services/classroom.service';
import { UserService } from '../../../services/user.service';
import { AuthService, AuthData } from '../../../services/auth.service';
import { Classroom } from '../../../models/classroom.model';
import { User } from '../../../models/user.model';
import { Rol } from '../../../models/rol.model';
import { Reservation, ReservationCreationData, ReservationStatus } from '../../../models/reservation.model';
import { Observable, Subject, forkJoin, of, firstValueFrom } from 'rxjs'; 
import { takeUntil, finalize, catchError, tap, map, startWith, take, filter } from 'rxjs/operators'; // Added filter
import { HttpErrorResponse } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-reservation-form',
  templateUrl: './reservation-form.page.html',
  styleUrls: ['./reservation-form.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule, RouterModule],
  providers: [DatePipe]
})
export class ReservationFormPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  reservationForm!: FormGroup;
  isEditMode = false;
  reservationId: string | null = null;
  pageTitle = 'Nueva Reserva';
  classrooms: Classroom[] = [];
  usersForSelect: User[] = [];
  currentUser: User | null = null;
  userRole: Rol | null = null;
  isLoading = false;
  isLoadingInitialData = true;
  minDatetime: string;
  maxDatetime: string;

  public RolEnum = Rol;
  public ReservationStatusEnum = ReservationStatus;

  public assignableUsers: User[] = [];
  public selectableDates: { value: string, display: string }[] = [];
  public availableStartTimes: { value: string, display: string }[] = [];
  public isLoadingTimes: boolean = false; 
  public availableDurations: { value: number, display: string }[] = [];


  constructor(
    private fb: FormBuilder,
    private reservationService: ReservationService,
    private classroomService: ClassroomService,
    private userService: UserService,
    public authService: AuthService, 
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
    const oneYearFromNow = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    this.minDatetime = today.toISOString();
    this.maxDatetime = oneYearFromNow.toISOString();

    this.availableDurations = [
      { value: 1, display: '45 minutos' },
      { value: 2, display: '1 hora 30 minutos' },
      { value: 3, display: '2 horas 15 minutos' },
      { value: 4, display: '3 horas' },
    ];
  }

  ngOnInit() {
    this.isLoadingInitialData = true;
    this.cdr.detectChanges();

    this.reservationForm = this.fb.group({
      purpose: ['', [Validators.required, Validators.minLength(5)]],
      classroomId: [null, Validators.required],
      reservationDateControl: ['', Validators.required], 
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      durationBlocks: [1, [Validators.required, Validators.min(1)]],
      userId: [null],
      status: [ReservationStatus.PENDIENTE]
    });

    this.setupDateAndTimeListeners();
    this.loadInitialFormData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupDateAndTimeListeners() {
    this.reservationForm.get('classroomId')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      tap(() => {
        this.reservationForm.get('reservationDateControl')?.setValue(null, { emitEvent: false });
        this.reservationForm.get('startTime')?.setValue(null, { emitEvent: false });
        this.reservationForm.get('endTime')?.setValue(null, { emitEvent: false });
        this.availableStartTimes = [];
        this.selectableDates = this.generateSelectableDates();
      })
    ).subscribe();

    this.reservationForm.get('reservationDateControl')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      filter((date: string) => !!date && !!this.reservationForm.get('classroomId')?.value),
      tap(() => {
        this.reservationForm.get('startTime')?.setValue(null, { emitEvent: false });
        this.reservationForm.get('endTime')?.setValue(null, { emitEvent: false });
        this.generateAvailableTimeSlots();
      })
    ).subscribe();

    this.reservationForm.get('startTime')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      tap(startTime => {
        if (startTime && this.reservationForm.get('durationBlocks')?.value) {
          this.calculateEndTime();
        } else {
          this.reservationForm.get('endTime')?.setValue(null);
        }
      })
    ).subscribe();

    this.reservationForm.get('durationBlocks')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      filter((duration: number) => !!duration && !!this.reservationForm.get('startTime')?.value), // Explicitly typed 'duration'
      tap(() => {
        this.calculateEndTime();
      })
    ).subscribe();
  }


  generateSelectableDates(): { value: string, display: string }[] {
    const dates: { value: string, display: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) { 
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const dayOfWeek = date.getDay(); 

      if (dayOfWeek === 0) {
        continue;
      }

      dates.push({
        value: date.toISOString().split('T')[0], 
        display: this.datePipe.transform(date, 'fullDate', undefined, 'es-CO') || date.toDateString()
      });
    }
    return dates;
  }

  async generateAvailableTimeSlots() {
    const classroomId = this.reservationForm.get('classroomId')?.value;
    const dateISO = this.reservationForm.get('reservationDateControl')?.value;

    if (!classroomId || !dateISO) {
      this.availableStartTimes = [];
      return;
    }

    this.isLoadingTimes = true;
    this.availableStartTimes = [];
    this.cdr.detectChanges();

    const dayStart = new Date(dateISO + 'T00:00:00Z');
    const dayEnd = new Date(dateISO + 'T23:59:59Z');

    try {
      const reservationsForDay = await firstValueFrom(
        this.reservationService.getReservationsByClassroomAndDateRange(classroomId, dayStart.toISOString(), dayEnd.toISOString())
          .pipe(takeUntil(this.destroy$))
      );

      const occupiedSlots: { start: Date, end: Date }[] = reservationsForDay
        .filter((res: Reservation) => res.status === ReservationStatus.CONFIRMADA || res.status === ReservationStatus.PENDIENTE) // Explicitly typed 'res'
        .map((res: Reservation) => ({ 
          start: new Date(res.startTime),
          end: new Date(res.endTime)
        }));

      const slots: { value: string, display: string }[] = [];
      const currentMoment = new Date();
      const today = currentMoment.toISOString().split('T')[0];
      const isSelectedDateToday = dateISO === today;

      const openingHour = 7; 
      let closingHour = 22; 

      const selectedDateObj = new Date(dateISO);
      if (selectedDateObj.getDay() === 6) { 
        closingHour = 12; 
      }

      for (let hour = openingHour; hour < closingHour; hour++) {
        for (let minute = 0; minute < 60; minute += 15) { 
          const potentialSlotStart = new Date(dateISO);
          potentialSlotStart.setHours(hour, minute, 0, 0);

          if (isSelectedDateToday && potentialSlotStart.getTime() < currentMoment.getTime()) {
            continue;
          }

          const potentialSlotEnd = new Date(potentialSlotStart.getTime() + 15 * 60 * 1000); // Check for 15 minute block


          if (potentialSlotEnd.getHours() > closingHour || (potentialSlotEnd.getHours() === closingHour && potentialSlotEnd.getMinutes() > 0)) {
            continue;
          }

          let isAvailable = true;
          for (const occupied of occupiedSlots) {

            if (potentialSlotStart.getTime() < occupied.end.getTime() && potentialSlotEnd.getTime() > occupied.start.getTime()) {
              isAvailable = false;
              break;
            }
          }

          if (isAvailable) {
            slots.push({
              value: potentialSlotStart.toISOString(),
              display: this.datePipe.transform(potentialSlotStart, 'shortTime', 'America/Bogota', 'es-CO') || ''
            });
          }
        }
      }
      this.availableStartTimes = slots;
    } catch (error) {
      console.error('Error generating available time slots:', error);
      this.presentToast('Error al cargar horarios disponibles.', 'danger');
      this.availableStartTimes = [];
    } finally {
      this.isLoadingTimes = false;
      this.cdr.detectChanges();
    }
  }

  calculateEndTime() {
    const startTimeISO = this.reservationForm.get('startTime')?.value;
    const durationBlocks = this.reservationForm.get('durationBlocks')?.value;

    if (startTimeISO && durationBlocks) {
      const startTime = new Date(startTimeISO);
      const endTime = new Date(startTime.getTime() + durationBlocks * 45 * 60 * 1000);
      this.reservationForm.get('endTime')?.setValue(endTime.toISOString());
    } else {
      this.reservationForm.get('endTime')?.setValue(null);
    }
  }

  loadInitialFormData() {
    this.isLoadingInitialData = true;
    this.cdr.detectChanges();

    const observables: { [key: string]: Observable<any> } = {
      currentUserData: this.authService.getCurrentUserWithRole().pipe(take(1)),
      classroomsData: this.classroomService.getAllClassrooms().pipe(catchError(() => of([] as Classroom[])))
    };

    forkJoin(observables).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoadingInitialData = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (results: any) => {
        const authData = results.currentUserData as AuthData | null;
        if (authData?.user && authData?.role) {
          this.currentUser = authData.user;
          this.userRole = authData.role;
        } else {
          this.presentToast('No se pudo obtener la información del usuario.', 'danger');
          this.navCtrl.navigateRoot('/login');
          return;
        }

        this.classrooms = results.classroomsData || [];
        this.selectableDates = this.generateSelectableDates();

        this.configureFormBasedOnRoleAndMode();

        this.reservationId = this.route.snapshot.paramMap.get('id');
        if (this.reservationId) {
          this.isEditMode = true;
          this.pageTitle = 'Editar Reserva';
          this.loadReservationData(this.reservationId);
        } else {
          this.pageTitle = 'Nueva Reserva';
          if (this.userRole && ![Rol.ADMIN, Rol.COORDINADOR].includes(this.userRole)) {
            this.reservationForm.get('userId')?.disable({ emitEvent: false });
          }
        }

        const queryClassroomId = this.route.snapshot.queryParamMap.get('classroomId');
        const queryStartTime = this.route.snapshot.queryParamMap.get('startTime');
        const queryEndTime = this.route.snapshot.queryParamMap.get('endTime');

        if (queryClassroomId && queryStartTime && queryEndTime) {
          const startTimeDate = new Date(queryStartTime);
          const dateOnly = startTimeDate.toISOString().split('T')[0];
          const duration = Math.round((new Date(queryEndTime).getTime() - startTimeDate.getTime()) / (45 * 60 * 1000));

          this.reservationForm.patchValue({
            classroomId: queryClassroomId,
            reservationDateControl: dateOnly,
            startTime: queryStartTime,
            durationBlocks: duration > 0 ? duration : 1, 
            endTime: queryEndTime,
          });
         
          this.generateAvailableTimeSlots();
        }
      },
      error: (err: Error) => {
        this.presentToast(`Error cargando datos iniciales: ${err.message}`, 'danger');
      }
    });
  }

  configureFormBasedOnRoleAndMode() {
    const userIdControl = this.reservationForm.get('userId');
    const statusControl = this.reservationForm.get('status');

    if (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) {
      userIdControl?.enable({ emitEvent: false });
      statusControl?.enable({ emitEvent: false });
      if (this.userRole === Rol.ADMIN) {
         this.loadUsersForSelect([Rol.ADMIN, Rol.COORDINADOR, Rol.PROFESOR, Rol.ESTUDIANTE, Rol.TUTOR]);
      } else {
         this.loadUsersForSelect([Rol.PROFESOR, Rol.ESTUDIANTE, Rol.TUTOR]);
      }
    } else {
      userIdControl?.disable({ emitEvent: false });
      userIdControl?.patchValue(this.currentUser?.id, { emitEvent: false });
      statusControl?.disable({ emitEvent: false });
    }
  }

  loadUsersForSelect(roles: Rol[]) {
    this.userService.getAllUsers().pipe(takeUntil(this.destroy$)).subscribe(users => {
      this.assignableUsers = users.filter(user => user.role && roles.includes(user.role));
      this.cdr.detectChanges();
    });
  }

  async loadReservationData(id: string) {
    this.isLoading = true;
    this.cdr.detectChanges();
    const loading = await this.loadingCtrl.create({ message: 'Cargando reserva...' });
    await loading.present();

    this.reservationService.getReservationById(id).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        await loading.dismiss();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (reservation: Reservation) => {
        if (!this.canEditThisReservation(reservation)) {
          this.presentToast('No tienes permiso para editar esta reserva.', 'danger');
          this.navCtrl.navigateBack('/app/reservations/my-list');
          return;
        }

        const startTimeDate = new Date(reservation.startTime);
        const dateOnly = startTimeDate.toISOString().split('T')[0];
        const durationBlocks = Math.round((new Date(reservation.endTime).getTime() - startTimeDate.getTime()) / (45 * 60 * 1000));

        this.reservationForm.patchValue({
          purpose: reservation.purpose,
          classroomId: reservation.classroom?.id,
          reservationDateControl: dateOnly,
          startTime: reservation.startTime,
          endTime: reservation.endTime,
          durationBlocks: durationBlocks,
          userId: reservation.user?.id,
          status: reservation.status
        });
        if (this.userRole && ![Rol.ADMIN, Rol.COORDINADOR].includes(this.userRole)) {
          this.reservationForm.get('userId')?.disable({ emitEvent: false });
          if(this.userRole !== Rol.ADMIN) {
             this.reservationForm.get('status')?.disable({ emitEvent: false });
          }
        }
        this.generateAvailableTimeSlots();
        this.cdr.detectChanges();
      },
      error: async (err: Error) => {
        await this.presentToast(err.message || 'Error al cargar la reserva.', 'danger');
        this.navCtrl.navigateBack('/app/reservations/my-list');
      }
    });
  }

  canEditThisReservation(reservation: Reservation): boolean {
    if (!this.currentUser || !this.userRole) return false;
    if (this.userRole === Rol.ADMIN) return true;
    if (this.currentUser.id === reservation.user?.id &&
        (reservation.status === ReservationStatus.PENDIENTE || reservation.status === ReservationStatus.CONFIRMADA)) {
        return true;
    }
    if (this.userRole === Rol.COORDINADOR &&
        reservation.user?.role === Rol.ESTUDIANTE &&
        (reservation.status === ReservationStatus.PENDIENTE || reservation.status === ReservationStatus.CONFIRMADA)){
        return true;
    }
    return false;
  }


  async onSubmit() {
    if (this.reservationForm.invalid) {
      this.markFormGroupTouched(this.reservationForm);
      await this.presentToast('Por favor, completa todos los campos requeridos.', 'warning');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();
    const loadingSubmit = await this.loadingCtrl.create({
      message: this.isEditMode ? 'Actualizando reserva...' : 'Creando reserva...'
    });
    await loadingSubmit.present();

    const formValue = this.reservationForm.getRawValue();


    const startTimeISO = new Date(formValue.startTime).toISOString();
    const endTimeISO = new Date(formValue.endTime).toISOString();


    const reservationData: ReservationCreationData = {
      purpose: formValue.purpose,
      classroomId: formValue.classroomId,
      startTime: startTimeISO,
      endTime: endTimeISO,
      userId: (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) ? formValue.userId : this.currentUser?.id,
      status: (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) ? formValue.status : ReservationStatus.PENDIENTE
    };

    if (!(this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) && this.isEditMode) {

        delete reservationData.userId;
        delete reservationData.status;
    }


    let operation: Observable<Reservation>;

    if (this.isEditMode && this.reservationId) {
      operation = this.reservationService.updateReservation(this.reservationId, reservationData);
    } else {
      operation = this.reservationService.createReservation(reservationData);
    }

    operation.pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        await loadingSubmit.dismiss();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: async () => {
        await this.presentToast(`Reserva ${this.isEditMode ? 'actualizada' : 'creada'} correctamente.`, 'success');
        this.navCtrl.navigateBack('/app/reservations/my-list', { queryParams: { segment: 'my-reservations' } });
      },
      error: async (err: HttpErrorResponse | Error) => {
        const message = (err instanceof HttpErrorResponse) ? err.error?.message || err.message : err.message;
        await this.presentToast(message || 'Error al guardar la reserva.', 'danger');
      }
    });
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
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

  cancel() {
    this.navCtrl.navigateBack('/app/reservations/my-list');
  }
}