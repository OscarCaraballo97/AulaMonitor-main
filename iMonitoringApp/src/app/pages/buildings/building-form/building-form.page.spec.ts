import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BuildingFormPage } from './building-form.page';

describe('BuildingFormPage', () => {
  let component: BuildingFormPage;
  let fixture: ComponentFixture<BuildingFormPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BuildingFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
