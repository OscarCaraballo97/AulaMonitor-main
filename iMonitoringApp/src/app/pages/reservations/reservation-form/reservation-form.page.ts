import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LoadingController, NavController, ToastController, AlertController } from '@ionic/angular/standalone';
import { CommonModule, DatePipe, formatDate } from '@angular/common';
import { ReservationService } from '../../../services/reservation.service';
import { ClassroomService } from '../../../services/classroom.service';
import { UserService } from '../../../services/user.service';
import { AuthService, AuthData } from '../../../services/auth.service';
import { Classroom } from '../../../models/classroom.model';
import { User } from '../../../models/user.model';
import { Rol } from '../../../models/rol.model';
import { Reservation, ReservationCreationData, ReservationStatus } from '../../../models/reservation.model';
import { Observable, Subject, forkJoin, of, firstValueFrom } from 'rxjs';
import { takeUntil, finalize, catchError, tap, map, startWith, take, filter } from 'rxjs/operators';
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
    console.log("ReservationFormPage: ngOnInit - START");
    this.isLoadingInitialData = true;
    this.cdr.detectChanges();

    this.reservationForm = this.fb.group({
      purpose: ['', [Validators.required, Validators.minLength(5)]],
      classroomId: [null, Validators.required],
      reservationDateControl: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: [{ value: null, disabled: true }, Validators.required],
      durationBlocks: [1, [Validators.required, Validators.min(1)]],
      userId: [null],
      status: [ReservationStatus.PENDIENTE]
    });

    this.setupDateAndTimeListeners();
    this.loadInitialFormData();
    console.log("ReservationFormPage: ngOnInit - END");
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupDateAndTimeListeners() {
    this.reservationForm.get('classroomId')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      tap(() => {
        console.log("Classroom changed. Resetting date/time controls.");
        this.reservationForm.get('reservationDateControl')?.setValue(null, { emitEvent: false });
        this.reservationForm.get('startTime')?.setValue(null, { emitEvent: false });
        this.reservationForm.get('endTime')?.setValue(null, { emitEvent: false });
        this.availableStartTimes = [];
        this.selectableDates = this.generateSelectableDates();
        this.cdr.detectChanges();
      })
    ).subscribe();

    this.reservationForm.get('reservationDateControl')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      filter((date: string | null) => !!date && !!this.reservationForm.get('classroomId')?.value),
      tap(() => {
        console.log("Reservation date changed. Regenerating start times.");
        this.reservationForm.get('startTime')?.setValue(null, { emitEvent: false });
        this.reservationForm.get('endTime')?.setValue(null, { emitEvent: false });
        this.generateAvailableTimeSlots();
        this.cdr.detectChanges();
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
        this.cdr.detectChanges();
      })
    ).subscribe();

    this.reservationForm.get('durationBlocks')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      filter((duration: number | null) => !!duration && !!this.reservationForm.get('startTime')?.value),
      tap(() => {
        console.log("Duration changed. Recalculating end time.");
        this.calculateEndTime();
        this.cdr.detectChanges();
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
        value: formatDate(date, 'yyyy-MM-dd', 'en-US'),
        display: this.datePipe.transform(date, 'fullDate', undefined, 'es-CO') || date.toDateString()
      });
    }
    console.log("Generated selectable dates:", dates.length);
    return dates;
  }

  async generateAvailableTimeSlots() {
    const classroomId = this.reservationForm.get('classroomId')?.value;
    const dateISO = this.reservationForm.get('reservationDateControl')?.value;

    if (!classroomId || !dateISO) {
      this.availableStartTimes = [];
      console.log("Cannot generate time slots: classroomId or dateISO missing.");
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingTimes = true;
    this.availableStartTimes = [];
    this.cdr.detectChanges();


    const selectedDateLocal = new Date(dateISO);
    selectedDateLocal.setHours(0, 0, 0, 0);

    const dayStartISO = selectedDateLocal.toISOString();
    const dayEnd = new Date(selectedDateLocal);
    dayEnd.setHours(23, 59, 59, 999);
    const dayEndISO = dayEnd.toISOString();

    console.log(`Fetching reservations for classroom ${classroomId} on date ${dateISO} (UTC range: ${dayStartISO} to ${dayEndISO})`);

    try {
      const reservationsForDay = await firstValueFrom(
        this.reservationService.getReservationsByClassroomAndDateRange(classroomId, dayStartISO, dayEndISO)
          .pipe(takeUntil(this.destroy$))
      );
      console.log("Reservations for the day fetched:", reservationsForDay);

      const occupiedSlots: { start: Date, end: Date }[] = reservationsForDay
        .filter((res: Reservation) => res.status === ReservationStatus.PENDIENTE || res.status === ReservationStatus.CONFIRMADA)
        .map((res: Reservation) => ({
         
          start: new Date(res.startTime),
          end: new Date(res.endTime)
        }));
      console.log("Occupied slots (converted to local Dates):", occupiedSlots);

      const slots: { value: string, display: string }[] = [];
      const currentMoment = new Date();
      const todayLocalMidnight = new Date();
      todayLocalMidnight.setHours(0, 0, 0, 0);

      const isSelectedDateToday = selectedDateLocal.getTime() === todayLocalMidnight.getTime();

      const openingHour = 7;
      let closingHour = 22;

      const dayOfWeek = selectedDateLocal.getDay();
      if (dayOfWeek === 6) {
        closingHour = 12;
      }

      for (let hour = openingHour; hour < closingHour; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const potentialSlotStart = new Date(selectedDateLocal);
          potentialSlotStart.setHours(hour, minute, 0, 0);


          if (isSelectedDateToday && potentialSlotStart.getTime() < currentMoment.getTime()) {
            continue;
          }

          const potentialSlotEnd = new Date(potentialSlotStart.getTime() + this.availableDurations[0].value * 45 * 60 * 1000);
         
          if (potentialSlotEnd.getHours() > closingHour || (potentialSlotEnd.getHours() === closingHour && potentialSlotEnd.getMinutes() > 0)) {
              continue;
          }


          let isAvailable = true;
          for (const occupied of occupiedSlots) {

            const occupiedStartLocal = occupied.start;
            const occupiedEndLocal = occupied.end;

            if (potentialSlotStart.getTime() < occupiedEndLocal.getTime() && potentialSlotEnd.getTime() > occupiedStartLocal.getTime()) {
              isAvailable = false;
              console.log(`Overlap detected for ${this.datePipe.transform(potentialSlotStart, 'shortTime', 'America/Bogota', 'es-CO')} - ${this.datePipe.transform(potentialSlotEnd, 'shortTime', 'America/Bogota', 'es-CO')} with existing: ${this.datePipe.transform(occupiedStartLocal, 'shortTime', 'America/Bogota', 'es-CO')} - ${this.datePipe.transform(occupiedEndLocal, 'shortTime', 'America/Bogota', 'es-CO')}`);
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
      console.log("Generated available start times:", this.availableStartTimes.length, "slots.", this.availableStartTimes);
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
      console.log(`Calculated endTime: ${this.datePipe.transform(endTime, 'shortTime', 'America/Bogota', 'es-CO')} for startTime: ${this.datePipe.transform(startTime, 'shortTime', 'America/Bogota', 'es-CO')} and duration: ${durationBlocks} blocks`);
    } else {
      this.reservationForm.get('endTime')?.setValue(null);
      console.log("Cannot calculate endTime: startTime or durationBlocks missing.");
    }
  }

  async loadInitialFormData() {
    this.isLoadingInitialData = true;
    this.cdr.detectChanges();

    const observables: { [key: string]: Observable<any> } = {
      currentUserData: this.authService.getCurrentUserWithRole().pipe(take(1)),
      classroomsData: this.classroomService.getAllClassrooms().pipe(
        catchError((err) => {
          console.error("Error loading classrooms:", err);
          this.presentToast('Error al cargar aulas.', 'danger');
          return of([] as Classroom[]);
        })
      )
    };

    forkJoin(observables).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoadingInitialData = false;
        console.log("ReservationFormPage: loadInitialFormData - FINALIZE. isLoadingInitialData:", this.isLoadingInitialData);
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: async (results: any) => {
        const authData = results.currentUserData as AuthData | null;
        if (authData?.user && authData?.role) {
          this.currentUser = authData.user;
          this.userRole = authData.role;
          console.log("Current user:", this.currentUser);
          console.log("Current user role:", this.userRole);
        } else {
          this.presentToast('No se pudo obtener la información del usuario. Redirigiendo a login.', 'danger');
          this.navCtrl.navigateRoot('/login');
          return;
        }

        this.classrooms = results.classroomsData || [];
        console.log("Loaded classrooms:", this.classrooms.length, this.classrooms);
        if (this.classrooms.length === 0) {
          this.presentToast('No se encontraron aulas disponibles.', 'warning');
        }

        this.selectableDates = this.generateSelectableDates();


        this.configureFormBasedOnRoleAndMode();

        this.reservationId = this.route.snapshot.paramMap.get('id');
        if (this.reservationId) {
          this.isEditMode = true;
          this.pageTitle = 'Editar Reserva';
          console.log("Edit mode detected. Loading reservation data for ID:", this.reservationId);
          await this.loadReservationData(this.reservationId);
        } else {
          this.pageTitle = 'Nueva Reserva';
          console.log("New reservation mode.");
        }

        const queryClassroomId = this.route.snapshot.queryParamMap.get('classroomId');
        const queryStartTime = this.route.snapshot.queryParamMap.get('startTime');
        const queryEndTime = this.route.snapshot.queryParamMap.get('endTime');

        if (queryClassroomId && queryStartTime && queryEndTime) {
          console.log("Query parameters found. Patching form values. Classroom ID:", queryClassroomId, "Start:", queryStartTime, "End:", queryEndTime);
          const startTimeDate = new Date(queryStartTime);
          const dateOnly = formatDate(startTimeDate, 'yyyy-MM-dd', 'en-US');
          const duration = Math.round((new Date(queryEndTime).getTime() - startTimeDate.getTime()) / (45 * 60 * 1000));

          this.reservationForm.patchValue({
            classroomId: queryClassroomId,
            reservationDateControl: dateOnly,
            startTime: queryStartTime,
            durationBlocks: duration > 0 ? duration : 1,
            
          });
          if (queryClassroomId && dateOnly) {
            await this.generateAvailableTimeSlots();
          }
        }
      },
      error: (err: Error) => {
        console.error("ReservationFormPage: Error in loadInitialFormData subscription:", err);
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
      console.log("Role is ADMIN or COORDINADOR. userId/status controls enabled.");

      if (this.userRole === Rol.ADMIN) {
        this.loadUsersForSelect([Rol.ADMIN, Rol.COORDINADOR, Rol.PROFESOR, Rol.ESTUDIANTE, Rol.TUTOR]);
      } else if (this.userRole === Rol.COORDINADOR) {
     
      this.loadUsersForSelect([Rol.PROFESOR, Rol.ESTUDIANTE, Rol.TUTOR]);
      }

     
      if (!this.isEditMode && this.userRole === Rol.COORDINADOR) {
        userIdControl?.setValidators(Validators.required);
        console.log("COORDINADOR in new mode: userId validator added.");
      } else {
        userIdControl?.clearValidators();
        console.log("ADMIN or in edit mode: userId validator cleared.");
      }
      userIdControl?.updateValueAndValidity();

    } else {

      userIdControl?.disable({ emitEvent: false });
      userIdControl?.patchValue(this.currentUser?.id, { emitEvent: false });
      statusControl?.disable({ emitEvent: false });
      userIdControl?.clearValidators();
      userIdControl?.updateValueAndValidity();
      console.log("Role is not ADMIN/COORDINADOR. userId/status controls disabled, userId set to current user.");
    }
    this.cdr.detectChanges();
  }

  loadUsersForSelect(roles: Rol[]) {
    this.userService.getAllUsers().pipe(takeUntil(this.destroy$)).subscribe(users => {
      this.assignableUsers = users.filter(user => user.role && roles.includes(user.role));

      this.usersForSelect = [...this.assignableUsers];
      console.log("Loaded assignable users:", this.usersForSelect.length, this.usersForSelect);
      if (this.usersForSelect.length === 0) {
        this.presentToast('No se encontraron usuarios para asignar.', 'warning');
      }
      this.cdr.detectChanges();
    });
  }

  async loadReservationData(id: string) {
    this.isLoading = true;
    this.isLoadingInitialData = true;
    const loading = await this.loadingCtrl.create({ message: 'Cargando reserva...' });
    await loading.present();

    this.reservationService.getReservationById(id).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        this.isLoadingInitialData = false;
        await loading.dismiss();
        this.cdr.detectChanges();
        console.log("ReservationFormPage: loadReservationData finalizado.");
      })
    ).subscribe({
      next: async (reservation: Reservation) => {
        console.log("Reservation data loaded:", reservation);
        if (!this.canEditThisReservation(reservation)) {
          this.presentToast('No tienes permiso para editar esta reserva.', 'danger');
          this.navCtrl.navigateBack('/app/reservations/my-list');
          return;
        }

        const startTimeDate = new Date(reservation.startTime);
        const dateOnly = formatDate(startTimeDate, 'yyyy-MM-dd', 'en-US');
        const durationBlocks = Math.round((new Date(reservation.endTime).getTime() - startTimeDate.getTime()) / (45 * 60 * 1000));

        this.reservationForm.patchValue({
          purpose: reservation.purpose,
          classroomId: reservation.classroom?.id,
          reservationDateControl: dateOnly,
          startTime: reservation.startTime,
          endTime: reservation.endTime, 
          durationBlocks: durationBlocks > 0 ? durationBlocks : 1,
          userId: reservation.user?.id,
          status: reservation.status
        });
        console.log("Form patched with reservation data.");

        if (this.userRole !== Rol.ADMIN) {
          if (this.userRole === Rol.COORDINADOR) {
            if (reservation.user?.id === this.currentUser?.id && reservation.status !== ReservationStatus.PENDIENTE) {
              this.reservationForm.disable();
              this.presentToast('Tu reserva no es editable en este estado.', 'warning');
              console.log("Coordinator's own reservation (not PENDING) disabled.");
            } else if (reservation.user?.role === Rol.ESTUDIANTE) {
              console.log("Coordinator editing student reservation.");
            } else {
              this.reservationForm.disable();
              this.presentToast('No tienes permiso para editar esta reserva de un rol superior.', 'danger');
              console.log("Coordinator trying to edit non-student/higher role reservation. Disabled.");
            }
          } else {
            if (reservation.user?.id !== this.currentUser?.id) {
              this.reservationForm.disable();
              this.presentToast('No tienes permiso para editar esta reserva.', 'danger');
              console.log("Regular user trying to edit other user's reservation. Disabled.");
            } else if (reservation.status !== ReservationStatus.PENDIENTE) {
              this.reservationForm.disable();
              this.presentToast('Tu reserva no es editable en este estado (solo PENDIENTE).', 'warning');
              console.log("Regular user's own reservation (not PENDING) disabled.");
            }
          }
        }
        console.log("Form enabled/disabled state after role/status check:", this.reservationForm.enabled);

        
        await this.generateAvailableTimeSlots();
        this.cdr.detectChanges();
      },
      error: async (err: Error) => {
        console.error("Error loading reservation data:", err);
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
    if (!this.reservationForm) {
      await this.presentToast('Formulario no inicializado.', 'danger');
      return;
    }


    this.markFormGroupTouched(this.reservationForm);

    if (this.reservationForm.invalid) {
      console.warn("Form is invalid:", this.reservationForm.errors, this.reservationForm.controls);
      await this.presentToast('Por favor, completa todos los campos requeridos y corrige los errores.', 'warning');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();
    const loadingSubmit = await this.loadingCtrl.create({
      message: this.isEditMode ? 'Actualizando reserva...' : 'Creando reserva...'
    });
    await loadingSubmit.present();

    const formValue = this.reservationForm.getRawValue();

   
    const startTimeISO = formValue.startTime;
    const endTimeISO = formValue.endTime;
    console.log("Submitting with startTime:", startTimeISO, "endTime:", endTimeISO);


    const reservationData: ReservationCreationData = {
      purpose: formValue.purpose,
      classroomId: formValue.classroomId,
      startTime: startTimeISO,
      endTime: endTimeISO,
      userId: formValue.userId,
      status: formValue.status
    };

   
    if (this.isEditMode) {
      if (this.userRole !== Rol.ADMIN && this.userRole !== Rol.COORDINADOR) {
        delete reservationData.userId;
        delete reservationData.status;
        console.log("Non-admin/coordinator in edit mode: userId and status removed from payload.");
      } else if (this.userRole === Rol.COORDINADOR) {

        console.log("Coordinator in edit mode: userId and status kept in payload, backend will validate.");
      }
    } else {
        if (this.userRole !== Rol.ADMIN && this.userRole !== Rol.COORDINADOR) {
            
            reservationData.userId = this.currentUser?.id;
            reservationData.status = ReservationStatus.PENDIENTE;
            console.log("Non-admin/coordinator creating new reservation: userId set to current user, status set to PENDING.");
        }
    }


    let operation: Observable<Reservation>;

    if (this.isEditMode && this.reservationId) {
      console.log("Performing update operation for reservation ID:", this.reservationId, "with data:", reservationData);
      operation = this.reservationService.updateReservation(this.reservationId, reservationData);
    } else {
      console.log("Performing create operation with data:", reservationData);
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
      next: async (res) => {
        console.log("Reservation operation successful:", res);
        const message = this.isEditMode ? 'Reserva actualizada exitosamente.' : 'Reserva creada exitosamente.';
        await this.presentToast(message, 'success');
        this.navCtrl.navigateBack('/app/reservations/my-list', { queryParams: { segment: 'my-reservations' } });
      },
      error: async (err: HttpErrorResponse | Error) => {
        const message = (err instanceof HttpErrorResponse && err.error?.message) ? err.error.message : err.message;
        console.error("Error saving reservation:", err);
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