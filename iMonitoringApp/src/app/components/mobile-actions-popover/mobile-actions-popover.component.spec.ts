import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { MobileActionsPopoverComponent } from './mobile-actions-popover.component';

describe('MobileActionsPopoverComponent', () => {
  let component: MobileActionsPopoverComponent;
  let fixture: ComponentFixture<MobileActionsPopoverComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [MobileActionsPopoverComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileActionsPopoverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
