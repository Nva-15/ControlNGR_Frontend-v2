import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ayuda } from './ayuda';

describe('Ayuda', () => {
  let component: Ayuda;
  let fixture: ComponentFixture<Ayuda>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ayuda]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Ayuda);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
