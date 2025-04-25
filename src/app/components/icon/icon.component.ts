import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrls: ['./icon.component.scss'],
  standalone: false
})
export class IconComponent implements OnInit {

  @Input() name: any;

  url = '';
  
  constructor() { }

  ngOnInit() {
    this.url = 'assets/icon/weapons/' + this.name + '.png';
  }

}
