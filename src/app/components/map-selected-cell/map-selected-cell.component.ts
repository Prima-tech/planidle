import { Component, OnInit } from '@angular/core';
import { MapService } from 'src/app/services/map.service';

@Component({
  selector: 'app-map-selected-cell',
  templateUrl: './map-selected-cell.component.html',
  styleUrls: ['./map-selected-cell.component.scss'],
  standalone: false,
})
export class MapSelectedCellComponent implements OnInit {

  selectedCell: any = null;

  constructor(
    public mapService: MapService
  ) { }

  ngOnInit() {
    this.mapService.cellSelected$.subscribe(cell => {
      if(cell) {
        this.selectedCell = cell;
      }
    });
  }

  onMarkExploredClick() {
    if (this.selectedCell) {
      this.mapService.markExplored(this.selectedCell);
    }
  }

}
