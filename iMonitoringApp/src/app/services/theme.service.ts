import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

const THEME_KEY = 'theme-preference';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private renderer: Renderer2;
  private currentTheme: 'light' | 'dark' = 'light';

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  initializeTheme() {
    const storedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    if (storedTheme) {
      this.setTheme(storedTheme, false);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark ? 'dark' : 'light', true);
    }
  }

  isDarkMode(): boolean {
    return this.currentTheme === 'dark';
  }

  setTheme(theme: 'light' | 'dark', savePreference: boolean = true) {
    this.currentTheme = theme;
    if (savePreference) {
      localStorage.setItem(THEME_KEY, theme);
    }

    const htmlElement = document.documentElement;
    this.renderer.removeClass(htmlElement, theme === 'dark' ? 'light' : 'dark');
    this.renderer.addClass(htmlElement, theme);


    this.renderer.removeClass(document.body, theme === 'dark' ? 'light' : 'dark');
    this.renderer.addClass(document.body, theme);
  }

  toggleTheme() {
    this.setTheme(this.isDarkMode() ? 'light' : 'dark');
  }
}