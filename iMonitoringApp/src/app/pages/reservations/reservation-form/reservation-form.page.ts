import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidatorFn, ValidationErrors } from '@angular/forms';
import { CommonModule, DatePipe, formatDate } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  LoadingController, ToastController, AlertController, NavController, IonSelect,
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonSpinner, IonItem, IonLabel, IonSelectOption, IonInput, IonButton, IonTextarea
} from '@ionic/angular/standalone';

import { ReservationService, ReservationListFilters } from '../../../services/reservation.service';
import { Reservation, ReservationStatus, ReservationCreationData, ReservationUserDetails, ReservationClassroomDetails } from '../../../models/reservation.model';
import { ClassroomService } from '../../../services/classroom.service';
import { Classroom } from '../../../models/classroom.model';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';
import { Observable, Subject, forkJoin, of, combineLatest } from 'rxjs';
import { takeUntil, catchError, tap, finalize, take, switchMap, map, distinctUntilChanged, startWith, filter } from 'rxjs/operators';
import { Rol } from 'src/app/models/rol.model';

export function dateTimeOrderValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const startControl = group.get('startTime');
    const endControl = group.get('endTime');
    if (startControl && endControl && startControl.value && endControl.value) {
      const startDate = new Date(startControl.value);
      const endDate = new Date(endControl.value);
      if (endDate <= startDate) {
        endControl.setErrors({ ...endControl.errors, dateTimeOrder: true });
        return { invalidDateTimeOrder: true };
      } else if (endControl.hasError('dateTimeOrder')) {
          const errors = { ...endControl.errors };
          delete errors['dateTimeOrder'];
          endControl.setErrors(Object.keys(errors).length ? errors : null);
      }
    }
    return null;
  };
}

interface SelectableDate {
  value: string; 
  display: string;
}

@Component({
  selector: 'app-reservation-form',
  templateUrl: './reservation-form.page.html',
  styleUrls: ['./reservation-form.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
    IonSpinner, IonItem, IonLabel, IonSelect, IonSelectOption,
    IonButton, IonTextarea
  ],
  providers: [DatePipe]
})
export class ReservationFormPage implements OnInit, OnDestroy {
  @ViewChild('classroomSelectControl') classroomSelectControl!: IonSelect;

  private destroy$ = new Subject<void>();
  reservationForm!: FormGroup;
  isEditMode = false;
  reservationId: string | null = null;
  pageTitle = 'Nueva Reserva';
  isLoading = false;
  isLoadingInitialData = true;
  currentUser: User | null = null;
  userRole: Rol | null = null;

  classrooms: Classroom[] = [];
  assignableUsers: User[] = []; 
  availableStatuses = Object.values(ReservationStatus);
  public RolEnum = Rol;

  selectableDates: SelectableDate[] = [];
  selectedDateForTimeSlots: string = ''; 
  availableStartTimes: { value: string, display: string }[] = [];
  isLoadingTimes = false;
  existingReservationsForDay: Reservation[] = [];
  public reservationOwnerName: string | null = null;
  private originalReservationDataForEdit: Reservation | null = null;

  readonly SLOT_DURATION_MINUTES = 45;
  availableDurations: { value: number, display: string }[] = [
    { value: 1, display: `45 min (1 bloque)` }, { value: 2, display: `1h 30m (2 bloques)` },
    { value: 3, display: `2h 15m (3 bloques)` }, { value: 4, display: `3h (4 bloques)` },
    { value: 5, display: `3h 45m (5 bloques)` }, { value: 6, display: `4h 30m (6 bloques)` },
  ];
  selectedDurationBlocks: number = 1;
  
  constructor(
    private fb: FormBuilder,
    private reservationService: ReservationService,
    private classroomService: ClassroomService,
    private authService: AuthService,
    private userService: UserService,
    private route: ActivatedRoute,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef,
    public datePipe: DatePipe,
    private router: Router
  ) {
    this.generateSelectableDates();
  }

