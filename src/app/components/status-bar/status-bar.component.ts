import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-status-bar',
  templateUrl: './status-bar.component.html',
  styleUrls: ['./status-bar.component.scss'],
  standalone: false
})
export class StatusBarComponent implements OnInit {

  @Input() service$: any;

  constructor() { }

  ngOnInit() {}

}
