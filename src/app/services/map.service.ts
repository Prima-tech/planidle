import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private cellSelectedSubject = new BehaviorSubject<{row:number, col:number} | null>(null);
  cellSelected$ = this.cellSelectedSubject.asObservable();
  
  constructor() { }

  selectCell(data: any) {
    this.cellSelectedSubject.next(data);
  }

}
