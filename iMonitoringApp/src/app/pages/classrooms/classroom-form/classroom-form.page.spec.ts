import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClassroomFormPage } from './classroom-form.page';

describe('ClassroomFormPage', () => {
  let component: ClassroomFormPage;
  let fixture: ComponentFixture<ClassroomFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ClassroomFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
