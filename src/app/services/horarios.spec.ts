import { TestBed } from '@angular/core/testing';

import { Horarios } from './horarios';

describe('Horarios', () => {
  let service: Horarios;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Horarios);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
