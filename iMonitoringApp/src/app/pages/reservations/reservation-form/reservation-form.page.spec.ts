import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReservationFormPage } from './reservation-form.page';

describe('ReservationFormPage', () => {
  let component: ReservationFormPage;
  let fixture: ComponentFixture<ReservationFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ReservationFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
