import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClassroomsPage } from './classrooms.page';

describe('ClassroomsPage', () => {
  let component: ClassroomsPage;
  let fixture: ComponentFixture<ClassroomsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ClassroomsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
