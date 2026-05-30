import { Component, OnDestroy, OnInit } from '@angular/core';
import { SceneManager } from 'src/app/scenes/scene-manager';

@Component({
  selector: 'app-map',
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss'],
  standalone: false,
})
export class MapPage implements OnInit, OnDestroy {

  constructor(private sceneManager: SceneManager) {}

  ngOnInit() {
    if (this.sceneManager.game) {
      this.sceneManager.changeScene('MapScene');
    }
  }

  ngOnDestroy() {
    if (this.sceneManager.game) {
      this.sceneManager.changeScene('GameScene');
    }
  }

}
