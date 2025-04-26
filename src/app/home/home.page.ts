import { Component, OnInit } from '@angular/core';
import Phaser from 'phaser';
import { FakeApiService } from '../services/fakeapi';
import { ProfileService } from '../services/profile';
import { GameScene } from '../scenes/gamescene/gamescene';
import { StaticData } from '../mocks/mock-inventory';

@Component({
    selector: 'app-home',
    templateUrl: 'home.page.html',
    styleUrls: ['home.page.scss'],
    standalone: false,
})
export class HomePage implements OnInit {
    phaserGame: Phaser.Game | undefined;
    config: Phaser.Types.Core.GameConfig | undefined;
    items = StaticData.items;


    constructor(
     public service: FakeApiService,
     public profile: ProfileService,
    ) {
      this.loadScene();
    }

    ngOnInit(): void {
        this.phaserGame = new Phaser.Game(this.config);
        this.service.getUserData().subscribe((data) => {
          console.log('soy la data', data)
        })
    }

    
    loadScene() {
      this.config = {
        title: "Sample",
        render: {
          antialias: false,
        },
        type: Phaser.AUTO,
        scene: GameScene,
        scale: {
          width: window.innerWidth,
          height: 200,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        parent: "game",
        backgroundColor: "#48C4F8",
     };
    }

    test() {
      this.profile.setStatus(10);
    }

}