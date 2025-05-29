import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainLayoutPage } from './main-layout.page';

describe('MainLayoutPage', () => {
  let component: MainLayoutPage;
  let fixture: ComponentFixture<MainLayoutPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MainLayoutPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
