import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserFormPage } from './user-form.page';

describe('UserFormPage', () => {
  let component: UserFormPage;
  let fixture: ComponentFixture<UserFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(UserFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
