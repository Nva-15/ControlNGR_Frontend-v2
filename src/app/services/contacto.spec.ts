import { TestBed } from '@angular/core/testing';

import { Contacto } from './contacto';

describe('Contacto', () => {
  let service: Contacto;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Contacto);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
