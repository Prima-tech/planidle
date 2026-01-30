import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ModalContainerComponent } from '../modal-container/modal-container.component';
import { testPageComponent } from 'src/app/pages/test/test.page';
import { CharacterPageComponent } from 'src/app/pages/character/character.page';

@Component({
  selector: 'app-footer-bar',
  templateUrl: './footer-bar.component.html',
  styleUrls: ['./footer-bar.component.scss'],
  standalone: false
})
export class FooterBarComponent implements OnInit {
  @ViewChild('menuModal') menuModal!: ModalContainerComponent;
  @ViewChild('characterModal') characterModal!: ModalContainerComponent;
  constructor(private router: Router) { }

  ngOnInit() { }

  goTo(tab: string) {
    this.router.navigate([`/${tab}`]);
  }

  openMenu() {
    if (this.menuModal.isOpenModal()) {
      this.menuModal.close()
    } else {
      this.menuModal.open(testPageComponent, 'menu');
    }
  }

  openMain() {
    this.router.navigate(['/main']);
  }

  openStatus() {
    if (this.characterModal.isOpenModal()) {
      this.characterModal.close()
    } else {
      this.characterModal.open(CharacterPageComponent, 'character');
    }
  }

}
