import { Injectable } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { delay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class StatusService {

  constructor() { }

  status = {
    HP: 100,
    MP: 100,
    HPmax: 100
  }

  public status$ = new Subject<any>();

  setStatus(health: any) {
    this.status.HP = this.status.HP - health;
    this.status$.next(this.status); // emitir señal
  }

}
