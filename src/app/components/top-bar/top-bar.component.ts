import { Component, inject, OnInit } from '@angular/core';
import { map, startWith } from 'rxjs';
import { AsgardService } from 'src/app/services/asgard';
import { PlayerBridgeService } from 'src/app/services/player-bridge.service';
import { PlayerStateService } from 'src/app/services/player-state.service';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.scss'],
  standalone: false,
})
export class TopBarComponent implements OnInit {
  private playerState  = inject(PlayerStateService);
  private playerBridge = inject(PlayerBridgeService);
  asgardService        = inject(AsgardService);

  valueHP$: any = null;
  initStatusBar = false;
  coins$ = this.playerState.coins$;

  ngOnInit() {
    this.valueHP$ = this.playerBridge.player.status$.pipe(
      startWith(this.playerBridge.getPlayer().getStatus()),
      map(status => {
        const value = Math.max(0, Math.min(1, status.HP / status.HPMax));
        const color = value < 0.25 ? 'danger' : value < 0.5 ? 'warning' : 'success';
        return { value, color };
      })
    );
    this.initStatusBar = true;
  }
}
