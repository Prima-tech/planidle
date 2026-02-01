import { Component, OnInit } from '@angular/core';
import { map, startWith, Subject } from 'rxjs';
import { AsgardService } from 'src/app/services/asgard';
import { StatusService } from 'src/app/services/status';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.scss'],
  standalone: false,
})
export class TopBarComponent implements OnInit {
  valueHP$: any = null;
  initStatusBar = false;

  constructor(
    public asgardService: AsgardService
  ) { }

  ngOnInit() {
    this.initPlayer();
  }

  initPlayer() {
    this.initHP();
  }

  initHP() {
    this.valueHP$ = this.asgardService.player.status$.pipe(
      startWith(this.asgardService.getPlayer().getStatus()), // emitir un valor base
      map(status => {
        const value = Math.max(0, Math.min(1, status.HP / status.HPMax));
        const color =
          value < 0.25 ? 'danger' :
            value < 0.5 ? 'warning' : 'success';
        return { value, color };
      })
    );
    this.initStatusBar = true;

  }


}
