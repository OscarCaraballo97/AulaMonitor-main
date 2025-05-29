import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule, AlertController, LoadingController, ToastController, NavController, IonRefresher } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../services/user.service';
import { User } from '../../../models/user.model';
import { Rol } from '../../../models/rol.model';
import { Subject, Observable, combineLatest, forkJoin, of } from 'rxjs';
import { takeUntil, filter, map, catchError } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.page.html',
  styleUrls: ['./user-list.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
})
export class UserListPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  users: User[] = [];
  isLoading = false;
  errorMessage: string = '';
  public RolEnum = Rol;
  currentUserRole: Rol | null = null;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
     this.authService.getCurrentUserRole().pipe(takeUntil(this.destroy$)).subscribe(role => {
        this.currentUserRole = role;
     });
  }

  ionViewWillEnter() {
    this.loadUsers();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadUsers(event?: CustomEvent) {
    this.isLoading = true;
    this.errorMessage = '';
    let loadingOverlay: HTMLIonLoadingElement | undefined;

    if (!event) {
      loadingOverlay = await this.loadingCtrl.create({ message: 'Cargando usuarios...' });
      await loadingOverlay.present();
    }

    let usersObservable: Observable<User[]>;

    if (this.currentUserRole === Rol.ADMIN) {
      usersObservable = this.userService.getAllUsers();
    } else if (this.currentUserRole === Rol.COORDINADOR) {
      usersObservable = forkJoin([
        this.userService.getUsersByRole(Rol.ESTUDIANTE).pipe(catchError(() => of([] as User[]))),
        this.userService.getUsersByRole(Rol.TUTOR).pipe(catchError(() => of([] as User[]))),
        this.userService.getUsersByRole(Rol.PROFESOR).pipe(catchError(() => of([] as User[])))
      ]).pipe(
        map(([students, tutors, professors]) => [...students, ...tutors, ...professors])
      );
    } else {
      console.warn('UserListPage: Usuario sin rol ADMIN o COORDINADOR intentando acceder.');
      this.users = [];
      this.isLoading = false;
      if (loadingOverlay) await loadingOverlay.dismiss();
      if (event && event.target) (event.target as unknown as IonRefresher).complete();
      this.cdr.detectChanges();
      return;
    }

    usersObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: User[]) => {
          this.users = data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          this.isLoading = false;
        },
        error: async (err: Error) => {
          this.errorMessage = err.message || 'Error al cargar usuarios.';
          this.isLoading = false;
          await this.presentToast(this.errorMessage, 'danger');
        },
        complete: async () => {
          if (loadingOverlay) await loadingOverlay.dismiss();
          if (event && event.target) (event.target as unknown as IonRefresher).complete();
          this.cdr.detectChanges();
        }
      });
  }

  canEditUser(userToList: User): boolean {
    if (this.currentUserRole === Rol.ADMIN) {
      return true;
    }
    return this.currentUserRole === Rol.COORDINADOR &&
           (userToList.role === Rol.ESTUDIANTE || userToList.role === Rol.TUTOR || userToList.role === Rol.PROFESOR);
  }

  canDeleteUser(userToList: User): boolean {
    return this.currentUserRole === Rol.ADMIN && userToList.role !== Rol.ADMIN;
  }

  navigateToAddUser() {
    if (this.currentUserRole === Rol.ADMIN) {
        this.navCtrl.navigateForward('/app/users/new');
    } else {
        this.presentToast('No tienes permisos para crear usuarios.', 'warning');
    }
  }

  navigateToEditUser(userId?: string) {
    if (!userId) return;
    const userToEdit = this.users.find(u => u.id === userId);
    if (userToEdit && this.canEditUser(userToEdit)) {
        this.navCtrl.navigateForward(`/app/users/edit/${userId}`);
    } else {
        this.presentToast('No tienes permisos para editar este usuario.', 'warning');
    }
  }

  async confirmDelete(user: User) {
    if (!user.id || !this.canDeleteUser(user)) {
        await this.presentToast('No tienes permisos para eliminar este usuario.', 'warning');
        return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de eliminar al usuario "${user.name || user.email}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          cssClass: 'text-danger', 
          handler: () => this.deleteUser(user.id!),
        },
      ],
    });
    await alert.present();
  }

  private async deleteUser(id: string) {
    const loading = await this.loadingCtrl.create({ message: 'Eliminando usuario...' });
    await loading.present();

    this.userService.deleteUser(id)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: async () => {
        await this.presentToast('Usuario eliminado exitosamente.', 'success');
        this.loadUsers();
      },
      error: async (err: Error) => {
        await this.presentToast(err.message || 'Error al eliminar el usuario.', 'danger');
      },
      complete: async () => {
        await loading.dismiss();
      }
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top', icon: iconName });
    await toast.present();
  }

  handleRefresh(event: CustomEvent) {
    this.loadUsers(event);
  }
}
