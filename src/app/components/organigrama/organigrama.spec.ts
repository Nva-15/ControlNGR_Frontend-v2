import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Organigrama } from './organigrama';

describe('Organigrama', () => {
  let component: Organigrama;
  let fixture: ComponentFixture<Organigrama>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Organigrama]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Organigrama);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
