import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BuildingListPage } from './building-list.page';

describe('BuildingListPage', () => {
  let component: BuildingListPage;
  let fixture: ComponentFixture<BuildingListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BuildingListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
