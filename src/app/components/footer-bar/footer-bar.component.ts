import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ModalContainerComponent } from '../modal-container/modal-container.component';
import { testPageComponent } from 'src/app/pages/test/test.page';

@Component({
  selector: 'app-footer-bar',
  templateUrl: './footer-bar.component.html',
  styleUrls: ['./footer-bar.component.scss'],
  standalone: false
})
export class FooterBarComponent  implements OnInit {
  @ViewChild('modal') modal!: ModalContainerComponent;
  constructor(private router: Router) {}

  ngOnInit() {}

  goTo(tab: string) {
    this.router.navigate([`/${tab}`]);
  }

  openMenu() {
    if (this.modal.isOpenModal()) {
      this.modal.close()
    } else {
      this.modal.open(testPageComponent, 'menu');
    }
  }

}
