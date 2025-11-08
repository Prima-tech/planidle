import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrls: ['./icon.component.scss'],
  standalone: false
})
export class IconComponent implements OnInit {

  @Input() name: any;
  @Input() type: any = 'weapons';

  url = '';
  
  constructor() { }

  ngOnInit() {
    if (this.type === 'weapons') {
      this.url = 'assets/icon/' + this.type + '/' + this.name + '.png';
    } else if (this.type === 'menu') {
      this.url = 'assets/icon/' + this.type + '/' + this.name + '.svg';
    }
   
  }

}
