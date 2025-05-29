import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidatorFn } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonSpinner,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonButton,
  IonTextarea,
  LoadingController,
  ToastController,
  NavController,
  AlertController
} from '@ionic/angular/standalone';
import { ReservationService, ReservationCreationData } from '../../../services/reservation.service';
import { Reservation, ReservationStatus } from '../../../models/reservation.model';
import { ClassroomService } from '../../../services/classroom.service';
import { Classroom } from '../../../models/classroom.model';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';
import { Observable, Subject, forkJoin, of, combineLatest } from 'rxjs';
import { takeUntil, catchError, tap, finalize, take, switchMap, map, distinctUntilChanged, startWith, filter } from 'rxjs/operators';
import { Rol } from 'src/app/models/rol.model';

export function dateTimeOrderValidator(): ValidatorFn {
  return (group: AbstractControl): { [key: string]: any } | null => {
    const startControl = group.get('startTime');
    const endControl = group.get('endTime');
    if (startControl && endControl && startControl.value && endControl.value) {
      const startDate = new Date(startControl.value);
      const endDate = new Date(endControl.value);
      if (endDate <= startDate) {
        endControl.setErrors({ ...endControl.errors, dateTimeOrder: true });
        return { invalidDateTimeOrder: true };
      }
    }
    if (endControl?.hasError('dateTimeOrder')) {
      const startValue = startControl?.value;
      const endValue = endControl?.value;
      if (startValue && endValue) {
        const startDate = new Date(startValue);
        const endDate = new Date(endValue);
        if (endDate > startDate) {
          const errors = { ...endControl.errors };
          delete errors['dateTimeOrder'];
          endControl.setErrors(Object.keys(errors).length ? errors : null);
        }
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
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonSpinner,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonButton,
    IonTextarea
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
  studentUsers: User[] = [];
  availableStatuses = Object.values(ReservationStatus);
  public RolEnum = Rol;

  selectableDates: SelectableDate[] = [];
  selectedDateForTimeSlots: string = '';
  availableStartTimes: { value: string, display: string }[] = [];
  isLoadingTimes = false;
  existingReservationsForDay: Reservation[] = [];
  reservationDurationHours = 1;
  public reservationOwnerName: string | null = null;

  private activeElementBeforeOverlay: HTMLElement | null = null;

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

  ngOnInit() {
    this.initializeForm();
    this.loadInitialData();
    this.setupFormListeners();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

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
          display: this.datePipe.transform(currentDateLocal, 'EEEE, d \'de\' MMMM \'de\' y', undefined, 'es-CO') || ''
        });
      }
    }
    this.selectableDates = dates;
  }

  ionViewDidEnter() {
    if (!this.isLoadingInitialData && this.classroomSelectControl) {
      console.log('ReservationFormPage: ionViewDidEnter, intentando enfocar selector de aula.');
      setTimeout(() => {
        if (typeof (this.classroomSelectControl as any).setFocus === 'function') {
            (this.classroomSelectControl as any).setFocus();
        } else {
            const el = (this.classroomSelectControl as any).el as HTMLElement;
            const button = el.querySelector('button') || el;
            if(button instanceof HTMLElement) button.focus();
        }
      }, 300);
    }
  }

  private storeActiveElement() {
    if (document.activeElement && document.activeElement !== document.body) {
      this.activeElementBeforeOverlay = document.activeElement as HTMLElement;
    } else { this.activeElementBeforeOverlay = null; }
  }

  private blurActiveElement() {
    if (document.activeElement && typeof (document.activeElement as HTMLElement).blur === 'function' && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }
  }

  private restoreActiveElement() {
    if (this.activeElementBeforeOverlay && typeof this.activeElementBeforeOverlay.focus === 'function') {
      setTimeout(() => {
        this.activeElementBeforeOverlay?.focus();
        this.activeElementBeforeOverlay = null;
      }, 150);
    }
  }

  initializeForm() {
    let defaultDateISOForControl = '';
    if (this.selectableDates.length > 0) {
      defaultDateISOForControl = this.selectableDates[0].value;
      this.selectedDateForTimeSlots = this.datePipe.transform(new Date(defaultDateISOForControl), 'yyyy-MM-dd', 'UTC')!;
    } else {
      const todayForFallback = new Date();
      defaultDateISOForControl = new Date(Date.UTC(todayForFallback.getFullYear(), todayForFallback.getMonth(), todayForFallback.getDate())).toISOString();
      this.selectedDateForTimeSlots = this.datePipe.transform(todayForFallback, 'yyyy-MM-dd', 'UTC')!;
    }

    this.reservationForm = this.fb.group({
      classroomId: [null, Validators.required],
      userId: [null],
      reservationDateControl: [defaultDateISOForControl, Validators.required],
      startTime: [null, Validators.required],
      endTime: [{ value: null, disabled: true }, Validators.required],
      status: [{ value: ReservationStatus.PENDIENTE, disabled: true }, Validators.required],
      purpose: ['', Validators.maxLength(255)],
    }, { validators: dateTimeOrderValidator() });
  }

  loadInitialData() {
    this.isLoadingInitialData = true;
    this.cdr.detectChanges();
    const observables: { [key: string]: Observable<any> } = {
        user: this.authService.getCurrentUser().pipe(take(1)),
        role: this.authService.getCurrentUserRole().pipe(take(1)),
        classroomsData: this.classroomService.getAllClassrooms().pipe(
            catchError(err => {
                this.presentToast('Error al cargar las aulas', 'danger'); return of([] as Classroom[]);
            })
        )
    };
    this.authService.getCurrentUserRole().pipe(take(1)).subscribe(role => {
        if (role === Rol.COORDINADOR) {
            observables['studentUsersData'] = this.userService.getUsersByRole(Rol.ESTUDIANTE).pipe(
                catchError(err => {
                    this.presentToast('Error al cargar la lista de estudiantes', 'danger'); return of([] as User[]);
                })
            );
        }
        forkJoin(observables).pipe(
            takeUntil(this.destroy$),
            finalize(() => { this.isLoadingInitialData = false; this.cdr.detectChanges(); })
        ).subscribe({
            next: (results: any) => {
                this.currentUser = results.user; this.userRole = results.role;
                this.classrooms = results.classroomsData;
                if (results.studentUsersData) this.studentUsers = results.studentUsersData;
                this.reservationId = this.route.snapshot.paramMap.get('id');
                this.isEditMode = !!this.reservationId;
                this.pageTitle = this.isEditMode ? 'Editar Reserva' : 'Nueva Reserva';
                this.configureFormBasedOnRoleAndMode();
                if (this.isEditMode && this.reservationId) this.loadReservationData(this.reservationId);
                else if (this.reservationForm.get('classroomId')?.value && this.reservationForm.get('reservationDateControl')?.value) {
                    this.reservationForm.get('classroomId')?.updateValueAndValidity({ emitEvent: true });
                }
            },
            error: (err) => this.presentToast('Error al cargar datos del formulario', 'danger')
        });
    });
  }

  setupFormListeners() {
      combineLatest([
        this.reservationForm.get('classroomId')!.valueChanges.pipe(startWith(this.reservationForm.get('classroomId')?.value), distinctUntilChanged()),
        this.reservationForm.get('reservationDateControl')!.valueChanges.pipe(
          startWith(this.reservationForm.get('reservationDateControl')?.value),
          tap(dateISO => {
            if (dateISO) {
              this.selectedDateForTimeSlots = this.datePipe.transform(dateISO, 'yyyy-MM-dd', 'UTC')!;
              this.reservationForm.get('startTime')?.setValue(null, { emitEvent: false });
              this.reservationForm.get('endTime')?.setValue(null, { emitEvent: false });
              this.availableStartTimes = [];
            }
          }),
          map(dateISO => dateISO ? this.datePipe.transform(dateISO, 'yyyy-MM-dd', 'UTC') : null),
          distinctUntilChanged()
        )
      ]).pipe(
        takeUntil(this.destroy$),
        filter(([classroomId, dateStrUTC]) => !!classroomId && !!dateStrUTC),
        switchMap(([classroomId, dateStrUTC]) => {
          this.isLoadingTimes = true; this.cdr.detectChanges();
          const parts = dateStrUTC!.split('-').map(Number);
          const dayStartUTC = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0)).toISOString();
          const dayEndUTC = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999)).toISOString();
          return this.classroomService.getClassroomReservations(classroomId, dayStartUTC, dayEndUTC).pipe(
            catchError(err => { this.presentToast('Error al cargar horarios', 'danger'); return of([] as Reservation[]); }),
            finalize(() => { this.isLoadingTimes = false; this.cdr.detectChanges(); })
          );
        })
      ).subscribe(reservations => {
        this.existingReservationsForDay = reservations;
        this.generateAvailableTimeSlots(reservations);
      });
  }

  generateAvailableTimeSlots(currentDayReservations?: Reservation[]) {
    const reservationsToUse = currentDayReservations || this.existingReservationsForDay;
    if (!this.selectedDateForTimeSlots || !this.reservationForm.get('classroomId')?.value) {
      this.availableStartTimes = []; this.cdr.detectChanges(); return;
    }
    const slots: { value: string, display: string }[] = [];
    const openingHour = 7; let dayClosingHour = 22;
    const dateParts = this.selectedDateForTimeSlots.split('-').map(Number);
    const selectedDateUTC = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
    const dayOfWeek = selectedDateUTC.getUTCDay();
    if (dayOfWeek === 6) dayClosingHour = 12; else if (dayOfWeek === 0) { this.availableStartTimes = []; this.cdr.detectChanges(); return; }
    const now = new Date();
    const todayLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedDateLocalMidnight = new Date(selectedDateUTC.getUTCFullYear(), selectedDateUTC.getUTCMonth(), selectedDateUTC.getUTCDate());
    const isSelectedDateToday = selectedDateLocalMidnight.getTime() === todayLocalMidnight.getTime();

    for (let hour = openingHour; hour < dayClosingHour; hour++) {
      const slotStartUTC = new Date(Date.UTC(selectedDateUTC.getUTCFullYear(), selectedDateUTC.getUTCMonth(), selectedDateUTC.getUTCDate(), hour, 0, 0, 0));
      if (isSelectedDateToday && slotStartUTC.getTime() < now.getTime()) continue;
      const slotStartUTCValue = slotStartUTC.toISOString();
      const slotEndUTC = new Date(slotStartUTC.getTime() + this.reservationDurationHours * 60 * 60 * 1000);
      let isDisabled = false;
      for (const res of reservationsToUse) {
        if (this.isEditMode && this.reservationId === res.id) continue;
        if (slotStartUTC < new Date(res.endTime) && slotEndUTC > new Date(res.startTime)) { isDisabled = true; break; }
      }
      if (!isDisabled) {
        const displayDate = new Date(slotStartUTCValue);
        slots.push({ value: slotStartUTCValue, display: this.datePipe.transform(displayDate, 'HH:mm', undefined, 'es-CO')! });
      }
    }
    this.availableStartTimes = slots; this.cdr.detectChanges();
  }

  onStartTimeSelected(selectedStartTimeISO_UTC: string) {
    if (!selectedStartTimeISO_UTC || this.isLoadingTimes) return;
    const startTimeUTC = new Date(selectedStartTimeISO_UTC);
    const endTimeUTC = new Date(startTimeUTC.getTime() + this.reservationDurationHours * 60 * 60 * 1000);
    this.reservationForm.patchValue({
        startTime: startTimeUTC.toISOString(),
        endTime: endTimeUTC.toISOString()
    }, { emitEvent: false });
    this.cdr.detectChanges();
  }

  configureFormBasedOnRoleAndMode() {
    const userIdControl = this.reservationForm.get('userId');
    const statusControl = this.reservationForm.get('status');
    if (this.userRole === Rol.ADMIN) {
      userIdControl?.enable({ emitEvent: false }); statusControl?.enable({ emitEvent: false });
      if (!this.isEditMode) statusControl?.patchValue(ReservationStatus.PENDIENTE, { emitEvent: false });
    } else if (this.userRole === Rol.COORDINADOR) {
      if (!this.isEditMode) { userIdControl?.enable({ emitEvent: false }); userIdControl?.setValidators(Validators.required); }
      else userIdControl?.disable({ emitEvent: false });
      userIdControl?.updateValueAndValidity({emitEvent: false});
      statusControl?.disable({ emitEvent: false });
      if (!this.isEditMode) statusControl?.patchValue(ReservationStatus.PENDIENTE, { emitEvent: false });
    } else {
      userIdControl?.disable({ emitEvent: false }); statusControl?.disable({ emitEvent: false });
      if (this.currentUser?.id) userIdControl?.patchValue(this.currentUser.id, { emitEvent: false });
      if (!this.isEditMode) statusControl?.patchValue(ReservationStatus.PENDIENTE, { emitEvent: false });
    }
    this.cdr.detectChanges();
  }

  async loadReservationData(id: string) {
    this.isLoading = true; this.reservationOwnerName = null;
    this.storeActiveElement(); this.blurActiveElement();
    const loading = await this.loadingCtrl.create({ message: 'Cargando reserva...' });
    await loading.present();
    this.reservationService.getReservationById(id).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        try { await loading.dismiss(); } catch (e) {}
        this.restoreActiveElement(); this.cdr.detectChanges();
      })
    ).subscribe({
      next: (res) => {
        if (!this.canEditThisReservation(res.status, res.user?.id)) {
          this.presentToast('No autorizado para editar.', 'danger'); this.navCtrl.back(); return;
        }
        this.reservationOwnerName = res.user?.name ?? null;
        const startTimeUTC = new Date(res.startTime);
        const dateUTCISO = new Date(Date.UTC(startTimeUTC.getUTCFullYear(), startTimeUTC.getUTCMonth(), startTimeUTC.getUTCDate())).toISOString();
        this.reservationForm.get('reservationDateControl')?.setValue(dateUTCISO, { emitEvent: false });
        this.selectedDateForTimeSlots = this.datePipe.transform(startTimeUTC, 'yyyy-MM-dd', 'UTC')!;
        this.reservationForm.patchValue({ classroomId: res.classroom?.id, purpose: res.purpose }, { emitEvent: false });
        if (this.userRole === Rol.ADMIN) this.reservationForm.patchValue({ userId: res.user?.id, status: res.status }, { emitEvent: false });
        else if (this.userRole === Rol.COORDINADOR && this.isEditMode) {
            this.reservationForm.get('userId')?.patchValue(res.user?.id, { emitEvent: false });
            this.reservationForm.get('status')?.patchValue(res.status, { emitEvent: false });
        } else {
            this.reservationForm.get('userId')?.patchValue(this.currentUser?.id, { emitEvent: false });
            this.reservationForm.get('status')?.patchValue(res.status, {emitEvent: false});
        }
        const classroomId = this.reservationForm.get('classroomId')?.value;
        if (classroomId && this.selectedDateForTimeSlots) {
            const parts = this.selectedDateForTimeSlots.split('-').map(Number);
            const dayStart = new Date(Date.UTC(parts[0],parts[1]-1,parts[2])).toISOString();
            const dayEnd = new Date(Date.UTC(parts[0],parts[1]-1,parts[2],23,59,59,999)).toISOString();
            this.classroomService.getClassroomReservations(classroomId, dayStart, dayEnd).pipe(takeUntil(this.destroy$)).subscribe(dayRes => {
                this.existingReservationsForDay = dayRes; this.generateAvailableTimeSlots(dayRes);
                const matchingSlot = this.availableStartTimes.find(s => s.value === res.startTime);
                if(matchingSlot) {
                    this.reservationForm.patchValue({startTime: res.startTime, endTime: res.endTime}, {emitEvent:false});
                } else {
                    this.reservationForm.patchValue({startTime: null, endTime: null}, {emitEvent:false});
                    if(this.isEditMode) this.presentToast('Horario original no disponible. Selecciona uno nuevo.', 'warning');
                }
                this.cdr.detectChanges();
            });
        }
      },
      error: async (err) => { await this.presentToast('Error al cargar reserva.', 'danger'); this.navCtrl.back(); }
    });
  }

  async onSubmit() {
    if (this.reservationForm.invalid) {
      this.markFormGroupTouched(this.reservationForm);
      await this.presentToast('Completa los campos requeridos.', 'warning'); return;
    }
    this.isLoading = true; this.storeActiveElement(); this.blurActiveElement();
    const loading = await this.loadingCtrl.create({ message: this.isEditMode ? 'Actualizando...' : 'Creando...' });
    await loading.present();
    const formVal = this.reservationForm.getRawValue();
    const payload: ReservationCreationData = {
      classroomId: formVal.classroomId, startTime: formVal.startTime, endTime: formVal.endTime, purpose: formVal.purpose,
    };
    if (this.userRole === Rol.ADMIN) {
      payload.userId = formVal.userId || this.currentUser?.id;
      (payload as Reservation).status = this.isEditMode ? formVal.status : (formVal.status || ReservationStatus.PENDIENTE);
    } else if (this.userRole === Rol.COORDINADOR) {
      if (!this.isEditMode) {
        if (!formVal.userId) {
            this.isLoading = false; await loading.dismiss();
            await this.presentToast('Coordinador debe seleccionar un estudiante.', 'danger'); this.restoreActiveElement(); return;
        }
        payload.userId = formVal.userId;
      } else payload.userId = formVal.userId;
      (payload as Reservation).status = (this.isEditMode ? formVal.status : ReservationStatus.PENDIENTE);
    } else {
      payload.userId = this.currentUser?.id;
      (payload as Reservation).status = ReservationStatus.PENDIENTE;
    }
    const operation = this.isEditMode && this.reservationId
      ? this.reservationService.updateReservation(this.reservationId, payload as Reservation)
      : this.reservationService.createReservation(payload);
    operation.pipe(takeUntil(this.destroy$), finalize(async () => {
        this.isLoading = false; try { await loading.dismiss(); } catch(e) {} this.restoreActiveElement(); this.cdr.detectChanges();
    })).subscribe({
      next: async () => {
        await this.presentToast(`Reserva ${this.isEditMode ? 'actualizada' : 'creada'}.`, 'success');
        this.navCtrl.navigateBack('/app/reservations/my-list', { animated: true });
      },
      error: async (err: any) => {
        const msg = err?.error?.message || err?.message || `Error al ${this.isEditMode ? 'actualizar' : 'crear'}.`;
        await this.presentToast(msg, 'danger');
      }
    });
  }

  markFormGroupTouched(fg: FormGroup) { Object.values(fg.controls).forEach(c => { c.markAsTouched(); if (c instanceof FormGroup) this.markFormGroupTouched(c); }); }
  async presentToast(msg: string, color: 'success'|'danger'|'warning', icon?: string) {
    this.storeActiveElement(); this.blurActiveElement();
    const t = await this.toastCtrl.create({ message: msg, duration: 3500, color, position: 'top', icon, buttons: [{text:'OK',role:'cancel'}]});
    t.present(); t.onDidDismiss().then(() => this.restoreActiveElement());
  }
  cancel() { this.router.navigate(['/app/reservations/my-list']); }
  canEditThisReservation(status?: ReservationStatus, ownerId?: string): boolean {
    if (!this.userRole || !this.currentUser) return false;
    if (this.userRole === Rol.ADMIN) return true;
    if (this.userRole === Rol.COORDINADOR) return true;
    return this.currentUser.id === ownerId && status === ReservationStatus.PENDIENTE;
  }
}
