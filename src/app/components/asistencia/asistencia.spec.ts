import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Asistencia } from './asistencia';

describe('Asistencia', () => {
  let component: Asistencia;
  let fixture: ComponentFixture<Asistencia>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Asistencia]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Asistencia);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
