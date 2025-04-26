import { Component, OnInit } from '@angular/core';
import { map, startWith } from 'rxjs';
import { StatusService } from 'src/app/services/status';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.scss'],
  standalone: false,
})
export class TopBarComponent implements OnInit {

  valueHP$ = this.status.status$.pipe(
    startWith({ HP: 100, HPmax: 100 }), // emitir un valor base
    map(status => {
      const value = Math.max(0, Math.min(1, status.HP / status.HPmax));
      const color =
        value < 0.25 ? 'danger' :
        value < 0.5  ? 'warning' : 'success';
      return { value, color };
    })
  );

  constructor(
    public status: StatusService
  ) { }

  ngOnInit() {

  }


}
