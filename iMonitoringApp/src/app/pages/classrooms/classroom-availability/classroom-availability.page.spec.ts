import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClassroomAvailabilityPage } from './classroom-availability.page';

describe('ClassroomAvalabilityPage', () => {
  let component: ClassroomAvailabilityPage;
  let fixture: ComponentFixture<ClassroomAvailabilityPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ClassroomAvailabilityPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
