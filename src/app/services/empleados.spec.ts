import { TestBed } from '@angular/core/testing';

import { Empleados } from './empleados';

describe('Empleados', () => {
  let service: Empleados;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Empleados);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
