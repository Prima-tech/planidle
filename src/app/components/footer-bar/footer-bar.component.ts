import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-footer-bar',
  templateUrl: './footer-bar.component.html',
  styleUrls: ['./footer-bar.component.scss'],
  standalone: false
})
export class FooterBarComponent  implements OnInit {

  constructor(private router: Router) {}

  ngOnInit() {}

  goTo(tab: string) {
    this.router.navigate([`/${tab}`]);
  }

}
