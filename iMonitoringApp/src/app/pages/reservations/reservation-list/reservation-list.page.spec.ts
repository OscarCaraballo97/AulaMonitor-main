import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReservationListPage } from './reservation-list.page';

describe('ReservationListPage', () => {
  let component: ReservationListPage;
  let fixture: ComponentFixture<ReservationListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ReservationListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
