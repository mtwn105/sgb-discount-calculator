import { TestBed } from '@angular/core/testing';

import { SgbService } from './sgb.service';

describe('SgbService', () => {
  let service: SgbService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SgbService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
