import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestIonicPage } from './test-ionic.page';

describe('TestIonicPage', () => {
  let component: TestIonicPage;
  let fixture: ComponentFixture<TestIonicPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TestIonicPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
