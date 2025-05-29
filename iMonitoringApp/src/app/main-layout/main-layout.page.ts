import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule, NavigationEnd, IsActiveMatchOptions, ActivatedRoute, Routes } from '@angular/router';
import { IonicModule, Platform, PopoverController, NavController, MenuController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service'; // Make sure this path is correct
import { Rol } from '../models/rol.model';
import { User } from '../models/user.model';
import { Subject } from 'rxjs';
import { filter, takeUntil, map, take } from 'rxjs/operators';
import { SettingsPanelComponent } from '../components/settings-panel/settings-panel.component';
import { MobileActionsPopoverComponent } from '../components/mobile-actions-popover/mobile-actions-popover.component';

interface NavLink {
  title: string;
  icon?: string;
  svgPath?: string;
  route?: string;
  children?: NavLink[];
  open?: boolean;
  roles?: Rol[];
  isActive?: boolean;
  action?: () => void;
}

@Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.page.html',
  styleUrls: ['./main-layout.page.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    RouterModule,
    SettingsPanelComponent,
    MobileActionsPopoverComponent,
  ],
})
export class MainLayoutPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  appName = 'AulaMonitor';
  userRole: Rol | null = null;
  currentUser: User | null = null;
  currentPageTitle: string = 'AulaMonitor';

  isUserDropdownOpen = false;
  isSettingsPanelOpen = false;
  isNotificationsPanelOpen = false;
  isSearchPanelOpen = false;
  public showPageLoading: boolean = false;

  allNavLinks: NavLink[] = [];
  filteredNavLinks: NavLink[] = [];

  private activeElementBeforeOverlay: HTMLElement | null = null;

  constructor(
    public authService: AuthService,
    public themeService: ThemeService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private popoverCtrl: PopoverController,
    private platform: Platform,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef,
    private menuCtrl: MenuController
  ) {}

  ngOnInit() {
    this.authService.getCurrentUserRole().pipe(takeUntil(this.destroy$)).subscribe((role: Rol | null) => {
      this.userRole = role;
      this.setupNavLinks();
      this.updateFilteredNavLinks();
      this.cdr.detectChanges();
    });

    this.authService.getCurrentUser().pipe(
      takeUntil(this.destroy$)
    ).subscribe((user: User | null) => {
      this.currentUser = user;
      console.log('MainLayoutPage: currentUser actualizado por AuthService ->', this.currentUser);
      this.cdr.detectChanges();
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      this.updateLinkActiveStates();
      this.updatePageTitle(event.urlAfterRedirects);
      if (this.platform.is('mobile')) {
        this.menuCtrl.close();
      }
    });
    this.updatePageTitle(this.router.url);
    // Removed the problematic call to this.themeService.loadTheme()
    // Assuming ThemeService's constructor or an initTheme() method handles initial theme loading.
    // If your ThemeService requires an explicit call after construction,
    // ensure that method exists and is called appropriately (e.g., this.themeService.initTheme() if available).
  }

  private setupNavLinks() {
    this.allNavLinks = [
      { title: 'Dashboard', icon: 'home-outline', route: '/app/dashboard', roles: [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR, Rol.ESTUDIANTE, Rol.COORDINADOR] },
      { title: 'Mis Reservas', icon: 'calendar-outline', route: '/app/reservations/my-list', roles: [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR, Rol.ESTUDIANTE, Rol.COORDINADOR] },
      { title: 'Nueva Reserva', icon: 'add-circle-outline', route: '/app/reservations/new', roles: [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR, Rol.ESTUDIANTE, Rol.COORDINADOR] },
      { title: 'Disponibilidad Aulas', icon: 'time-outline', route: '/app/classrooms/availability', roles: [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR, Rol.ESTUDIANTE, Rol.COORDINADOR] },
      { title: 'Estudiantes (Coord.)', icon: 'people-outline', route: '/app/users', roles: [Rol.COORDINADOR] },
      { title: 'Reservas Estudiantes (Coord.)', icon: 'filing-outline', route: '/app/reservations/all', roles: [Rol.COORDINADOR] },
      { title: 'Edificios', icon: 'business-outline', route: '/app/buildings', roles: [Rol.ADMIN] },
      { title: 'Aulas (Gestión)', icon: 'school-outline', route: '/app/classrooms', roles: [Rol.ADMIN] },
      { title: 'Usuarios (Gestión)', icon: 'people-circle-outline', route: '/app/users', roles: [Rol.ADMIN] },
      { title: 'Todas las Reservas (Admin)', icon: 'list-circle-outline', route: '/app/reservations/all', roles: [Rol.ADMIN] },
      { title: 'Mi Perfil', icon: 'person-outline', route: '/app/profile', roles: [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR, Rol.ESTUDIANTE, Rol.COORDINADOR] },
    ];
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateFilteredNavLinks() {
    if (!this.userRole) {
      this.filteredNavLinks = [];
      this.cdr.detectChanges();
      return;
    }
    const uniqueLinks = new Map<string, NavLink>();
    this.allNavLinks.forEach(link => {
        if (link.roles && link.roles.includes(this.userRole!) && link.route) {
            if (!uniqueLinks.has(link.route)) {
                uniqueLinks.set(link.route, { ...link, isActive: this.router.isActive(link.route, this.getIsActiveMatchOptions(link.route)) });
            }
        } else if (!link.roles || link.roles.length === 0) {
             if (link.route && !uniqueLinks.has(link.route)) {
                uniqueLinks.set(link.route, { ...link, isActive: this.router.isActive(link.route, this.getIsActiveMatchOptions(link.route)) });
            } else if (!link.route && link.title && !uniqueLinks.has(link.title)) {
                uniqueLinks.set(link.title, link);
            }
        }
    });
    this.filteredNavLinks = Array.from(uniqueLinks.values());
    this.cdr.detectChanges();
  }

  getIsActiveMatchOptions(route: string): IsActiveMatchOptions {
    if (route.includes('/new') || route.match(/\/:id($|\/edit)/)) {
      return { paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' };
    }
    return { paths: 'subset', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' };
  }

  updateLinkActiveStates() {
    this.filteredNavLinks = this.filteredNavLinks.map(link => ({
      ...link,
      isActive: link.route ? this.router.isActive(link.route, this.getIsActiveMatchOptions(link.route)) : false
    }));
    this.cdr.detectChanges();
  }

  updatePageTitle(currentUrl: string) {
    const activeLink = this.filteredNavLinks.find(link => link.isActive);
    this.currentPageTitle = activeLink?.title || this.appName;
    let route = this.activatedRoute;
    while (route.firstChild) {
      route = route.firstChild;
    }
    route.data.pipe(take(1)).subscribe((data: any) => {
      this.currentPageTitle = data['title'] || this.currentPageTitle;
      this.cdr.detectChanges();
    });
  }

  isLinkActive(link?: NavLink): boolean {
    if (!link || !link.route) return false;
    return this.router.isActive(link.route, this.getIsActiveMatchOptions(link.route));
  }

  private storeActiveElement() {
    if (document.activeElement && document.activeElement !== document.body) {
      this.activeElementBeforeOverlay = document.activeElement as HTMLElement;
    } else {
      this.activeElementBeforeOverlay = null;
    }
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

  openPanel(panelName: 'settings' | 'notifications' | 'search') {
    this.storeActiveElement();
    this.blurActiveElement();
    if (panelName === 'settings') this.isSettingsPanelOpen = true;
    else if (panelName === 'notifications') this.isNotificationsPanelOpen = true;
    else if (panelName === 'search') this.isSearchPanelOpen = true;
    this.cdr.detectChanges();
  }

  closePanel(panelName: 'settings' | 'notifications' | 'search') {
    if (panelName === 'settings') this.isSettingsPanelOpen = false;
    else if (panelName === 'notifications') this.isNotificationsPanelOpen = false;
    else if (panelName === 'search') this.isSearchPanelOpen = false;
    this.cdr.detectChanges();
    this.restoreActiveElement();
  }

  async openMobileSubMenu(ev: any) {
    this.storeActiveElement();
    const popover = await this.popoverCtrl.create({
      component: MobileActionsPopoverComponent,
      event: ev,
      translucent: true,
      dismissOnSelect: true,
      cssClass: 'kwd-mobile-actions-popover'
    });
    popover.onDidDismiss().then((detail) => {
      this.restoreActiveElement();
      if (detail && detail.data && detail.data.action) {
        this.handlePopoverAction(detail.data.action);
      }
    });
    await popover.present();
  }

  handlePopoverAction(action: string) {
    console.log('MainLayoutPage - Handling popover action:', action);
    switch (action) {
      case 'notifications': this.openPanel('notifications'); break;
      case 'search': this.openPanel('search'); break;
      case 'settings': this.openPanel('settings'); break;
      case 'profile': this.navigateToProfile(); break;
      case 'logout': this.logout(); break;
    }
  }

  handleAvatarError(event: Event) {
    const element = event.target as HTMLImageElement;
    if (element) {
      element.src = 'assets/icon/default-avatar.svg';
    }
  }

  navigateToProfile() {
    this.navCtrl.navigateForward('/app/profile');
    this.menuCtrl.close();
  }

  triggerDesktopLogout() {
    console.log('MainLayoutPage - triggerDesktopLogout() calling logout()');
    this.logout();
  }

  logout() {
    console.log('MainLayoutPage - logout() method calling authService.logout()');
    this.authService.logout();
    this.menuCtrl.close();
  }
}