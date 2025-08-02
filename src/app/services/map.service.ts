import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private cellSelectedSubject = new BehaviorSubject<{row:number, col:number} | null>(null);
  cellSelected$ = this.cellSelectedSubject.asObservable();

  private cellExploredSubject = new BehaviorSubject<{row:number, col:number} | null>(null);
  cellExplored$ = this.cellExploredSubject.asObservable();

  constructor() { }

  selectCell(data: any) {
    this.cellSelectedSubject.next(data);
  }

  markExplored(data: any) {
    this.cellExploredSubject.next(data);
  }

}