  ngOnInit() { this.initializeForm(); this.loadInitialData(); this.setupFormListeners(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  generateSelectableDates() {
    const dates: SelectableDate[] = [];
    const todayForIteration = new Date();
    for (let i = 0; i < 30; i++) { 
      const currentDateLocal = new Date(todayForIteration);
      currentDateLocal.setDate(todayForIteration.getDate() + i);
      currentDateLocal.setHours(0, 0, 0, 0);
      if (currentDateLocal.getDay() !== 0) {
        const dateValueUTCString = new Date(Date.UTC(
            currentDateLocal.getFullYear(),
            currentDateLocal.getMonth(),
            currentDateLocal.getDate()
        )).toISOString();
        dates.push({
          value: dateValueUTCString,
          display: formatDate(currentDateLocal, 'EEEE, d \'de\' MMMM \'de\' y', 'es-CO', 'America/Bogota')
        });
      }
    }
    this.selectableDates = dates;
  }
  
  ionViewDidEnter() {
    if (!this.isLoadingInitialData && this.classroomSelectControl && !this.isEditMode) {
      setTimeout(() => {
        const selectEl = this.classroomSelectControl as any;
        if (selectEl && typeof selectEl.setFocus === 'function') {
          selectEl.setFocus();
        } else if (selectEl && selectEl.el) {
            const button = selectEl.el.querySelector('button') || selectEl.el;
            if(button instanceof HTMLElement) button.focus();
        }
      }, 500);
    }
  }

  initializeForm() {
    let defaultDateISOForControl = '';
    if (this.selectableDates.length > 0) {
      defaultDateISOForControl = this.selectableDates[0].value;
    } else {
      const todayForFallback = new Date();
      defaultDateISOForControl = new Date(Date.UTC(todayForFallback.getFullYear(), todayForFallback.getMonth(), todayForFallback.getDate())).toISOString();
    }
    this.selectedDateForTimeSlots = formatDate(new Date(defaultDateISOForControl), 'yyyy-MM-dd', 'en-US', 'UTC');

    this.reservationForm = this.fb.group({
      classroomId: [null, Validators.required],
      userId: [null], 
      reservationDateControl: [defaultDateISOForControl, Validators.required],
      startTime: [null, Validators.required],
      endTime: [{ value: null, disabled: true }, Validators.required],
      durationBlocks: [this.selectedDurationBlocks, Validators.required],
      status: [{ value: ReservationStatus.PENDIENTE, disabled: true }, Validators.required],
      purpose: ['', [Validators.required, Validators.maxLength(255)]],
    }, { validators: dateTimeOrderValidator() });
  }

  loadInitialData() {
    this.isLoadingInitialData = true;
    this.cdr.detectChanges();

    const user$ = this.authService.getCurrentUser().pipe(take(1));
    const role$ = this.authService.getCurrentUserRole().pipe(take(1));
    const classrooms$ = this.classroomService.getAllClassrooms().pipe(
        catchError(err => { this.presentToast('Error al cargar las aulas', 'danger'); return of([] as Classroom[]); })
    );

    forkJoin({ user: user$, role: role$, classrooms: classrooms$ }).pipe(
        takeUntil(this.destroy$),
        switchMap(results => {
            this.currentUser = results.user;
            this.userRole = results.role;
            this.classrooms = results.classrooms;
            
            const observablesInner: { assignableUsers?: Observable<User[]> } = {};
            if (this.userRole === Rol.COORDINADOR || this.userRole === Rol.ADMIN) { 
                observablesInner.assignableUsers = this.userService.getAllUsers().pipe(
                    map(users => users.filter(u => u.id !== this.currentUser?.id)), 
                    catchError(err => { this.presentToast('Error al cargar la lista de usuarios.', 'danger'); return of([] as User[]); })
                );
            }
            return Object.keys(observablesInner).length > 0 ? 
                   forkJoin(observablesInner).pipe(map(extraResults => ({...results, ...extraResults}))) : 
                   of(results);
        }),
        finalize(() => { this.isLoadingInitialData = false; this.cdr.detectChanges(); })
    ).subscribe({
        next: (data: any) => {
            if (data.assignableUsers) {
              this.assignableUsers = data.assignableUsers;
            } else {
              this.assignableUsers = [];
            }
            this.reservationId = this.route.snapshot.paramMap.get('id');
            this.isEditMode = !!this.reservationId;
            this.pageTitle = this.isEditMode ? 'Editar Reserva' : 'Nueva Reserva';
            this.configureFormBasedOnRoleAndMode();
            if (this.isEditMode && this.reservationId) {
                this.loadReservationData(this.reservationId);
            } else {
                if (this.reservationForm.get('classroomId')?.value && this.reservationForm.get('reservationDateControl')?.value) {
                    this.reservationForm.get('classroomId')?.updateValueAndValidity({ emitEvent: true });
                }
            }
        },
        error: (err: Error) => this.presentToast(err.message || 'Error al cargar datos iniciales.', 'danger')
    });
  }

  setupFormListeners() {
      combineLatest([
        this.reservationForm.get('classroomId')!.valueChanges.pipe(startWith(this.reservationForm.get('classroomId')?.value), distinctUntilChanged()),
        this.reservationForm.get('reservationDateControl')!.valueChanges.pipe(
          startWith(this.reservationForm.get('reservationDateControl')?.value),
          tap(dateISO => {
            if (dateISO) {
              this.selectedDateForTimeSlots = formatDate(new Date(dateISO), 'yyyy-MM-dd', 'en-US', 'UTC');
              this.reservationForm.get('startTime')?.setValue(null, { emitEvent: false });
              this.reservationForm.get('endTime')?.setValue(null, { emitEvent: false });
              this.availableStartTimes = [];
            }
          }),
          map(dateISO => dateISO ? formatDate(new Date(dateISO), 'yyyy-MM-dd', 'en-US', 'UTC') : null),
          distinctUntilChanged()
        )
      ]).pipe(
        takeUntil(this.destroy$),
        filter(([classroomId, dateStrUTC]) => !!classroomId && !!dateStrUTC),
        switchMap(([classroomId, dateStrUTC]) => {
          this.isLoadingTimes = true; this.cdr.detectChanges();
          const dayStartUTC = `${dateStrUTC}T00:00:00.000Z`;
          const dayEndUTC = `${dateStrUTC}T23:59:59.999Z`;
          return this.reservationService.getReservationsByClassroomAndDateRange(classroomId, dayStartUTC, dayEndUTC).pipe(
            catchError(err => { this.presentToast(err.message || 'Error al cargar horarios existentes.', 'danger'); return of([] as Reservation[]); }),
            finalize(() => { this.isLoadingTimes = false; this.cdr.detectChanges(); })
          );
        })
      ).subscribe(reservations => {
        this.existingReservationsForDay = reservations.filter(r => 
            r.id !== this.reservationId &&
            (r.status === ReservationStatus.CONFIRMADA || r.status === ReservationStatus.PENDIENTE)
        );
        this.generateAvailableTimeSlots();
      });

      combineLatest([
        this.reservationForm.get('startTime')!.valueChanges.pipe(startWith(this.reservationForm.get('startTime')?.value)),
        this.reservationForm.get('durationBlocks')!.valueChanges.pipe(startWith(this.reservationForm.get('durationBlocks')?.value))
      ]).pipe(
        takeUntil(this.destroy$),
        filter(([startTime, durationBlocks]) => !!startTime && !!durationBlocks && !this.isLoadingTimes),
        tap(([startTime, durationBlocks]) => {
          this.selectedDurationBlocks = durationBlocks as number;
          this.updateEndTimeAndValidateFullSlot(startTime as string);
        })
      ).subscribe();
  }

  generateAvailableTimeSlots() {
    if (!this.selectedDateForTimeSlots || !this.reservationForm.get('classroomId')?.value) {
      this.availableStartTimes = []; this.cdr.detectChanges(); return;
    }
    const slots: { value: string, display: string }[] = [];
    const openingHour = 7; 
    let dayClosingHour = 22; 
    const dateParts = this.selectedDateForTimeSlots.split('-').map(Number);
    const localYear = dateParts[0];
    const localMonth = dateParts[1] - 1; 
    const localDay = dateParts[2];
    const selectedDateObjectForDayCheck = new Date(Date.UTC(localYear, localMonth, localDay));
    const dayOfWeek = selectedDateObjectForDayCheck.getUTCDay();
    if (dayOfWeek === 6) dayClosingHour = 12; 
    else if (dayOfWeek === 0) { this.availableStartTimes = []; this.cdr.detectChanges(); return; }
    const now = new Date();
    const todayLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedDateLocalMidnight = new Date(localYear, localMonth, localDay);
    const isSelectedDateToday = selectedDateLocalMidnight.getTime() === todayLocalMidnight.getTime();

    for (let hour = openingHour; hour < dayClosingHour; hour++) {
      for (let minute = 0; minute < 60; minute += this.SLOT_DURATION_MINUTES) {
        const slotStartLocalTime = new Date(localYear, localMonth, localDay, hour, minute);
        if (isSelectedDateToday && slotStartLocalTime.getTime() < now.getTime()) continue;
        const potentialSlotEndLocalTime = new Date(slotStartLocalTime.getTime() + this.SLOT_DURATION_MINUTES * 60 * 1000);
        if (potentialSlotEndLocalTime.getFullYear() > localYear ||
            potentialSlotEndLocalTime.getMonth() > localMonth ||
            potentialSlotEndLocalTime.getDate() > localDay ||
            potentialSlotEndLocalTime.getHours() > dayClosingHour ||
            (potentialSlotEndLocalTime.getHours() === dayClosingHour && potentialSlotEndLocalTime.getMinutes() > 0)) {
          continue;
        }
        let isThisIndividualSlotAvailable = true;
        if (this.existingReservationsForDay) {
          for (const res of this.existingReservationsForDay) {
            if (this.isEditMode && this.reservationId === res.id) continue; 
            const resStartTime = new Date(res.startTime).getTime();
            const resEndTime = new Date(res.endTime).getTime();
            const slotStartTimeForComparison = slotStartLocalTime.getTime();
            const slotEndTimeForComparison = potentialSlotEndLocalTime.getTime();
            if (slotStartTimeForComparison < resEndTime && slotEndTimeForComparison > resStartTime) {
              isThisIndividualSlotAvailable = false; break;
            }
          }
        }
        if (isThisIndividualSlotAvailable) {
          slots.push({
            value: slotStartLocalTime.toISOString(),
            display: formatDate(slotStartLocalTime, 'HH:mm', 'es-CO', 'America/Bogota')
          });
        }
      }
    }
    this.availableStartTimes = slots;
    this.cdr.detectChanges();
  }

  onStartTimeSelected(selectedStartTimeISO_UTC: string) {
    if (!selectedStartTimeISO_UTC || this.isLoadingTimes) return;
    this.reservationForm.get('startTime')?.setValue(selectedStartTimeISO_UTC, { emitEvent: true });
  }

  updateEndTimeAndValidateFullSlot(startTimeISO: string | null) {
    if (!startTimeISO || !this.selectedDurationBlocks) {
      this.reservationForm.get('endTime')?.setValue(null, { emitEvent: false });
      this.cdr.detectChanges(); return;
    }
    const startTimeUTC = new Date(startTimeISO);
    const totalDurationMinutes = this.selectedDurationBlocks * this.SLOT_DURATION_MINUTES;
    const endTimeUTC = new Date(startTimeUTC.getTime() + totalDurationMinutes * 60 * 1000);
    let isFullSlotAvailable = true;
    if (this.existingReservationsForDay) {
      for (let i = 0; i < this.selectedDurationBlocks; i++) {
        const currentBlockStartTime = new Date(startTimeUTC.getTime() + i * this.SLOT_DURATION_MINUTES * 60 * 1000);
        const currentBlockEndTime = new Date(currentBlockStartTime.getTime() + this.SLOT_DURATION_MINUTES * 60 * 1000);
        for (const res of this.existingReservationsForDay) {
          if (this.isEditMode && this.reservationId === res.id) continue;
          const resStartTime = new Date(res.startTime).getTime();
          const resEndTime = new Date(res.endTime).getTime();
          if (currentBlockStartTime.getTime() < resEndTime && currentBlockEndTime.getTime() > resStartTime) {
            isFullSlotAvailable = false; break;
          }
        }
        if (!isFullSlotAvailable) break;
      }
    }
    if (isFullSlotAvailable) {
      this.reservationForm.patchValue({ endTime: endTimeUTC.toISOString() }, { emitEvent: false });
      this.reservationForm.get('endTime')?.setErrors(null);
    } else {
      this.reservationForm.patchValue({ endTime: null }, { emitEvent: false });
      this.reservationForm.get('endTime')?.setErrors({ slotUnavailable: true });
      if (this.reservationForm.get('startTime')?.dirty) {
         this.presentToast('La franja horaria seleccionada completa no está disponible.', 'warning');
      }
    }
    this.cdr.detectChanges();
  }

  configureFormBasedOnRoleAndMode() {
    const userIdControl = this.reservationForm.get('userId');
    const statusControl = this.reservationForm.get('status');

    if (this.userRole === Rol.ADMIN) {
      userIdControl?.enable({ emitEvent: false });
      statusControl?.enable({ emitEvent: false });
      if (!this.isEditMode) statusControl?.patchValue(ReservationStatus.PENDIENTE, { emitEvent: false });
    } else if (this.userRole === Rol.COORDINADOR) {
      userIdControl?.enable({ emitEvent: false }); 
      if (!this.isEditMode) {
        userIdControl?.setValidators(Validators.required); 
      } else { 
         if (this.originalReservationDataForEdit?.user && 
             this.originalReservationDataForEdit.user.id !== this.currentUser?.id &&
             this.originalReservationDataForEdit.user.role !== Rol.ESTUDIANTE) {
             userIdControl?.disable({emitEvent: false});
         }
      }
      userIdControl?.updateValueAndValidity({emitEvent: false});
      statusControl?.disable({ emitEvent: false }); 
      if (!this.isEditMode) statusControl?.patchValue(ReservationStatus.PENDIENTE, { emitEvent: false });
    } else { 
      userIdControl?.patchValue(this.currentUser?.id, { emitEvent: false });
      userIdControl?.disable({ emitEvent: false });
      statusControl?.disable({ emitEvent: false });
      if (!this.isEditMode) statusControl?.patchValue(ReservationStatus.PENDIENTE, { emitEvent: false });
    }
    this.cdr.detectChanges();
  }

  async loadReservationData(id: string) {
    this.isLoading = true;
    this.originalReservationDataForEdit = null;
    const loading = await this.loadingCtrl.create({ message: 'Cargando reserva...' });
    await loading.present();

    this.reservationService.getReservationById(id).pipe(
      takeUntil(this.destroy$),
      finalize(async () => { 
        this.isLoading = false; 
        if(loading) { await loading.dismiss().catch(e=>console.error("Error dismissing loading (loadReservationData)", e)); }
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (res: Reservation) => { 
        this.originalReservationDataForEdit = { ...res };
        
        if (!this.canEditThisReservation(res.status, res.user?.id, res.user?.role)) { // Pasa res.user.role
          this.presentToast('No está autorizado para editar esta reserva o ya no está en un estado editable.', 'danger');
          this.navCtrl.back();
          return;
        }
        this.reservationOwnerName = res.user?.name ?? null;
        const startTimeUTC = new Date(res.startTime);
        const endTimeUTC = new Date(res.endTime);
        const durationMillis = endTimeUTC.getTime() - startTimeUTC.getTime();
        const durationInBlocks = Math.max(1, Math.round(durationMillis / (this.SLOT_DURATION_MINUTES * 60 * 1000)));
        
        const dateUTCISO = new Date(Date.UTC(startTimeUTC.getUTCFullYear(), startTimeUTC.getUTCMonth(), startTimeUTC.getUTCDate())).toISOString();
        
        this.reservationForm.patchValue({
            classroomId: res.classroom?.id,
            purpose: res.purpose,
            durationBlocks: durationInBlocks,
            reservationDateControl: dateUTCISO,
            status: res.status,
            userId: res.user?.id
        }, { emitEvent: false });
        
        this.selectedDurationBlocks = durationInBlocks;
        this.configureFormBasedOnRoleAndMode(); 

        const classroomIdForSlots = this.reservationForm.get('classroomId')?.value;
        this.selectedDateForTimeSlots = formatDate(new Date(dateUTCISO), 'yyyy-MM-dd', 'en-US', 'UTC');

        if (classroomIdForSlots && this.selectedDateForTimeSlots) {
            const dayStart = `${this.selectedDateForTimeSlots}T00:00:00.000Z`;
            const dayEnd = `${this.selectedDateForTimeSlots}T23:59:59.999Z`;
            this.reservationService.getReservationsByClassroomAndDateRange(classroomIdForSlots, dayStart, dayEnd)
            .pipe(takeUntil(this.destroy$))
            .subscribe(dayRes => {
                this.existingReservationsForDay = dayRes.filter(r => 
                    r.id !== this.reservationId &&
                    (r.status === ReservationStatus.CONFIRMADA || r.status === ReservationStatus.PENDIENTE)
                );
                this.generateAvailableTimeSlots();
                this.reservationForm.get('startTime')?.setValue(res.startTime, { emitEvent: true }); 
                this.cdr.detectChanges();
            });
        } else {
             this.reservationForm.get('startTime')?.setValue(null, { emitEvent: true });
             this.cdr.detectChanges();
        }
      },
      error: async (err: Error) => { 
        await this.presentToast(err.message || 'Error al cargar la reserva.', 'danger'); 
        this.navCtrl.back(); 
      }
    });
  }

  async onSubmit() {
    const userIdControl = this.reservationForm.get('userId'); 
    if (this.reservationForm.invalid) {
      this.markFormGroupTouched(this.reservationForm);
      if (this.reservationForm.get('endTime')?.hasError('slotUnavailable')) {
        await this.presentToast('La franja horaria seleccionada completa no está disponible.', 'warning');
      } else {
        await this.presentToast('Por favor, completa los campos requeridos correctamente.', 'warning');
      }
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: this.isEditMode ? 'Actualizando...' : 'Creando...' });
    await loading.present();
    const formVal = this.reservationForm.getRawValue();

    const payload: ReservationCreationData = {
      classroomId: formVal.classroomId,
      startTime: formVal.startTime,
      endTime: formVal.endTime,
      purpose: formVal.purpose,
      userId: (this.userRole === Rol.ADMIN || this.userRole === Rol.COORDINADOR) && userIdControl?.enabled && formVal.userId ? formVal.userId : undefined
    };
    
    let operation$: Observable<Reservation>;
    let updatePayload: Partial<ReservationCreationData> & { status?: ReservationStatus } = { ...payload };

    if (this.isEditMode && this.reservationId) {
      if (this.userRole === Rol.ADMIN && formVal.status !== this.originalReservationDataForEdit?.status) {
        updatePayload.status = formVal.status;
      }
      operation$ = this.reservationService.updateReservation(this.reservationId, updatePayload);
    } else {
      operation$ = this.reservationService.createReservation(payload);
    }

    operation$.pipe(
      takeUntil(this.destroy$),
      finalize(async () => { 
        this.isLoading = false; 
        if(loading) { await loading.dismiss().catch(e=>console.error("Error dismissing loading (onSubmit)", e)); }
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: async (savedReservation) => {
        await this.presentToast(`Reserva ${this.isEditMode ? 'actualizada' : 'creada'} exitosamente.`, 'success');
        this.navCtrl.navigateBack('/app/reservations/my-list', { animated: true });
      },
      error: async (err: Error) => {
        this.presentToast(err.message || `Error al ${this.isEditMode ? 'actualizar' : 'crear'} la reserva.`, 'danger');
      }
    });
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) { this.markFormGroupTouched(control); }
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning' | 'primary' | 'secondary' | 'tertiary' | 'light' | 'medium' | 'dark') {
    const toast = await this.toastCtrl.create({ message, duration: 3500, color, position: 'top', buttons: [{text:'OK',role:'cancel'}]});
    await toast.present();
  }
  
  cancel() {
    this.navCtrl.navigateBack('/app/reservations/my-list');
  }
  
  canEditThisReservation(currentStatus?: ReservationStatus, reservationUserId?: string, reservationUserRole?: Rol): boolean {
    if (!this.currentUser || !this.userRole || !reservationUserId) return false;
    if (this.userRole === Rol.ADMIN) return true;
    
    const isOwner = this.currentUser.id === reservationUserId;

    if (this.userRole === Rol.COORDINADOR) {
        if (isOwner && currentStatus === ReservationStatus.PENDIENTE) return true;
        if (reservationUserRole === Rol.ESTUDIANTE && 
            (currentStatus === ReservationStatus.PENDIENTE )) return true;
    }
    return isOwner && currentStatus === ReservationStatus.PENDIENTE;
  }
}