import { Component, OnInit } from '@angular/core';
import { MapService } from 'src/app/services/map.service';
import { StatusService } from 'src/app/services/status';

@Component({
  selector: 'app-map-selected-cell',
  templateUrl: './map-selected-cell.component.html',
  styleUrls: ['./map-selected-cell.component.scss'],
  standalone: false,
})
export class MapSelectedCellComponent implements OnInit {

  selectedCell: any = null;

  constructor(
    public status: StatusService,
    public mapService: MapService
  ) { }

  ngOnInit() {
    this.mapService.cellSelected$.subscribe(cell => {
      if(cell) {
        console.log('soy la cell', cell)
        this.selectedCell = cell;
        // abrir modal o cambiar vista con los datos de la celda
      }
    });
  }


}
