import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarcarAsistencia } from './marcar-asistencia';

describe('MarcarAsistencia', () => {
  let component: MarcarAsistencia;
  let fixture: ComponentFixture<MarcarAsistencia>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarcarAsistencia]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarcarAsistencia);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
