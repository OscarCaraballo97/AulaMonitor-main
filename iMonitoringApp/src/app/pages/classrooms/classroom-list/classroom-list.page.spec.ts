import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClassroomListPage } from './classroom-list.page';

describe('ClassroomListPage', () => {
  let component: ClassroomListPage;
  let fixture: ComponentFixture<ClassroomListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ClassroomListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
