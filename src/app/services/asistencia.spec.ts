import { TestBed } from '@angular/core/testing';

import { Asistencia } from './asistencia';

describe('Asistencia', () => {
  let service: Asistencia;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Asistencia);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
