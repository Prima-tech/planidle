import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { WorldService } from 'src/app/services/world.service';

@Component({
  selector: 'app-map-label',
  templateUrl: './map-label.component.html',
  styleUrls: ['./map-label.component.scss'],
  standalone: false
})
export class MapLabelComponent implements OnInit, OnDestroy {
  private worldService = inject(WorldService);
  private sub: Subscription;

  mapName = '';

  ngOnInit() {
    this.sub = this.worldService.currentMap$.subscribe(map => {
      this.mapName = map.name;
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
